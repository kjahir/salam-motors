import { modelToolNames, summarizeModelItems } from "./model-trace.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("model trace summaries retain shape but omit content and values", () => {
  const summary = summarizeModelItems([
    { role: "user", content: "Customer Priya phone 9999999999" },
    {
      type: "function_call",
      name: "search_parties",
      arguments: JSON.stringify({ query: "Priya", party_type: "customer" }),
    },
  ]);

  assert(summary[0].content_characters === 31, "text size was not recorded");
  assert(
    !JSON.stringify(summary).includes("Priya"),
    "customer content leaked into trace details",
  );
  assert(
    summary[1].argument_keys?.join(",") === "party_type,query",
    "tool argument field names were not recorded",
  );
  assert(
    !JSON.stringify(summary).includes("customer"),
    "tool argument values leaked into trace details",
  );
});

Deno.test("model trace summaries list offered tool names only", () => {
  const names = modelToolNames([
    { type: "function", name: "search_inventory", description: "private" },
    { type: "function", function: { name: "get_finance_overview" } },
  ]);
  assert(
    names.join(",") === "search_inventory,get_finance_overview",
    "tool names were not extracted",
  );
});
