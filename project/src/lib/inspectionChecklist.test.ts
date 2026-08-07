import { describe, it, expect } from "vitest";
import { computeOverallScore } from "./calc";
import { SCORE_WEIGHTS } from "./constants";
import { CHECK_STATUS_SCORE, QUICK_CHECK_CATEGORIES, nextStatus, statusOf, type CheckStatus } from "./inspectionChecklist";
import type { InspectionItem } from "./types";

/**
 * The quick-check screens (MobileInspectionTab, MobileAddInspection, QuickAddInspection)
 * only ever write CHECK_STATUS_SCORE values, so what a dealer sees on the health ring is
 * entirely decided by those three numbers feeding computeOverallScore(). These tests pin
 * the behaviour the checklist visually promises, which the old 90/30 scores did not deliver.
 */
const checklistItems = (statuses: Record<string, CheckStatus>): Pick<InspectionItem, "category" | "score" | "weight">[] =>
  QUICK_CHECK_CATEGORIES.map((category) => ({
    category,
    score: CHECK_STATUS_SCORE[statuses[category]].score,
    weight: SCORE_WEIGHTS[category] ?? 0,
  }));

const allOf = (status: CheckStatus) => Object.fromEntries(QUICK_CHECK_CATEGORIES.map((c) => [c, status]));

describe("quick-check scoring", () => {
  it("scores 100% when every item passes", () => {
    expect(computeOverallScore(checklistItems(allOf("pass")))).toBe(100);
  });

  it("scores 0% when every item fails", () => {
    expect(computeOverallScore(checklistItems(allOf("fail")))).toBe(0);
  });

  it("docks a failed item exactly its own share of the weight", () => {
    const statuses = { ...allOf("pass"), Suspension: "fail" as CheckStatus };
    const totalWeight = QUICK_CHECK_CATEGORIES.reduce((s, c) => s + (SCORE_WEIGHTS[c] ?? 0), 0);
    const expected = Math.round(((totalWeight - SCORE_WEIGHTS.Suspension) / totalWeight) * 100);

    expect(computeOverallScore(checklistItems(statuses))).toBe(expected);
    // A heavier component must cost more than a lighter one.
    const engineFailed = { ...allOf("pass"), Engine: "fail" as CheckStatus };
    expect(computeOverallScore(checklistItems(engineFailed))!).toBeLessThan(computeOverallScore(checklistItems(statuses))!);
  });

  it("leaves items still under review out of the average entirely", () => {
    // Engine (weight 25) unreviewed, everything else passed: the score reflects only what
    // has actually been checked, so it stays 100 rather than being dragged down by a gap.
    const statuses = { ...allOf("pass"), Engine: "pending" as CheckStatus };
    expect(computeOverallScore(checklistItems(statuses))).toBe(100);

    // ...and a review item does not rescue a failure either.
    const withFail = { ...statuses, Brakes: "fail" as CheckStatus };
    expect(computeOverallScore(checklistItems(withFail))!).toBeLessThan(100);
  });

  it("reports no score at all while nothing has been reviewed", () => {
    expect(computeOverallScore(checklistItems(allOf("pending")))).toBeNull();
  });

  it("gives every quick-check category a non-zero weight, so no tap is silently ignored", () => {
    for (const category of QUICK_CHECK_CATEGORIES) {
      expect(SCORE_WEIGHTS[category] ?? 0).toBeGreaterThan(0);
    }
  });

  it("round-trips a status through the stored condition_level", () => {
    for (const status of ["pass", "fail", "pending"] as CheckStatus[]) {
      const stored = { condition_level: CHECK_STATUS_SCORE[status].condition } as InspectionItem;
      expect(statusOf(stored)).toBe(status);
    }
  });

  it("cycles pending -> pass -> fail -> pending", () => {
    expect(nextStatus("pending")).toBe("pass");
    expect(nextStatus("pass")).toBe("fail");
    expect(nextStatus("fail")).toBe("pending");
  });
});
