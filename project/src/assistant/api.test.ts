import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_SCHEMA_VERSION, type AssistantTurnRequest } from "./schema";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { requestAssistantTurn, transcribeAssistantAudio } from "./api";
import { AssistantApiError } from "./errors";

const request: AssistantTurnRequest = {
  message: "Show ageing inventory",
  locale: "en-IN",
  context: { surface: "desktop", page: "inventory" },
  stream: true,
};

const turn = {
  schemaVersion: ASSISTANT_SCHEMA_VERSION,
  turnId: "turn-1",
  conversationId: "conversation-1",
  locale: "en-IN",
  answer: { text: "Three vehicles are over 30 days old." },
  blocks: [],
  provenance: {
    asOf: "2026-07-27T12:00:00.000Z",
    sources: [{ entity: "vehicles", count: 3 }],
  },
};

describe("assistant API client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "signed-user-jwt" } },
    });
  });

  it("surfaces the run id from the SSE meta frame before the first delta", async () => {
    // The server sends `meta` ahead of the deltas precisely so that spoken playback —
    // which starts on the first delta — can name the run it belongs to for the step-8
    // trace entry. If this ordering regresses, speech synthesis silently stops being
    // traceable, so the assertion is on the ordering, not just the value.
    const seen: string[] = [];
    const payload = [
      'event: status\ndata: {"message":"Searching inventory…"}',
      `event: meta\ndata: ${JSON.stringify({ conversationId: "conversation-1", runId: "run-9" })}`,
      'event: delta\ndata: {"text":"Three vehicles"}',
      `event: turn\ndata: ${JSON.stringify({ conversationId: "conversation-1", turn })}`,
      "event: done\ndata: {}",
      "",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(payload, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );

    const response = await requestAssistantTurn(request, {
      onMeta: (meta) => seen.push(`meta:${meta.runId}`),
      onDelta: () => seen.push("delta"),
    });

    expect(seen).toEqual(["meta:run-9", "delta"]);
    expect(response.runId).toBe("run-9");
  });

  it("parses named SSE status, delta, turn, and done events", async () => {
    const payload = [
      'event: status\ndata: {"message":"Searching inventory…"}',
      'event: delta\ndata: {"text":"Three vehicles"}',
      `event: turn\ndata: ${JSON.stringify({ conversationId: "conversation-1", turn })}`,
      "event: done\ndata: {}",
      "",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(payload, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    const onStatus = vi.fn();
    const onDelta = vi.fn();

    const response = await requestAssistantTurn(request, { onStatus, onDelta });

    expect(onStatus).toHaveBeenCalledWith("Searching inventory…", undefined);
    expect(onDelta).toHaveBeenCalledWith("Three vehicles");
    // No `meta` frame in this stream, so there is no run to attribute a spoken reply to.
    expect(response).toEqual({ conversationId: "conversation-1", turn, runId: null });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/assistant-turn",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-user-jwt",
          apikey: "anon-key",
        }),
      }),
    );
  });

  it("forwards status interpolation values, dropping anything unprintable", async () => {
    const payload = [
      'event: status\ndata: {"key":"assistant.status.tool.inventoryQuery","message":"assistant.status.tool.inventoryQuery","params":{"query":"Swift","count":3,"junk":{"nested":true},"missing":null}}',
      'event: status\ndata: {"message":"assistant.status.tool.inventory","params":null}',
      `event: turn\ndata: ${JSON.stringify({ conversationId: "conversation-1", turn })}`,
      "event: done\ndata: {}",
      "",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(payload, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    const onStatus = vi.fn();

    await requestAssistantTurn(request, { onStatus });

    expect(onStatus).toHaveBeenNthCalledWith(
      1,
      "assistant.status.tool.inventoryQuery",
      { query: "Swift", count: 3 },
    );
    // A status with no values must not hand i18next an empty object to interpolate with.
    expect(onStatus).toHaveBeenNthCalledWith(
      2,
      "assistant.status.tool.inventory",
      undefined,
    );
  });

  it("sends recorded audio to the authenticated transcription function", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          text: "\u0ba4\u0bae\u0bbf\u0bb4\u0bbf\u0bb2\u0bcd \u0bb5\u0bbe\u0b95\u0ba9\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1",
          locale: "ta-IN",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const text = await transcribeAssistantAudio(
      new Blob(["recorded-audio"], { type: "audio/webm" }),
    );

    expect(text).toEqual({
      text: "\u0ba4\u0bae\u0bbf\u0bb4\u0bbf\u0bb2\u0bcd \u0bb5\u0bbe\u0b95\u0ba9\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1",
      locale: "ta-IN",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/assistant-transcribe",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer signed-user-jwt",
          apikey: "anon-key",
        },
        body: expect.any(FormData),
      }),
    );
    const options = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(options?.headers).not.toHaveProperty("Content-Type");
  });

  it("requests authenticated speech audio in the spoken language", async () => {
    const speech = new Blob(["mp3-audio"], { type: "audio/mpeg" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(speech, {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        }),
      ),
    );

    const { synthesizeAssistantSpeech } = await import("./api");
    const result = await synthesizeAssistantSpeech("\u0909\u0924\u094d\u0924\u0930 \u0924\u0948\u092f\u093e\u0930 \u0939\u0948", "hi-IN");

    expect(result.size).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/assistant-speech",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-user-jwt",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ text: "\u0909\u0924\u094d\u0924\u0930 \u0924\u0948\u092f\u093e\u0930 \u0939\u0948", locale: "hi-IN" }),
      }),
    );
  });

  it("rejects calls without a current authenticated session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await expect(requestAssistantTurn(request)).rejects.toThrow(
      "session has expired",
    );
  });

  it("preserves backend error metadata for localized presentation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "ASSISTANT_BUSY",
              message: "The assistant is receiving too many requests.",
              retryable: true,
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    try {
      await requestAssistantTurn(request);
      throw new Error("expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AssistantApiError);
      expect(error).toMatchObject({
        code: "ASSISTANT_BUSY",
        status: 429,
        retryable: true,
      });
    }
  });

  it("surfaces the message from the backend's nested error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "CONVERSATION_NOT_FOUND",
              message: "That assistant conversation is not available.",
              retryable: false,
            },
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(requestAssistantTurn(request)).rejects.toThrow(
      "That assistant conversation is not available.",
    );
  });

  it("still surfaces plain-string and top-level error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(requestAssistantTurn(request)).rejects.toThrow(
      "Method not allowed",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(requestAssistantTurn(request)).rejects.toThrow(
      "Too many requests",
    );
  });

  it("preserves metadata from an SSE error event", async () => {
    const payload = [
      'event: error\ndata: {"status":504,"code":"MODEL_TIMEOUT","message":"Too slow","retryable":true}',
      "event: done\ndata: {}",
      "",
    ].join("\n\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(payload, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    await expect(requestAssistantTurn(request)).rejects.toMatchObject({
      code: "MODEL_TIMEOUT",
      status: 504,
      retryable: true,
    });
  });

  it("falls back to a generic message for unparseable error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Bad gateway</html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(requestAssistantTurn(request)).rejects.toThrow(
      "The assistant request failed (502).",
    );
  });

  it("classifies an invalid successful JSON response for localization", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>not JSON</html>", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(requestAssistantTurn(request)).rejects.toMatchObject({
      code: "MODEL_OUTPUT_INVALID",
      status: 502,
      retryable: true,
    });
  });
});
