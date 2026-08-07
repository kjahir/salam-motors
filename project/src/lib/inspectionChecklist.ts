import type { InspectionItem } from "@/lib/types";

// The simple Pass/Fail/Pending quick-check model, mapped onto 6 of our real, weighted
// INSPECTION_CATEGORIES so the health-score ring stays accurate everywhere — several real
// categories have no SCORE_WEIGHTS entry and were excluded. Shared by the mobile
// Inspection tab / Add Inspection page and their desktop counterparts, which render it
// with their own tokens but must agree on the categories and scoring.
export const QUICK_CHECK_CATEGORIES = ["Engine", "Brakes", "Tyres", "Suspension", "Frame and chassis", "Transmission and clutch"];

export type CheckStatus = "pass" | "fail" | "pending";

/**
 * Pass is a full 100 and fail a flat 0, so the weighted average in computeOverallScore()
 * behaves the way the checklist reads: pass everything and the vehicle scores 100%, and a
 * failed item costs exactly its own weight. The previous 90/30 pair meant an all-pass
 * vehicle capped out at 90% (nothing was ever "healthy"), while a fail still contributed 30
 * points of credit and so barely moved the ring.
 *
 * `pending` scores null rather than 0 — an item nobody has looked at yet is excluded from
 * both sides of the average by computeOverallScore(), so an unfinished checklist reports the
 * score of what has actually been checked instead of being punished for the gaps.
 */
export const CHECK_STATUS_SCORE: Record<CheckStatus, { score: number | null; condition: string }> = {
  pass: { score: 100, condition: "Good" },
  fail: { score: 0, condition: "Poor" },
  pending: { score: null, condition: "Not inspected" },
};

export function statusOf(item: InspectionItem): CheckStatus {
  if (item.condition_level === "Good") return "pass";
  if (item.condition_level === "Poor") return "fail";
  return "pending";
}

export function nextStatus(s: CheckStatus): CheckStatus {
  if (s === "pending") return "pass";
  if (s === "pass") return "fail";
  return "pending";
}
