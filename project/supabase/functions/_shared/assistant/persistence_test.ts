import { sanitizeTraceDetails } from "./persistence.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("trace detail sanitizer redacts secrets and hidden reasoning", () => {
  const details = sanitizeTraceDetails({
    model: "gpt-test",
    input_tokens: 120,
    access_token: "user-jwt",
    apiKey: "provider-secret",
    confirmation_token: "signed-action",
    hidden_reasoning: "private model reasoning",
    nested: { authorization: "Bearer secret", safe_count: 3 },
  });

  assert(details.model === "gpt-test", "safe model metadata was removed");
  assert(details.input_tokens === 120, "usage metadata was removed");
  assert(details.access_token === "[redacted]", "access token was retained");
  assert(details.apiKey === "[redacted]", "API key was retained");
  assert(
    details.confirmation_token === "[redacted]",
    "confirmation token was retained",
  );
  assert(
    details.hidden_reasoning === "[redacted]",
    "hidden reasoning was retained",
  );
  const nested = details.nested as Record<string, unknown>;
  assert(nested.authorization === "[redacted]", "authorization was retained");
  assert(nested.safe_count === 3, "safe nested metadata was removed");
});

Deno.test("trace detail sanitizer bounds strings, arrays, and nesting", () => {
  const details = sanitizeTraceDetails({
    long: "x".repeat(700),
    list: Array.from({ length: 60 }, (_, index) => index),
    deep: { a: { b: { c: { d: { e: "too deep" } } } } },
  });
  assert(
    (details.long as string).length === 500,
    "long strings were not bounded",
  );
  assert((details.list as unknown[]).length === 40, "arrays were not bounded");
  assert(
    JSON.stringify(details.deep).includes("[depth-limited]"),
    "deep values were retained",
  );
});
