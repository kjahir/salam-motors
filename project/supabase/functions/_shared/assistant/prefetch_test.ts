import { planPrefetch } from "./prefetch.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ALL = new Set([
  "search_inventory",
  "get_dashboard_ageing",
  "get_alerts_compliance",
]);

Deno.test("obvious read questions are prefetched", () => {
  const cases: [string, string][] = [
    ["which bikes are unsold", "search_inventory"],
    ["show me the cars in stock", "search_inventory"],
    ["how many vehicles are available", "search_inventory"],
    ["what is the oldest stock", "get_dashboard_ageing"],
    ["which vehicles are slow-moving", "get_dashboard_ageing"],
    ["any compliance alerts", "get_alerts_compliance"],
    ["whose insurance has expired", "get_alerts_compliance"],
  ];
  for (const [message, tool] of cases) {
    const plan = planPrefetch(message, ALL);
    assert(plan !== null, `no plan for ${JSON.stringify(message)}`);
    assert(
      plan.tool === tool,
      `${JSON.stringify(message)} routed to ${plan.tool}, expected ${tool}`,
    );
  }
});

Deno.test("write intents are never prefetched", () => {
  // A prefetch runs before the model has said anything. It must only ever read.
  for (
    const message of [
      "add a new vehicle to stock",
      "complete the sale for this car",
      "acknowledge the insurance alert",
      "remove this vehicle from inventory",
      "update the asking price of the bike in stock",
    ]
  ) {
    assert(
      planPrefetch(message, ALL) === null,
      `write intent was prefetched: ${JSON.stringify(message)}`,
    );
  }
});

Deno.test("ambiguous or unrelated questions fall through to the model", () => {
  // No match is the safe default: the turn simply behaves as it did before prefetching.
  for (
    const message of [
      "hello",
      "thanks",
      "what can you do",
      "who is the best partner by returns",
      "explain the compliance policy rules to me and then draft a summary for the team " +
      "covering every vehicle we own including the ones sold last year and the quarter before",
    ]
  ) {
    assert(
      planPrefetch(message, ALL) === null,
      `unexpectedly prefetched: ${JSON.stringify(message)}`,
    );
  }
});

Deno.test("a tool the caller cannot use is never prefetched", () => {
  // The prefetch runs under the user's own principal, so it must not reach a tool the
  // model itself would have been refused.
  const plan = planPrefetch("which bikes are unsold", new Set(["get_vehicle_360"]));
  assert(plan === null, "prefetched a tool outside the caller's capabilities");
});

Deno.test("include_sold follows the question", () => {
  const withSold = planPrefetch("list the vehicles we sold", ALL);
  assert(withSold?.tool === "search_inventory", "sold listing was not matched");
  assert(withSold.arguments.include_sold === true, "include_sold was not set");

  const withoutSold = planPrefetch("which bikes are unsold", ALL);
  assert(
    withoutSold?.arguments.include_sold === false,
    "include_sold should stay false for an unsold question",
  );
});

Deno.test("prefetch arguments satisfy the tool schema shape", () => {
  // The seeded call is replayed to the model as if it had asked, so the arguments must be
  // the same shape a real call would carry — every property present, nulls for no filter.
  const plan = planPrefetch("which bikes are unsold", ALL);
  assert(plan !== null, "no plan");
  for (
    const key of [
      "query",
      "status",
      "category",
      "min_price",
      "max_price",
      "min_days",
      "max_days",
      "include_sold",
      "limit",
    ]
  ) {
    assert(key in plan.arguments, `search_inventory arguments missing ${key}`);
  }
  assert(plan.arguments.limit === 20, "prefetch should ask for a modest page");
});
