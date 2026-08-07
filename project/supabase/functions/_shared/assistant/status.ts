/**
 * What the assistant says it is doing, while it does it.
 *
 * The vocabulary used to be three strings — understanding / thinking / searching — so every
 * question looked identical from the outside no matter what was really being read. The tool
 * name and its arguments are already known at the call site, and entities seen earlier in
 * the turn already carry human labels, so a status can name the actual work for free: no
 * extra model round, no extra query, no extra latency.
 *
 * Only keys travel to the client; interpolation happens there through i18next, so the
 * status is written in the caller's language rather than translated after the fact. Values
 * that would leak an identifier (a UUID, a stock id) never become params — a param is
 * either something the user typed or a label already shown to them.
 */
import type { ToolEntity, ToolResult } from "./types.ts";

/** Interpolation values for a status key. Strings are display text, never identifiers. */
export type StatusParams = Record<string, string | number>;

export interface StatusMessage {
  key: string;
  params?: StatusParams;
}

/** A status line has to fit one row of a narrow panel; quoted user text is clamped hard. */
const MAX_PARAM_LENGTH = 32;

function display(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_PARAM_LENGTH
    ? `${trimmed.slice(0, MAX_PARAM_LENGTH - 1)}…`
    : trimmed;
}

/**
 * The human label for an id the caller has already seen.
 *
 * A vehicle id is a UUID and means nothing on screen, but by the time a follow-up tool runs
 * on it the row that produced it is usually in evidence with its registration number. When
 * it is not — a first-turn deep link, say — the caller gets the unnamed variant of the
 * status rather than a raw id.
 */
function labelFor(
  evidence: Map<string, ToolEntity>,
  type: string,
  id: string | null,
): string | null {
  if (!id) return null;
  return display(evidence.get(`${type}:${id}`)?.label ?? null);
}

/**
 * Arguments are read leniently here, unlike in the tools themselves.
 *
 * A status is decoration on work that is about to be validated properly a few lines later:
 * if an argument is missing or the wrong shape, the right outcome is a vaguer status and
 * the tool's own error, never a throw from the narration.
 */
function argsOf(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}

function textArg(args: Record<string, unknown>, name: string): string | null {
  const value = args[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function numberArg(
  args: Record<string, unknown>,
  name: string,
): number | null {
  const value = args[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Names the work a tool call is about to do.
 *
 * Falls back to a plainer variant of the same key whenever an argument is missing or would
 * only name a row by id, so every branch here still says something true.
 */
export function toolStatus(
  name: string,
  raw: unknown,
  evidence: Map<string, ToolEntity>,
): StatusMessage {
  const args = argsOf(raw);
  const key = (suffix: string, params?: StatusParams): StatusMessage => ({
    key: `assistant.status.tool.${suffix}`,
    params,
  });

  switch (name) {
    case "search_inventory": {
      const query = display(textArg(args, "query"));
      return query ? key("inventoryQuery", { query }) : key("inventory");
    }
    case "get_vehicle_360": {
      const vehicle = labelFor(evidence, "vehicle", textArg(args, "vehicle_id"));
      return vehicle ? key("vehicleNamed", { vehicle }) : key("vehicle");
    }
    case "get_dashboard_ageing": {
      const days = numberArg(args, "ageing_threshold_days");
      return days ? key("ageingDays", { days }) : key("ageing");
    }
    case "get_alerts_compliance": {
      const vehicle = labelFor(evidence, "vehicle", textArg(args, "vehicle_id"));
      return vehicle ? key("complianceNamed", { vehicle }) : key("compliance");
    }
    case "get_partner_portfolio": {
      const partner = labelFor(evidence, "partner", textArg(args, "partner_id"));
      return partner ? key("portfolioNamed", { partner }) : key("portfolio");
    }
    case "search_parties": {
      const query = display(textArg(args, "query"));
      return query ? key("partiesQuery", { query }) : key("parties");
    }
    case "search_partners": {
      const query = display(textArg(args, "query"));
      return query ? key("partnersQuery", { query }) : key("partners");
    }
    case "get_finance_overview": {
      const vehicle = labelFor(evidence, "vehicle", textArg(args, "vehicle_id"));
      return vehicle ? key("financeNamed", { vehicle }) : key("finance");
    }
    case "get_operational_records": {
      switch (textArg(args, "record_type")) {
        case "inspections":
          return key("inspections");
        case "documents":
          return key("documents");
        case "listings":
          return key("listings");
        case "enquiries":
          return key("enquiries");
        default:
          return key("records");
      }
    }
    case "get_compliance_policies":
      return key("policies");
    case "get_administration_overview":
      return textArg(args, "section") === "audit"
        ? key("audit")
        : key("team");
    case "acknowledge_alert":
      return key("acknowledge");
    case "propose_create_vehicle_with_purchase":
      return key("draftPurchase");
    case "propose_complete_vehicle_sale":
      return key("draftSale");
    default:
      return key("working");
  }
}

/**
 * What a finished search found, for the tools whose entities are one-per-row.
 *
 * Deliberately not emitted for every tool: `get_alerts_compliance` adds the vehicles behind
 * its alerts to the same list, and the overview tools carry a single summary entity, so a
 * count there would be a confident lie. Returning null leaves the pre-call status standing.
 */
export function toolResultStatus(
  name: string,
  result: ToolResult,
): StatusMessage | null {
  if (!result.ok) return null;
  const countsRows = name === "search_inventory" ||
    name === "search_parties" ||
    name === "search_partners";
  if (!countsRows) return null;
  const count = result.entities?.length ?? 0;
  return count > 0
    ? { key: "assistant.status.tool.found", params: { count } }
    : { key: "assistant.status.tool.foundNone" };
}
