import type { ReactNode } from "react";
import { COMPLIANCE_BANDS } from "@/lib/constants";

type Color = "brand" | "emerald" | "green" | "blue" | "amber" | "orange" | "red" | "slate" | "purple";

const colorMap: Record<Color, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  green: "bg-green-50 text-green-700 ring-green-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-600/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
};
interface BadgeProps {
  color?: Color;
  children: ReactNode;
  className?: string;
}

export function Badge({ color = "slate", children, className = "" }: BadgeProps) {
  return <span className={`badge ring-1 ring-inset ${colorMap[color]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Color> = {
    DRAFT: "slate",
    PURCHASE_PENDING: "amber",
    PURCHASED: "blue",
    IN_TRANSIT: "blue",
    IN_YARD: "blue",
    UNDER_INSPECTION: "amber",
    UNDER_REPAIR: "orange",
    READY_FOR_SALE: "emerald",
    RESERVED: "brand",
    SOLD: "green",
    DELIVERED: "green",
    CANCELLED: "slate",
    RETURNED: "red",
    WRITTEN_OFF: "red",
  };
  return <Badge color={map[status] ?? "slate"}>{status.replace(/_/g, " ")}</Badge>;
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-slate-400 text-sm">—</span>;
  let color: Color = "red";
  let label = "High Risk";
  if (score >= 90) { color = "emerald"; label = "Excellent"; }
  else if (score >= 80) { color = "green"; label = "Very Good"; }
  else if (score >= 70) { color = "blue"; label = "Good"; }
  else if (score >= 60) { color = "amber"; label = "Fair"; }
  else if (score >= 40) { color = "orange"; label = "Poor"; }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`badge ring-1 ring-inset ${colorMap[color]} font-mono font-semibold`}>{score}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

export function AgeingBadge({ days }: { days: number }) {
  let color: Color = "emerald";
  let label = "Normal";
  if (days >= 60) { color = "red"; label = "Breach"; }
  else if (days >= 45) { color = "orange"; label = "High priority"; }
  else if (days >= 30) { color = "amber"; label = "Attention"; }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`badge ring-1 ring-inset ${colorMap[color]}`}>{days}d</span>
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

export function ComplianceBadge({ violationCount, maxSeverityRank }: { violationCount: number; maxSeverityRank: number }) {
  if (violationCount === 0) return <Badge color="emerald">Compliant</Badge>;
  const band = COMPLIANCE_BANDS.find((b) => maxSeverityRank >= b.minRank) ?? COMPLIANCE_BANDS[COMPLIANCE_BANDS.length - 1];
  return <Badge color={band.color as Color}>{band.label} ({violationCount})</Badge>;
}

export function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, Color> = {
    "Not uploaded": "slate",
    Uploaded: "blue",
    "Pending verification": "amber",
    Verified: "emerald",
    Rejected: "red",
    Expired: "red",
    "Not applicable": "slate",
  };
  return <Badge color={map[status] ?? "slate"}>{status}</Badge>;
}
