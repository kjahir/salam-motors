import {
  parseAssistantTurnRequest,
  RequestValidationError,
} from "./validation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectValidationError(run: () => unknown, message: string): void {
  let rejected = false;
  try {
    run();
  } catch (error) {
    rejected = error instanceof RequestValidationError;
  }
  assert(rejected, message);
}

Deno.test("request parser matches the frontend assistant-turn contract", () => {
  const request = parseAssistantTurnRequest({
    conversationId: "11111111-1111-4111-8111-111111111111",
    message: "Show bikes older than 60 days",
    locale: "en-IN",
    context: {
      surface: "desktop",
      page: "inventory",
      vehicleId: "22222222-2222-4222-8222-222222222222",
      vehicleTab: "overview",
    },
    stream: true,
  });
  assert(request.stream, "stream flag should be retained");
  assert(request.context.surface === "desktop", "surface changed");
  assert(request.locale === "en-IN", "locale changed");
});

Deno.test("stream defaults follow the Accept header", () => {
  const base = {
    message: "Show inventory",
    locale: "en",
    context: { surface: "mobile" },
  };
  assert(
    parseAssistantTurnRequest(base, "text/event-stream").stream,
    "SSE accept header should default stream on",
  );
  assert(
    !parseAssistantTurnRequest(base, "application/json").stream,
    "JSON accept header should default stream off",
  );
});

Deno.test("request parser rejects caller-supplied access context", () => {
  // Extra properties are ignored, but they can never enter AssistantPrincipal;
  // authentication derives that object independently from Supabase.
  const request = parseAssistantTurnRequest({
    message: "Show inventory",
    locale: "en",
    context: {
      surface: "desktop",
      orgId: "attacker-org",
      role: "owner",
    },
  });
  assert(
    !("orgId" in request.context) && !("role" in request.context),
    "access claims must be discarded",
  );
});

Deno.test("request parser rejects unsupported surfaces", () => {
  expectValidationError(
    () =>
      parseAssistantTurnRequest({
        message: "hello",
        locale: "en",
        context: { surface: "inventory" },
      }),
    "unknown surface should be rejected",
  );
});

Deno.test("request parser rejects invalid IDs", () => {
  expectValidationError(
    () =>
      parseAssistantTurnRequest({
        conversationId: "not-a-uuid",
        message: "hello",
        locale: "en",
        context: { surface: "desktop" },
      }),
    "invalid conversation ID should be rejected",
  );
});

Deno.test("request parser rejects short action tokens", () => {
  expectValidationError(
    () =>
      parseAssistantTurnRequest({
        message: "Execute the confirmed action.",
        locale: "en",
        context: { surface: "desktop" },
        action: { token: "too-short" },
      }),
    "short action token should be rejected",
  );
});
