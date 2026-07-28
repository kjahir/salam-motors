import { formatDate, formatINR, formatNumber, formatPercent } from "@/lib/format";
import type { AssistantScalar, EntityColumn, MetricItem } from "./schema";

export function formatMetric(item: MetricItem): string {
  const value = item.value;
  if (typeof value !== "number") return String(value);
  if (item.format === "inr") return formatINR(value, { compact: true });
  if (item.format === "percent") return formatPercent(value);
  if (item.format === "days") return `${formatNumber(value)} days`;
  if (item.format === "number") return formatNumber(value);
  return String(value);
}

export function formatScalar(
  value: AssistantScalar | undefined,
  format: EntityColumn["format"] = "text",
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "inr" && typeof value === "number") return formatINR(value);
  if (format === "number" && typeof value === "number") return formatNumber(value);
  if (format === "percent" && typeof value === "number") return formatPercent(value);
  if ((format === "date" || format === "datetime") && typeof value === "string") {
    return formatDate(value, { withTime: format === "datetime" });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function severityTone(severity: string): "red" | "orange" | "amber" | "blue" | "slate" {
  const value = severity.toLowerCase();
  if (value === "critical") return "red";
  if (value === "high") return "orange";
  if (value === "medium") return "amber";
  if (value === "low") return "blue";
  return "slate";
}
