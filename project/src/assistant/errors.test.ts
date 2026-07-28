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
    expect(
      assistantErrorTranslationKey(
        new AssistantApiError("bad model output", { code: "MODEL_OUTPUT_INVALID" }),
      ),
    ).toBe("assistant.errors.invalidResponse");
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
