import { modelToolNames, traceModelItems } from "./model-trace.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("model trace retains message text and tool argument values", () => {
  const trace = traceModelItems([
    { role: "user", content: "Customer Priya phone 9999999999" },
    {
      type: "function_call",
      call_id: "call_1",
      name: "search_parties",
      arguments: JSON.stringify({ query: "Priya", party_type: "customer" }),
    },
  ]);

  assert(trace[0].content_characters === 31, "text size was not recorded");
  assert(
    trace[0].content_text === "Customer Priya phone 9999999999",
    "message text was not recorded",
  );
  assert(trace[1].call_id === "call_1", "call_id was not recorded");
  assert(
    trace[1].arguments?.query === "Priya" &&
      trace[1].arguments?.party_type === "customer",
    "tool argument values were not recorded",
  );
});

Deno.test("model trace records text assembled from content parts", () => {
  const trace = traceModelItems([
    {
      type: "message",
      role: "assistant",
      content: [
        { type: "output_text", text: "Three Swifts " },
        { type: "output_text", text: "are unsold." },
      ],
    },
  ]);

  assert(trace[0].content_type === "parts", "part content was not detected");
  assert(
    trace[0].content_text === "Three Swifts are unsold.",
    "part text was not concatenated",
  );
  assert(trace[0].content_characters === 24, "part text size was wrong");
});

Deno.test("model trace keeps unparseable tool arguments verbatim", () => {
  const trace = traceModelItems([
    {
      type: "function_call",
      name: "search_inventory",
      arguments: '{"query": "Swift',
    },
  ]);

  assert(trace[0].arguments === undefined, "broken JSON parsed as arguments");
  assert(
    trace[0].arguments_unparsed === '{"query": "Swift',
    "unparseable arguments were dropped instead of kept for diagnosis",
  );
});

Deno.test("model trace omits text for items that carry none", () => {
  const trace = traceModelItems([{ type: "reasoning", id: "rs_1" }]);

  assert(trace[0].type === "reasoning", "item type was not recorded");
  assert(
    trace[0].content_text === undefined,
    "a contentless item invented empty text",
  );
});

Deno.test("model trace lists offered tool names only", () => {
  const names = modelToolNames([
    { type: "function", name: "search_inventory", description: "private" },
    { type: "function", function: { name: "get_finance_overview" } },
  ]);
  assert(
    names.join(",") === "search_inventory,get_finance_overview",
    "tool names were not extracted",
  );
});

Deno.test("model trace records tool results fed back into the next round", () => {
  // function_call_output is how evidence re-enters the model's input. Its payload lives in
  // `output`, not `content`; missing that made the trace silent about how much material a
  // round had to summarize, which is the main driver of how long that round takes.
  const payload = JSON.stringify({ ok: true, entities: [{ id: "v1" }] });
  const trace = traceModelItems([
    { type: "function_call_output", call_id: "call_1", output: payload },
  ]);

  assert(trace[0].call_id === "call_1", "call_id was not recorded");
  assert(trace[0].content_type === "tool_result", "payload type was not recorded");
  assert(
    trace[0].content_characters === payload.length,
    `evidence size was not recorded, got ${trace[0].content_characters}`,
  );
  assert(trace[0].content_text === payload, "evidence body was not recorded");
});
