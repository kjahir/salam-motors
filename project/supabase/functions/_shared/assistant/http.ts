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
}

/**
 * Streams live status events while work runs. `delta` events are deliberately
 * emitted only after the final structured turn passes validation, so they are
 * buffered presentation chunks rather than upstream model-token streaming.
 */
export function sseTurnResponse(
  run: (
    emitStatus: (messageKey: string) => void,
  ) => Promise<SseTurnResult>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (name: string, value: unknown): void => {
        if (!closed) controller.enqueue(encoder.encode(event(name, value)));
      };
      const emitStatus = (messageKey: string): void => {
        write("status", {
          key: messageKey,
          message: messageKey,
          text: messageKey,
        });
      };

      void (async () => {
        try {
          emitStatus("assistant.status.starting");
          const result = await run(emitStatus);
          emitStatus("assistant.status.finalizing");
          for (const text of answerChunks(result.turn.answer.text)) {
            write("delta", { text });
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

