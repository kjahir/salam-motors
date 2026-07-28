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
    </>
  );
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
