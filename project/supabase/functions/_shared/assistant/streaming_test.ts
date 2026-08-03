import { AnswerTextScanner, readSseData } from "./streaming.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/** Feeds a document one character at a time — the worst case for chunk boundaries. */
function scanCharByChar(document: string): string {
  const scanner = new AnswerTextScanner();
  let out = "";
  for (const char of document) out += scanner.feed(char);
  return out;
}

Deno.test("scanner extracts answer.text from a whole document", () => {
  const scanner = new AnswerTextScanner();
  const text = scanner.feed(
    '{"schemaVersion":"1.0","turnId":"t1","conversationId":"c1","locale":"en",' +
      '"answer":{"text":"Three Swifts are unsold.","tone":"neutral"},"blocks":[]}',
  );
  assert(text === "Three Swifts are unsold.", `got ${JSON.stringify(text)}`);
  assert(scanner.done, "scanner did not finish at the closing quote");
});

Deno.test("scanner survives chunk boundaries anywhere, including inside escapes", () => {
  // ₹ is ₹ — a real case here, and six characters that a chunk can split.
  const document =
    '{"locale":"en","answer":{"text":"Priya paid \\u20b9565000 for the \\"VXi\\".\\nDone.",' +
    '"tone":"neutral"},"blocks":[]}';
  const expected = 'Priya paid ₹565000 for the "VXi".\nDone.';
  assert(
    scanCharByChar(document) === expected,
    `char-by-char feed produced ${JSON.stringify(scanCharByChar(document))}`,
  );

  // And in one piece, for the same result.
  const whole = new AnswerTextScanner();
  assert(whole.feed(document) === expected, "whole-document feed differed");
});

Deno.test("scanner emits nothing for a round that produced no answer", () => {
  // A tool-selection round returns function calls, never the turn document. The scanner
  // must stay silent rather than emitting fragments of unrelated JSON.
  const scanner = new AnswerTextScanner();
  const text = scanner.feed(
    '{"type":"function_call","name":"search_inventory","arguments":"{\\"limit\\":50}"}',
  );
  assert(text === "", `expected no text, got ${JSON.stringify(text)}`);
  assert(!scanner.started, "scanner claimed to have found an answer field");
  assert(!scanner.done, "scanner claimed completion");
});

Deno.test("scanner stops at the end of answer.text and ignores later fields", () => {
  const scanner = new AnswerTextScanner();
  const text = scanner.feed(
    '{"answer":{"text":"Done.","tone":"neutral"},' +
      '"blocks":[{"type":"vehicle_collection","title":"Not part of the answer"}]}',
  );
  assert(text === "Done.", `got ${JSON.stringify(text)}`);
  assert(scanner.done, "scanner ran past the closing quote");
  assert(scanner.feed('{"more":"ignored"}') === "", "scanner emitted after done");
});

Deno.test("sse reader yields payloads and tolerates split frames", async () => {
  const body = streamOf(
    "event: response.output_text.delta\n" +
      'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n' +
      "event: response.completed\n" +
      'data: {"type":"response.completed","response":{"id":"resp_1"}}\n\n' +
      "data: [DONE]\n\n",
  );
  const seen: string[] = [];
  for await (const item of readSseData(body)) seen.push(String(item.type));
  assert(
    seen.join(",") === "response.output_text.delta,response.completed",
    `unexpected events: ${seen.join(",")}`,
  );
});

Deno.test("sse reader skips keep-alive comments and unparseable frames", async () => {
  const body = streamOf(
    ": keep-alive\n\n" +
      "data: not json\n\n" +
      'data: {"type":"response.completed","response":{}}\n\n',
  );
  const seen: string[] = [];
  for await (const item of readSseData(body)) seen.push(String(item.type));
  assert(seen.length === 1, `expected 1 usable event, got ${seen.length}`);
});
