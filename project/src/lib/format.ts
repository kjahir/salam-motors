export function formatINR(value: number | null | undefined, options?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (options?.compact) {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN");
}

export function formatDate(value: string | null | undefined, opts?: { withTime?: boolean }): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  if (opts?.withTime) {
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysSince(value: string | null | undefined): number {
  if (!value) return 0;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function maskString(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  if (value.length <= visible) return value;
  return "•".repeat(Math.min(value.length - visible, 8)) + value.slice(-visible);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
