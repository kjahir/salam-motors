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

export interface PrefetchPlan {
  tool: string;
  arguments: Record<string, unknown>;
  /** Which rule matched, for the trace. */
  intent: string;
}

interface Rule {
  intent: string;
  tool: string;
  /** Every group must match somewhere in the message. */
  require: RegExp[];
  /** Any match here disqualifies the rule. */
  reject?: RegExp[];
  build: (message: string) => Record<string, unknown>;
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
      arguments: rule.build(text),
      intent: rule.intent,
    };
  }
  return null;
}
