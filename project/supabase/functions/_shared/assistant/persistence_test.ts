import { AssistantPersistence, sanitizeTraceDetails } from "./persistence.ts";
import type {
  AssistantPrincipal,
  SupabaseClientLike,
} from "./types.ts";
import { WORKFLOW_STEP } from "./workflow.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
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
    long: "x".repeat(25_000),
    list: Array.from({ length: 60 }, (_, index) => index),
    deep: { a: { b: { c: { d: { e: { f: { g: { h: { i: "too deep" } } } } } } } } },
  });
  assert(
    (details.long as string).endsWith("…[truncated]"),
    "over-long strings were truncated without saying so",
  );
  assert(
    (details.long as string).length === 20_000 + "…[truncated]".length,
    "long strings were not bounded",
  );
  assert((details.list as unknown[]).length === 40, "arrays were not bounded");
  assert(
    JSON.stringify(details.deep).includes("[depth-limited]"),
    "deep values were retained",
  );
});

Deno.test("trace detail sanitizer keeps prompt and response content", () => {
  // The whole point of the step-3 trace: a reader must be able to see what was sent and
  // what came back. These keys were previously blocked by name, which is why a failed
  // tool-selection round was undiagnosable.
  const details = sanitizeTraceDetails({
    request: {
      instructions: "You are the Salam Motors in-product assistant.",
      input_items: [
        {
          role: "user",
          content_text: "which Swifts are unsold",
          arguments: { query: "Swift", status: "unsold" },
        },
      ],
    },
    response: { output_text: "Three Swifts are unsold." },
  });

  const request = details.request as Record<string, unknown>;
  assert(
    (request.instructions as string).startsWith("You are the Salam Motors"),
    "system instructions were redacted",
  );
  const items = request.input_items as Record<string, unknown>[];
  assertEquals(items[0].content_text, "which Swifts are unsold");
  assertEquals(
    (items[0].arguments as Record<string, unknown>).query,
    "Swift",
  );
  assertEquals(
    (details.response as Record<string, unknown>).output_text,
    "Three Swifts are unsold.",
  );
});

Deno.test("terminal failures are attributed to the step that was running", async () => {
  // turn.failed / confirmation.failed are raised from catch blocks that have no idea why
  // they were reached. They read the step off the last event logged, so a timeout during
  // tool selection is filed under step 3 rather than under whichever step the catch sits
  // in. Getting this wrong made every failure look identical in the Audit view.
  const persistence = new AssistantPersistence(
    null as unknown as SupabaseClientLike,
    null,
    { userId: "u1", orgId: "o1", role: "owner" } as AssistantPrincipal,
  );

  assertEquals(persistence.currentWorkflowStep, null);

  await persistence.logTrace(null, "c1", {
    workflowStep: WORKFLOW_STEP.AUTHENTICATE,
    category: "request",
    eventKey: "turn.request.accepted",
    status: "completed",
    summary: "accepted",
  });
  assertEquals(persistence.currentWorkflowStep, WORKFLOW_STEP.AUTHENTICATE);

  await persistence.logTrace(null, "c1", {
    workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
    category: "model",
    eventKey: "model.round.started",
    status: "started",
    summary: "round 3",
  });
  assertEquals(persistence.currentWorkflowStep, WORKFLOW_STEP.CLASSIFY_AND_TOOLS);
});
