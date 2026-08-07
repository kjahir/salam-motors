import { describe, expect, it } from "vitest";
import { AssistantApiError, assistantErrorTranslationKey } from "./errors";

describe("assistant error localization", () => {
  it("maps session, permission, rate-limit, timeout, and response codes", () => {
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("expired", { code: "INVALID_SESSION" }),
      ),
    ).toBe("assistant.errors.sessionExpired");
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("denied", { code: "ORG_ACCESS_DENIED" }),
      ),
    ).toBe("assistant.errors.notAuthorized");
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("busy", { code: "ASSISTANT_BUSY" }),
      ),
    ).toBe("assistant.errors.rateLimited");
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("slow", { code: "MODEL_TIMEOUT" }),
      ),
    ).toBe("assistant.errors.timeout");
    // ANSWER_TIMEOUT is also a 504, but the evidence was gathered and only the write-up
    // ran out of time. It must not collapse into the generic "took too long" copy, which
    // tells the user nothing happened.
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("no time to write", {
          code: "ANSWER_TIMEOUT",
          status: 504,
        }),
      ),
    ).toBe("assistant.errors.answerTimeout");
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("bad model output", { code: "MODEL_OUTPUT_INVALID" }),
      ),
    ).toBe("assistant.errors.invalidResponse");
    // Truncation at our own output cap is not the model misbehaving, and must not be
    // reported as an invalid response.
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("cut off", { code: "ANSWER_TOO_LONG", status: 502 }),
      ),
    ).toBe("assistant.errors.answerTooLong");
  });

  it("uses offline and action-specific fallbacks", () => {
    expect(assistantErrorTranslationKey(new TypeError("fetch failed"), false, false))
      .toBe("assistant.errors.offline");
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("failed", { code: "ACTION_EXECUTION_FAILED" }),
        true,
      ),
    ).toBe("assistant.errors.actionFailed");
  });
});
