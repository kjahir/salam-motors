import type { StatusParams } from "./status.ts";
import type { AssistantTurn } from "./types.ts";

export const ASSISTANT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

export class AssistantHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AssistantHttpError";
  }
}

export interface PublicAssistantError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function toPublicError(error: unknown): {
  status: number;
  body: PublicAssistantError;
} {
  if (error instanceof AssistantHttpError) {
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
  console.error("assistant-turn unhandled error", error);
  return {
    status: 500,
    body: {
      error: {
        code: "ASSISTANT_FAILED",
        message: "The assistant could not complete this request.",
        retryable: true,
      },
    },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...ASSISTANT_CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function event(name: string, value: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
}

function answerChunks(text: string, targetLength = 96): string[] {
  const segments = text.match(/\S+\s*/gu) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const segment of segments) {
    if (current && current.length + segment.length > targetLength) {
      chunks.push(current);
      current = "";
    }
    current += segment;
  }
  if (current) chunks.push(current);
  return chunks;
}

export interface SseTurnResult {
  conversationId: string;
  turn: AssistantTurn;
  /**
   * The run this turn was recorded under. Returned so that a follow-up speech
   * synthesis call can attach its trace event to the same run — step 8 happens
   * after the turn has already returned, so the client is the only thing that can
   * correlate the two. Null when persistence was unavailable.
   */
  runId: string | null;
}

/** What a run may emit while it works. */
export interface SseTurnSink {
  /**
   * A status key, plus any values it interpolates. The client owns the wording — it holds
   * the translations — so nothing here is ever a finished sentence.
   */
  status: (messageKey: string, params?: StatusParams) => void;
  /**
   * Announces the run before any answer text. The client starts speaking on the first
   * delta and the speech call must name the run for the step-8 trace, so the run id has
   * to arrive first. Safe to call more than once; only the first call is sent.
   */
  meta: (value: { conversationId: string; runId: string | null }) => void;
  /** Answer text as the model writes it. */
  delta: (text: string) => void;
}

/**
 * Streams a turn as it is produced.
 *
 * Deltas are forwarded live from the model. If a run finishes without having emitted any —
 * a non-streaming model path, or a stream that failed over to the buffered request — the
 * finished answer is chunked and sent here instead, so the client sees the same event
 * sequence either way and there is no regression path.
 */
export function sseTurnResponse(
  run: (sink: SseTurnSink) => Promise<SseTurnResult>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let deltaSent = false;
      let metaSent = false;
      const write = (name: string, value: unknown): void => {
        if (!closed) controller.enqueue(encoder.encode(event(name, value)));
      };
      const sink: SseTurnSink = {
        status: (messageKey, params) =>
          write("status", {
            key: messageKey,
            message: messageKey,
            text: messageKey,
            params: params ?? null,
          }),
        meta: (value) => {
          if (metaSent) return;
          metaSent = true;
          write("meta", value);
        },
        delta: (text) => {
          if (!text) return;
          deltaSent = true;
          write("delta", { text });
        },
      };

      void (async () => {
        try {
          sink.status("assistant.status.starting");
          const result = await run(sink);
          sink.meta({
            conversationId: result.conversationId,
            runId: result.runId,
          });
          if (!deltaSent) {
            sink.status("assistant.status.finalizing");
            for (const text of answerChunks(result.turn.answer.text)) {
              write("delta", { text });
            }
          }
          write("turn", result);
          write("done", {
            conversationId: result.conversationId,
            turnId: result.turn.turnId,
          });
        } catch (error) {
          const publicError = toPublicError(error);
          write("error", {
            status: publicError.status,
            ...publicError.body.error,
          });
          write("done", { ok: false });
        } finally {
          closed = true;
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...ASSISTANT_CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}

