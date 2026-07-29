// HTTP plumbing shared by every protean-* edge function. Deliberately mirrors
// ../assistant/http.ts's shape (error class, CORS headers, jsonResponse,
// toPublicError) rather than importing it — the assistant module is scoped
// to the assistant's own error taxonomy and streaming response format,
// which doesn't apply here.

export const PROTEAN_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

export class ProteanHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProteanHttpError";
  }
}

export interface PublicProteanError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function toPublicError(error: unknown): {
  status: number;
  body: PublicProteanError;
} {
  if (error instanceof ProteanHttpError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
    };
  }
  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_JSON",
          message: "The request body must contain valid JSON.",
          retryable: false,
        },
      },
    };
  }
  console.error("protean function unhandled error", error);
  return {
    status: 500,
    body: {
      error: {
        code: "PROTEAN_REQUEST_FAILED",
        message: "The request could not be completed.",
        retryable: true,
      },
    },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PROTEAN_CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
