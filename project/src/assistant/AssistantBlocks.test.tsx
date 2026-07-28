import "@/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantTurnView } from "./AssistantBlocks";
import { ASSISTANT_SCHEMA_VERSION, type AssistantAction, type AssistantTurn } from "./schema";

const mocks = vi.hoisted(() => ({
  handleAction: vi.fn<(action: AssistantAction) => Promise<void>>(),
  retryLast: vi.fn<() => Promise<void>>(),
}));

vi.mock("./AssistantProvider", () => ({
  useAssistant: () => ({
    handleAction: mocks.handleAction,
    retryLast: mocks.retryLast,
    isBusy: false,
  }),
}));

function confirmationTurn(answer = "Review the proposed sale."): AssistantTurn {
  return {
    schemaVersion: ASSISTANT_SCHEMA_VERSION,
    turnId: "turn-1",
    conversationId: "conversation-1",
    locale: "en-IN",
    answer: { text: answer, tone: "warning" },
    blocks: [
      {
        type: "confirmation",
        title: "Complete sale",
        summary: "This records a completed sale and partner distributions.",
        risk: "critical",
        changes: [{ label: "Sale price", to: 125_000 }],
        confirm: {
          kind: "invoke",
          label: "Confirm sale",
          actionToken: "opaque-token",
          risk: "critical",
        },
        expiresAt: "2026-07-27T13:00:00.000Z",
      },
    ],
    provenance: {
      asOf: "2026-07-27T12:00:00.000Z",
      sources: [{ entity: "vehicles", id: "vehicle-1", count: 1 }],
    },
  };
}

describe("structured assistant result rendering", () => {
  beforeEach(() => {
    cleanup();
    mocks.handleAction.mockReset();
    mocks.handleAction.mockResolvedValue();
  });

  it("renders model text as plain text rather than executable HTML", () => {
    const { container } = render(
      <AssistantTurnView turn={confirmationTurn("<script>window.bad = true</script>")} />,
    );
    expect(screen.getByText("<script>window.bad = true</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("requires an explicit acknowledgement before a critical action", async () => {
    const user = userEvent.setup();
    render(<AssistantTurnView turn={confirmationTurn()} />);

    const confirm = screen.getByRole("button", { name: "Confirm sale" });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(mocks.handleAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "invoke",
        actionToken: "opaque-token",
        risk: "critical",
      }),
    );
  });
});
