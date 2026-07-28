import { describe, expect, it } from "vitest";
import {
  ASSISTANT_SCHEMA_VERSION,
  createFallbackTurn,
  isAssistantTurn,
  parseAssistantTurn,
  type AssistantTurn,
} from "./schema";

function validTurn(): AssistantTurn {
  return {
    schemaVersion: ASSISTANT_SCHEMA_VERSION,
    turnId: "turn-1",
    conversationId: "conversation-1",
    locale: "en-IN",
    answer: { text: "Two vehicles need attention.", tone: "warning" },
    blocks: [
      {
        type: "metric_grid",
        items: [{ label: "Critical alerts", value: 2, format: "number", tone: "danger" }],
      },
      {
        type: "vehicle_collection",
        items: [],
        shown: 0,
        total: 0,
      },
    ],
    followUps: [{ kind: "reply", label: "Explain why", message: "Explain the two alerts" }],
    provenance: {
      asOf: "2026-07-27T12:00:00.000Z",
      sources: [{ entity: "alerts", count: 2 }],
      filters: { status: "Open" },
    },
  };
}

describe("assistant turn contract", () => {
  it("accepts a versioned structured turn", () => {
    const turn = validTurn();
    expect(isAssistantTurn(turn)).toBe(true);
    expect(parseAssistantTurn(turn)).toEqual(turn);
  });

  it("rejects unknown schema versions and block types", () => {
    expect(isAssistantTurn({ ...validTurn(), schemaVersion: "2.0" })).toBe(false);
    expect(
      isAssistantTurn({
        ...validTurn(),
        blocks: [{ type: "unsafe_html", html: "<script>alert(1)</script>" }],
      }),
    ).toBe(false);
  });

  it("rejects structurally incomplete and oversized blocks", () => {
    expect(isAssistantTurn({ ...validTurn(), blocks: [{ type: "vehicle_collection" }] })).toBe(false);
    expect(
      isAssistantTurn({
        ...validTurn(),
        blocks: [{ type: "metric_grid", items: Array.from({ length: 25 }, () => ({ label: "x", value: 1 })) }],
      }),
    ).toBe(false);
  });

  it("creates a safe plain-text fallback turn", () => {
    const fallback = createFallbackTurn("Please retry.", "ta-IN", "danger");
    expect(fallback.answer).toEqual({ text: "Please retry.", tone: "danger" });
    expect(fallback.blocks).toEqual([]);
    expect(fallback.provenance.sources).toEqual([]);
  });
});
