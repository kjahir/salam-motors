import type { InspectionItem } from "@/lib/types";

// The simple Pass/Fail/Pending quick-check model, mapped onto 6 of our real, weighted
// INSPECTION_CATEGORIES so the health-score ring stays accurate everywhere — several real
// categories have no SCORE_WEIGHTS entry and were excluded. Shared by the mobile
// Inspection tab / Add Inspection page and their desktop counterparts, which render it
// with their own tokens but must agree on the categories and scoring.
export const QUICK_CHECK_CATEGORIES = ["Engine", "Brakes", "Tyres", "Suspension", "Frame and chassis", "Transmission and clutch"];

export type CheckStatus = "pass" | "fail" | "pending";

export const CHECK_STATUS_SCORE: Record<CheckStatus, { score: number | null; condition: string }> = {
  pass: { score: 90, condition: "Good" },
  fail: { score: 30, condition: "Poor" },
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
