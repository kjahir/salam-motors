/**
 * Guesses the tool a question obviously needs, so the turn can start with evidence already
 * in hand instead of spending a whole model round being told which tool to call.
 *
 * A measured routing round cost 3.35s to emit ~30 tokens naming one tool. This removes that
 * round when the intent is unambiguous.
 *
 * ## Why this is a prefetch, not routing
 *
 * The result is seeded into the replay as a completed tool call. It is not a commitment:
 * the model sees it, and if it wanted something else it simply calls the tool it wanted, as
 * it always could. So a wrong guess costs one wasted read plus some input tokens and
 * degrades to exactly today's behaviour — it can never produce a wrong answer, only a
 * slower one. That asymmetry is what makes guessing acceptable here at all.
 *
 * Precision therefore matters far more than recall, and the patterns below are deliberately
 * narrow. No match is the safe default, not a failure.
 *
 * ## Known limitation
 *
 * Matching is on English and common Latin-script transliterations. Ask Salam supports six
 * locales, so speakers of the other five keep the routing round. Treated as acceptable
 * because the failure mode is "no speed-up", not "wrong result" — but it does mean the
 * benefit is unevenly distributed, and a proper multilingual intent classifier would be
 * the way to close that gap.
 */

import { dealershipToday } from "./prompt.ts";

export interface PrefetchPlan {
  tool: string;
  arguments: Record<string, unknown>;
  /** Which rule matched, for the trace. */
  intent: string;
}

/**
 * Resolves "this month" / "last month" to real dates, or null for no date filter.
 *
 * Worth doing here rather than leaving to the model: a finance question naming a relative
 * period is exactly the case that produced a confident ₹0 for March 2025 when the model had
 * to guess the date. Resolving it server-side means the prefetched result is already for
 * the right period.
 */
function periodFilter(
  message: string,
  now?: Date,
): { date_from: string | null; date_to: string | null } {
  const today = dealershipToday(now);
  if (/\bthis month\b|\bcurrent month\b/i.test(message)) {
    return { date_from: today.monthStart, date_to: today.monthEnd };
  }
  if (/\blast month\b|\bprevious month\b/i.test(message)) {
    const [year, month] = today.monthStart.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 2, 1));
    const end = new Date(Date.UTC(year, month - 1, 0));
    return {
      date_from: start.toISOString().slice(0, 10),
      date_to: end.toISOString().slice(0, 10),
    };
  }
  return { date_from: null, date_to: null };
}

interface Rule {
  intent: string;
  tool: string;
  /** Every group must match somewhere in the message. */
  require: RegExp[];
  /** Any match here disqualifies the rule. */
  reject?: RegExp[];
  build: (message: string, now?: Date) => Record<string, unknown>;
}

/** Smaller than the model would ask for: a wrong guess should be cheap to carry. */
const PREFETCH_LIMIT = 20;

const SOLD = /\bsold\b/i;
const WRITE_INTENT =
  /\b(add|create|register|onboard|record|sell|complete|update|delete|remove|acknowledge|confirm)\b/i;

/**
 * Asks for more than one thing. Length is a poor proxy for this — a 160-character question
 * can be perfectly single-intent — so the conjunctions are matched directly. A compound
 * question is left to the model, which can decompose it into the several calls it needs.
 */
const COMPOUND_INTENT =
  /\b(and then|as well as|after that|also (?:give|show|tell|draft|list)|then (?:give|show|tell|draft|list))\b/i;

const RULES: readonly Rule[] = [
  {
    intent: "finance_overview",
    tool: "get_finance_overview",
    require: [
      /\b(profit|finance|financial|revenue|expense|expenses|spending|cash|margin|turnover|earnings|loss)\b/i,
    ],
    // "which vehicle is most profitable" wants inventory ranking, not the org ledger.
    reject: [WRITE_INTENT, /\b(which|what) (vehicle|bike|car|scooter)\b/i],
    build: (message, now) => ({
      vehicle_id: null,
      ...periodFilter(message, now),
      limit: 100,
    }),
  },
  {
    intent: "ageing_stock",
    tool: "get_dashboard_ageing",
    require: [
      /\b(ageing|aging|oldest|longest|stagnant|slow[- ]moving|sitting|not moving)\b/i,
    ],
    reject: [WRITE_INTENT],
    build: () => ({ include_sold: false, ageing_threshold_days: 60 }),
  },
  {
    intent: "compliance_alerts",
    tool: "get_alerts_compliance",
    require: [
      /\b(alert|alerts|compliance|expired|expiry|insurance|fitness|permit|puc|rc|document)\b/i,
    ],
    reject: [WRITE_INTENT],
    build: () => ({
      vehicle_id: null,
      status: null,
      severity: null,
      alert_type: null,
      include_resolved: false,
      limit: PREFETCH_LIMIT,
    }),
  },
  {
    intent: "inventory_listing",
    tool: "search_inventory",
    require: [
      /\b(stock|inventory|vehicle|vehicles|bike|bikes|car|cars|scooter|scooters)\b/i,
      /\b(unsold|available|list|show|which|what|how many|remaining|in stock)\b/i,
    ],
    reject: [WRITE_INTENT],
    build: (message) => ({
      query: null,
      status: null,
      category: null,
      min_price: null,
      max_price: null,
      min_days: null,
      max_days: null,
      include_sold: SOLD.test(message),
      limit: PREFETCH_LIMIT,
    }),
  },
];

/**
 * Returns a prefetch plan, or null when nothing matches confidently.
 *
 * `allowed` is the caller's authorized read-only tool set. A prefetch runs with the user's
 * own principal and must never reach a tool the model itself could not have called, so the
 * check happens here rather than being assumed by the caller.
 */
export function planPrefetch(
  message: string,
  allowed: ReadonlySet<string>,
  now?: Date,
): PrefetchPlan | null {
  const text = message.trim();
  if (text.length < 6 || text.length > 200) return null;
  if (COMPOUND_INTENT.test(text)) return null;

  for (const rule of RULES) {
    if (!allowed.has(rule.tool)) continue;
    if (rule.reject?.some((pattern) => pattern.test(text))) continue;
    if (!rule.require.every((pattern) => pattern.test(text))) continue;
    return {
      tool: rule.tool,
      arguments: rule.build(text, now),
      intent: rule.intent,
    };
  }
  return null;
}

/**
 * Builds a plan for an intent identified some other way — currently embedding similarity,
 * which reaches the five locales these English patterns cannot.
 *
 * The keyword `require` patterns are skipped, since the classifier has already decided; the
 * `reject` patterns are not. Those encode facts about the *question* rather than about
 * English matching — never prefetch a write, never send a per-vehicle profit question to the
 * org ledger — and they must hold however the intent was reached.
 *
 * Returns null for an unknown intent, so a stale row in the examples table degrades to no
 * prefetch rather than to an error.
 */
export function planForIntent(
  intent: string,
  message: string,
  allowed: ReadonlySet<string>,
  now?: Date,
): PrefetchPlan | null {
  const rule = RULES.find((item) => item.intent === intent);
  if (!rule || !allowed.has(rule.tool)) return null;
  const text = message.trim();
  if (rule.reject?.some((pattern) => pattern.test(text))) return null;
  if (COMPOUND_INTENT.test(text)) return null;
  return {
    tool: rule.tool,
    arguments: rule.build(text, now),
    intent: rule.intent,
  };
}
