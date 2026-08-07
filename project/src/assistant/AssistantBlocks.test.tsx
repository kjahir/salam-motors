import "@/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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

  const vehicleWithoutAlerts = {
    id: "vehicle-1",
    stockNumber: "BIKE-2026-000004",
    registrationNumber: null,
    manufacturer: "HERO",
    model: "PASSION PLUS",
    variant: null,
    status: "PURCHASED",
    daysInStock: 12,
    totalCost: 51_000,
    alertCount: 0,
    complianceCount: 0,
    complianceSeverity: null,
    actions: [],
  };

  function collectionTurn(items: unknown[]): AssistantTurn {
    return {
      schemaVersion: ASSISTANT_SCHEMA_VERSION,
      turnId: "turn-2",
      locale: "en-IN",
      answer: { text: "Highest capital commitments.", tone: "info" },
      blocks: [{ type: "vehicle_collection", title: "Stock", items }],
      provenance: { asOf: "2026-07-31T03:41:46.000Z", sources: [{ entity: "vehicles", count: 11 }] },
    } as unknown as AssistantTurn;
  }

  it("contains a throwing block instead of taking the surrounding page down with it", () => {
    // A null status passes the client's shape-only validator, then StatusBadge calls
    // status.replace(...) - the class of failure the boundary exists to absorb.
    expect(() =>
      render(
        <div>
          <p>page behind the assistant</p>
          <ErrorBoundary label="test" fallback={<p>This result could not be displayed</p>}>
            <AssistantTurnView turn={collectionTurn([{ ...vehicleWithoutAlerts, status: null }])} />
          </ErrorBoundary>
        </div>,
      ),
    ).not.toThrow();
    expect(screen.getByText("This result could not be displayed")).toBeInTheDocument();
    expect(screen.getByText("page behind the assistant")).toBeInTheDocument();
  });

  it("does not print a stray count on a vehicle card with no alerts", () => {
    const { container } = render(<AssistantTurnView turn={collectionTurn([vehicleWithoutAlerts])} />);
    expect(container.textContent).toMatch(/12 days/);
    expect(container.textContent).not.toMatch(/12 days0/);
  });
});
