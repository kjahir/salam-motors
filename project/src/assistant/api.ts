import { supabase } from "@/lib/supabase";
import { parseAssistantTurn, type AssistantTurn, type AssistantTurnRequest, type AssistantTurnResponse } from "./schema";
import { AssistantApiError } from "./errors";

export interface AssistantStreamCallbacks {
  onStatus?: (text: string) => void;
  onDelta?: (text: string) => void;
  onTurn?: (turn: AssistantTurn) => void;
}

interface SseEvent {
  event: string;
  data: string;
}

function functionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    throw new AssistantApiError("Missing VITE_SUPABASE_URL.", { code: "CLIENT_CONFIGURATION_ERROR" });
  }
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/assistant-turn`;
}

function parseSseFrame(frame: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

function messageFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (
      typeof record.error === "object" && record.error !== null &&
      typeof (record.error as { message?: unknown }).message === "string"
    ) {
      return (record.error as { message: string }).message;
    }
    if (typeof record.message === "string") return record.message;
  }
  return "The assistant request failed.";
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function apiErrorFromUnknown(
  value: unknown,
  fallbackStatus: number | null,
  fallbackMessage = "The assistant request failed.",
): AssistantApiError {
  const envelope = recordFromUnknown(value);
  const nested = recordFromUnknown(envelope?.error);
  const details = nested ?? envelope;
  const embeddedStatus = Number(details?.status ?? envelope?.status);
  const status = Number.isInteger(embeddedStatus)
    ? embeddedStatus
    : fallbackStatus;
  const code = typeof details?.code === "string"
    ? details.code
    : "ASSISTANT_FAILED";
  const retryable = typeof details?.retryable === "boolean"
    ? details.retryable
    : false;
  const extractedMessage = messageFromUnknown(value);
  const message = extractedMessage === "The assistant request failed."
    ? fallbackMessage
    : extractedMessage;
  return new AssistantApiError(message, { code, status, retryable });
}

function validatedTurn(value: unknown): AssistantTurn {
  try {
    return parseAssistantTurn(value);
  } catch (error) {
    throw new AssistantApiError(
      error instanceof Error ? error.message : "The assistant returned an invalid response.",
      {
        code: "MODEL_OUTPUT_INVALID",
        status: 502,
        retryable: true,
      },
    );
  }
}

async function responseError(response: Response): Promise<AssistantApiError> {
  try {
    const body = await response.json();
    return apiErrorFromUnknown(body, response.status);
  } catch {
    return new AssistantApiError(`The assistant request failed (${response.status}).`, {
      code: "ASSISTANT_FAILED",
      status: response.status,
      retryable: response.status >= 500,
    });
  }
}

export async function requestAssistantTurn(
  request: AssistantTurnRequest,
  callbacks: AssistantStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<AssistantTurnResponse> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new AssistantApiError("Your session has expired. Please sign in again.", {
      code: "AUTH_REQUIRED",
      status: 401,
    });
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anonKey) {
    throw new AssistantApiError("Missing VITE_SUPABASE_ANON_KEY.", {
      code: "CLIENT_CONFIGURATION_ERROR",
    });
  }

  const response = await fetch(functionUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      Accept: request.stream === false ? "application/json" : "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) throw await responseError(response);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    let body: Partial<AssistantTurnResponse>;
    try {
      body = (await response.json()) as Partial<AssistantTurnResponse>;
    } catch {
      throw new AssistantApiError(
        "The assistant returned an invalid JSON response.",
        {
          code: "MODEL_OUTPUT_INVALID",
          status: 502,
          retryable: true,
        },
      );
    }
    const turn = validatedTurn(body.turn);
    return { conversationId: body.conversationId ?? turn.conversationId, turn };
  }

  if (!response.body) {
    throw new AssistantApiError("The assistant returned an empty stream.", {
      code: "MODEL_OUTPUT_INVALID",
      status: 502,
      retryable: true,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalTurn: AssistantTurn | null = null;
  let conversationId: string | undefined;

  const handleEvent = (item: SseEvent) => {
    if (item.event === "done") return;

    let payload: unknown = item.data;
    try {
      payload = JSON.parse(item.data);
    } catch {
      // A plain string delta is a valid, intentionally small SSE payload.
    }

    if (item.event === "status") {
      callbacks.onStatus?.(messageFromUnknown(payload));
      return;
    }
    if (item.event === "delta") {
      if (typeof payload === "string") callbacks.onDelta?.(payload);
      else if (typeof payload === "object" && payload !== null && typeof (payload as { text?: unknown }).text === "string") {
        callbacks.onDelta?.((payload as { text: string }).text);
      }
      return;
    }
    if (item.event === "turn" || item.event === "message") {
      const candidate =
        typeof payload === "object" && payload !== null && "turn" in payload
          ? (payload as { turn: unknown }).turn
          : payload;
      finalTurn = validatedTurn(candidate);
      conversationId =
        typeof payload === "object" && payload !== null && typeof (payload as { conversationId?: unknown }).conversationId === "string"
          ? (payload as { conversationId: string }).conversationId
          : finalTurn.conversationId;
      callbacks.onTurn?.(finalTurn);
      return;
    }
    if (item.event === "error") {
      throw apiErrorFromUnknown(payload, null);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) handleEvent(event);
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseFrame(buffer);
    if (event) handleEvent(event);
  }

  const completedTurn = finalTurn as AssistantTurn | null;
  if (!completedTurn) {
    throw new AssistantApiError(
      "The assistant stream ended before returning a complete answer.",
      {
        code: "MODEL_OUTPUT_INVALID",
        status: 502,
        retryable: true,
      },
    );
  }
  return { conversationId: conversationId ?? completedTurn.conversationId, turn: completedTurn };
}
