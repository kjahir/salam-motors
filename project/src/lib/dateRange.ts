export type DateRangeKey = "all" | "today" | "7d" | "30d" | "90d" | "6m" | "1y";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "1W" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

export function isWithinDateRange(dateStr: string | null | undefined, key: DateRangeKey): boolean {
  if (key === "all") return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  if (key === "today") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  const daysAgo = (now.getTime() - d.getTime()) / 86400000;
  if (key === "7d") return daysAgo <= 7;
  if (key === "30d") return daysAgo <= 30;
  if (key === "90d") return daysAgo <= 90;
  if (key === "6m") return daysAgo <= 182;
  if (key === "1y") return daysAgo <= 365;
  return true;
}
