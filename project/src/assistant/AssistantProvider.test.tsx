import i18n from "@/i18n";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantTurnResponse } from "./schema";

const mocks = vi.hoisted(() => ({
  requestAssistantTurn: vi.fn(),
  auth: {
    user: { id: "user-1" },
    role: "owner",
    membership: { id: "membership-1", status: "active" },
    partner: null,
    orgId: "org-1",
  },
}));

vi.mock("@/lib/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("./api", () => ({
  requestAssistantTurn: mocks.requestAssistantTurn,
}));

import { AssistantProvider, useAssistant } from "./AssistantProvider";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(conversationId: string): AssistantTurnResponse {
  return {
    conversationId,
    turn: {
      schemaVersion: "1.0",
      turnId: "turn-1",
      conversationId,
      locale: "en-IN",
      answer: { text: "Done" },
      blocks: [],
      provenance: {
        asOf: "2026-07-29T00:00:00.000Z",
        sources: [],
      },
    },
  };
}

function Harness() {
  const assistant = useAssistant();
  return (
    <>
      <button onClick={() => void assistant.sendMessage("hello")}>Send</button>
      <button onClick={() => void assistant.sendMessage("vanakkam", { locale: "ta-IN" })}>
        Tamil voice
      </button>
      <button
        onClick={() => {
          void assistant.sendMessage("first");
          void assistant.sendMessage("second");
        }}
      >
        Burst
      </button>
      <button onClick={assistant.clearConversation}>Clear</button>
      <output data-testid="conversation">{assistant.conversationId ?? ""}</output>
      <output data-testid="messages">{assistant.messages.length}</output>
      <output data-testid="status">{assistant.statusText}</output>
      <output data-testid="status-key">{assistant.statusKey}</output>
    </>
  );
}

function onStatusOf(call: number) {
  return mocks.requestAssistantTurn.mock.calls[call][1].onStatus as (
    text: string,
    params?: Record<string, string | number>,
  ) => void;
}

function renderProvider() {
  return render(
    <AssistantProvider>
      <Harness />
    </AssistantProvider>,
  );
}

describe("AssistantProvider request ownership", () => {
  beforeEach(() => {
    mocks.requestAssistantTurn.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not restore a cleared conversation when a stale request resolves", async () => {
    const pending = deferred<AssistantTurnResponse>();
    mocks.requestAssistantTurn.mockReturnValueOnce(pending.promise);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(mocks.requestAssistantTurn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await act(async () => {
      pending.resolve(response("stale-conversation"));
      await pending.promise;
    });

    expect(screen.getByTestId("conversation")).toHaveTextContent("");
    expect(screen.getByTestId("messages")).toHaveTextContent("0");
  });

  it("rejects same-tick duplicate sends before React state catches up", () => {
    const pending = deferred<AssistantTurnResponse>();
    mocks.requestAssistantTurn.mockReturnValue(pending.promise);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Burst" }));

    expect(mocks.requestAssistantTurn).toHaveBeenCalledTimes(1);
    const firstRequest = mocks.requestAssistantTurn.mock.calls[0][0];
    expect(firstRequest.message).toBe("first");
  });

  it("uses the detected spoken locale without changing the UI language", async () => {
    mocks.requestAssistantTurn.mockResolvedValue(response("tamil-conversation"));
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Tamil voice" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.requestAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ message: "vanakkam", locale: "ta-IN" }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("writes the status locally from the key and values the server sent", async () => {
    const pending = deferred<AssistantTurnResponse>();
    mocks.requestAssistantTurn.mockReturnValueOnce(pending.promise);
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const { onStatus } = mocks.requestAssistantTurn.mock.calls[0][1];
    // Each status is given the floor before the next one, so this reads what the caller
    // would actually see rather than only the last frame.
    const show = (text: string, params?: Record<string, string | number>) =>
      act(() => {
        onStatus(text, params);
        vi.advanceTimersByTime(600);
      });

    vi.useFakeTimers();
    try {
      show("assistant.status.tool.inventoryQuery", { query: "Swift" });
      expect(screen.getByTestId("status")).toHaveTextContent("Looking for “Swift” in stock…");
      // The key is kept alongside the copy so the shell can pick an icon without matching
      // on translated prose.
      expect(screen.getByTestId("status-key")).toHaveTextContent(
        "assistant.status.tool.inventoryQuery",
      );

      show("assistant.status.tool.found", { count: 3 });
      expect(screen.getByTestId("status")).toHaveTextContent("Found 3 matches");
      show("assistant.status.tool.found", { count: 1 });
      expect(screen.getByTestId("status")).toHaveTextContent("Found 1 match — reading it now…");

      // A backend that still sends prose is shown as-is, with no key to style it by.
      show("Searching dealership records…");
      expect(screen.getByTestId("status")).toHaveTextContent("Searching dealership records…");
      expect(screen.getByTestId("status-key")).toHaveTextContent("");
    } finally {
      vi.useRealTimers();
    }

    await act(async () => {
      pending.resolve(response("status-conversation"));
      await pending.promise;
    });
    expect(screen.getByTestId("status")).toHaveTextContent("");
  });

  it("holds a status on screen long enough to be read", async () => {
    vi.useFakeTimers();
    try {
      const pending = deferred<AssistantTurnResponse>();
      mocks.requestAssistantTurn.mockReturnValueOnce(pending.promise);
      renderProvider();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(screen.getByTestId("status")).toHaveTextContent("Understanding your request…");

      // The search, its result, and the next model round all report within a few
      // milliseconds of each other.
      act(() => {
        onStatusOf(0)("assistant.status.tool.inventory");
        onStatusOf(0)("assistant.status.tool.found", { count: 4 });
        onStatusOf(0)("assistant.status.reviewing");
      });
      expect(screen.getByTestId("status")).toHaveTextContent("Understanding your request…");

      // Each one still gets its turn on screen, in order, rather than the last writer
      // winning and the count never being seen.
      act(() => void vi.advanceTimersByTime(600));
      expect(screen.getByTestId("status")).toHaveTextContent("Going through the vehicle list…");
      act(() => void vi.advanceTimersByTime(600));
      expect(screen.getByTestId("status")).toHaveTextContent("Found 4 matches");
      act(() => void vi.advanceTimersByTime(600));
      expect(screen.getByTestId("status")).toHaveTextContent("Reading what came back…");

      // Caught up: a status arriving after the quiet period shows immediately.
      act(() => void vi.advanceTimersByTime(600));
      act(() => onStatusOf(0)("assistant.status.tool.finance"));
      expect(screen.getByTestId("status")).toHaveTextContent(
        "Adding up purchases, sales, and expenses…",
      );

      // A finished turn drops whatever was still queued behind it.
      act(() => {
        onStatusOf(0)("assistant.status.tool.documents");
        onStatusOf(0)("assistant.status.tool.listings");
      });
      await act(async () => {
        pending.resolve(response("queued-conversation"));
        await pending.promise;
      });
      act(() => void vi.advanceTimersByTime(2_000));
      expect(screen.getByTestId("status")).toHaveTextContent("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts a clean conversation when the selected language changes", async () => {
    mocks.requestAssistantTurn.mockResolvedValue(response("english-conversation"));
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("conversation")).toHaveTextContent("english-conversation");
    expect(screen.getByTestId("messages")).toHaveTextContent("2");

    await act(async () => {
      await i18n.changeLanguage("ta");
    });

    expect(screen.getByTestId("conversation")).toHaveTextContent("");
    expect(screen.getByTestId("messages")).toHaveTextContent("0");
    await i18n.changeLanguage("en");
  });
});
