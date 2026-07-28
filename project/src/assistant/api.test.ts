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

import { requestAssistantTurn } from "./api";

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
  provenance: { asOf: "2026-07-27T12:00:00.000Z", sources: [{ entity: "vehicles", count: 3 }] },
};

describe("assistant API client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "signed-user-jwt" } },
    });
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

    expect(onStatus).toHaveBeenCalledWith("Searching inventory…");
    expect(onDelta).toHaveBeenCalledWith("Three vehicles");
    expect(response).toEqual({ conversationId: "conversation-1", turn });
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

  it("rejects calls without a current authenticated session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await expect(requestAssistantTurn(request)).rejects.toThrow("session has expired");
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
    await expect(requestAssistantTurn(request)).rejects.toThrow("Method not allowed");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(requestAssistantTurn(request)).rejects.toThrow("Too many requests");
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
});
