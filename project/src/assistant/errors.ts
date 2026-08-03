export interface AssistantApiErrorOptions {
  code?: string;
  status?: number | null;
  retryable?: boolean;
}

export class AssistantApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: AssistantApiErrorOptions = {}) {
    super(message);
    this.name = "AssistantApiError";
    this.code = options.code ?? "ASSISTANT_FAILED";
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export type AssistantErrorTranslationKey =
  | "assistant.errors.generic"
  | "assistant.errors.offline"
  | "assistant.errors.sessionExpired"
  | "assistant.errors.invalidResponse"
  | "assistant.errors.notAuthorized"
  | "assistant.errors.rateLimited"
  | "assistant.errors.timeout"
  | "assistant.errors.answerTimeout"
  | "assistant.errors.answerTooLong"
  | "assistant.errors.actionFailed";

const SESSION_CODES = new Set(["AUTH_REQUIRED", "INVALID_SESSION", "JWT_EXPIRED"]);
const AUTHORIZATION_CODES = new Set([
  "ACCESS_CONTEXT_UNAVAILABLE",
  "ACCESS_DENIED",
  "CAPABILITY_DENIED",
  "INVALID_ACCESS_CONTEXT",
  "ORG_ACCESS_DENIED",
  "ORG_SELECTION_REQUIRED",
  "TOOL_NOT_AUTHORIZED",
  "ACTION_FORBIDDEN",
  "ACTION_PRINCIPAL_MISMATCH",
  "ACTION_ROLE_DENIED",
]);
const INVALID_RESPONSE_CODES = new Set([
  "MODEL_OUTPUT_INVALID",
  "ASSISTANT_RESPONSE_INVALID",
]);

export function assistantErrorTranslationKey(
  error: unknown,
  action = false,
  online = typeof navigator === "undefined" || navigator.onLine,
): AssistantErrorTranslationKey {
  if (!online) return "assistant.errors.offline";
  if (!(error instanceof AssistantApiError)) {
    return action ? "assistant.errors.actionFailed" : "assistant.errors.generic";
  }

  if (SESSION_CODES.has(error.code) || error.status === 401) {
    return "assistant.errors.sessionExpired";
  }
  if (AUTHORIZATION_CODES.has(error.code) || error.status === 403) {
    return "assistant.errors.notAuthorized";
  }
  if (error.code === "ASSISTANT_BUSY" || error.status === 429) {
    return "assistant.errors.rateLimited";
  }
  // Checked before the general timeout: ANSWER_TIMEOUT is also a 504, but the assistant
  // had already gathered the evidence and only ran out of time writing it up. "Took too
  // long, try again" reads as nothing happened, which sends people back to a question the
  // assistant was seconds from answering.
  if (error.code === "ANSWER_TIMEOUT") {
    return "assistant.errors.answerTimeout";
  }
  if (error.code === "MODEL_TIMEOUT" || error.status === 408 || error.status === 504) {
    return "assistant.errors.timeout";
  }
  // Distinct from invalidResponse: the answer was well-formed, just longer than one turn
  // can return. "The assistant returned an invalid response" blames the model for our cap.
  if (error.code === "ANSWER_TOO_LONG") {
    return "assistant.errors.answerTooLong";
  }
  if (INVALID_RESPONSE_CODES.has(error.code)) {
    return "assistant.errors.invalidResponse";
  }
  if (action || error.code.startsWith("ACTION_")) {
    return "assistant.errors.actionFailed";
  }
  return "assistant.errors.generic";
}
