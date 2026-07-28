import { supabase } from "@/lib/supabase";
import { parseAssistantTurn, type AssistantTurn, type AssistantTurnRequest, type AssistantTurnResponse } from "./schema";

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
  if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL.");
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

async function responseError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(messageFromUnknown(body));
  } catch {
    return new Error(`The assistant request failed (${response.status}).`);
  }
}

export async function requestAssistantTurn(
  request: AssistantTurnRequest,
  callbacks: AssistantStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<AssistantTurnResponse> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anonKey) throw new Error("Missing VITE_SUPABASE_ANON_KEY.");

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
    const body = (await response.json()) as Partial<AssistantTurnResponse>;
    const turn = parseAssistantTurn(body.turn);
    return { conversationId: body.conversationId ?? turn.conversationId, turn };
  }

  if (!response.body) throw new Error("The assistant returned an empty stream.");

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
      finalTurn = parseAssistantTurn(candidate);
      conversationId =
        typeof payload === "object" && payload !== null && typeof (payload as { conversationId?: unknown }).conversationId === "string"
          ? (payload as { conversationId: string }).conversationId
          : finalTurn.conversationId;
      callbacks.onTurn?.(finalTurn);
      return;
    }
    if (item.event === "error") throw new Error(messageFromUnknown(payload));
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
  if (!completedTurn) throw new Error("The assistant stream ended before returning a complete answer.");
  return { conversationId: conversationId ?? completedTurn.conversationId, turn: completedTurn };
}
