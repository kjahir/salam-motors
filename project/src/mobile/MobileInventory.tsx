import { useEffect, useMemo, useState } from "react";
import { Search, Bike, PlusCircle } from "lucide-react";
import { TopBar, Input, Spinner, Card, EmptyState, Tag, SegmentedTabs } from "./ui/primitives";
import { formatINR, daysSince } from "@/lib/format";
import { fetchVehicles, fetchFinancialSummaries, fetchComplianceStatuses } from "@/lib/queries";
import { SEVERITY_RANK } from "@/lib/constants";
import type { Vehicle, VehicleFinancialSummary, VehicleComplianceStatus } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

function complianceTagColor(maxSeverityRank: number): "success" | "warning" | "error" {
  if (maxSeverityRank >= SEVERITY_RANK.High) return "error";
  if (maxSeverityRank >= SEVERITY_RANK.Warning) return "warning";
  return "success";
}

export function MobileInventory({ onNavigate }: { onNavigate: MobileNavigate }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<VehicleComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"in-stock" | "sold">("in-stock");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, s, c] = await Promise.all([fetchVehicles(), fetchFinancialSummaries(), fetchComplianceStatuses()]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setComplianceStatuses(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);
  const complianceMap = useMemo(() => new Map(complianceStatuses.map((c) => [c.vehicle_id, c])), [complianceStatuses]);

  const filtered = useMemo(() => {
    return vehicles
      .filter((v) => (filter === "sold" ? SOLD_STATUSES.includes(v.current_status) : !SOLD_STATUSES.includes(v.current_status)))
      .filter((v) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [v.stock_number, v.registration_number, v.manufacturer, v.brand, v.model, v.variant]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => daysSince(b.onboarded_at) - daysSince(a.onboarded_at));
  }, [vehicles, filter, search]);

  return (
    <div>
      <TopBar title="Inventory" />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mobile-text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock #, reg, model..." className="pl-10" />
        </div>
        <SegmentedTabs
          tabs={[
            { key: "in-stock", label: "In Stock" },
            { key: "sold", label: "Sold" },
          ]}
          active={filter}
          onChange={(k) => setFilter(k as "in-stock" | "sold")}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size={26} /></div>
      ) : filtered.length === 0 ? (
        <div className="px-4">
          <Card className="p-5">
            <EmptyState
              icon={<Bike size={20} />}
              title="No vehicles found"
              description={filter === "in-stock" ? "Try a different search, or add a vehicle." : "No sold vehicles match this search."}
              action={filter === "in-stock" ? (
                <button onClick={() => onNavigate("add-vehicle")} className="inline-flex items-center gap-1.5 text-sm font-medium text-mobile-primary">
                  <PlusCircle size={15} /> Add Vehicle
                </button>
              ) : undefined}
            />
          </Card>
        </div>
      ) : (
        <div className="px-4 space-y-2.5 pb-2">
          {filtered.map((v) => {
            const s = summaryMap.get(v.id);
            const days = daysSince(v.onboarded_at);
            const estProfit = s?.estimated_profit ?? null;
            const compliance = complianceMap.get(v.id);
            return (
              <Card key={v.id} className="p-3.5" onClick={() => onNavigate("vehicle", { vehicleId: v.id })}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-mobile-text truncate">{v.manufacturer} {v.model}</p>
                    <p className="text-xs text-mobile-text-muted font-mono">{v.stock_number} · {v.registration_number ?? "No reg"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Tag color={SOLD_STATUSES.includes(v.current_status) ? "success" : days >= 60 ? "error" : days >= 30 ? "warning" : "neutral"}>
                      {SOLD_STATUSES.includes(v.current_status) ? v.current_status.replace(/_/g, " ") : `${days}d`}
                    </Tag>
                    <Tag color={complianceTagColor(compliance?.max_severity_rank ?? 0)}>
                      {(compliance?.violation_count ?? 0) > 0 ? `${compliance!.violation_count} issue${compliance!.violation_count > 1 ? "s" : ""}` : "Compliant"}
                    </Tag>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-mobile-border">
                  <div>
                    <p className="text-[10px] text-mobile-text-muted uppercase">Total Cost</p>
                    <p className="text-sm font-medium text-mobile-text">{formatINR(s?.total_vehicle_cost ?? 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-mobile-text-muted uppercase">{SOLD_STATUSES.includes(v.current_status) ? "Profit" : "Est. Profit"}</p>
                    <p className={`text-sm font-semibold ${((SOLD_STATUSES.includes(v.current_status) ? s?.gross_profit : estProfit) ?? 0) >= 0 ? "text-mobile-success" : "text-mobile-error"}`}>
                      {formatINR(SOLD_STATUSES.includes(v.current_status) ? s?.gross_profit : estProfit)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
