import { useEffect, useMemo, useState } from "react";
import { Bike, TrendingUp, Wallet, AlertTriangle, CheckCircle2, ClipboardList, PlusCircle, LogOut } from "lucide-react";
import { Spinner, Card, EmptyState } from "./ui/primitives";
import { formatINR, daysSince } from "@/lib/format";
import { fetchVehicles, fetchFinancialSummaries, fetchAlerts } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import type { Vehicle, VehicleFinancialSummary, Alert } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileDashboard({ onNavigate }: { onNavigate: MobileNavigate }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut, user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, s, a] = await Promise.all([fetchVehicles(), fetchFinancialSummaries(), fetchAlerts()]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setAlerts(a);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const inStock = vehicles.filter((v) => !SOLD_STATUSES.includes(v.current_status));
    const sold = vehicles.filter((v) => v.current_status === "SOLD" || v.current_status === "DELIVERED");
    const inStockValue = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const estProfit = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.estimated_profit ?? 0), 0);
    const realisedProfit = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0);
    const openAlerts = alerts.filter((a) => a.status === "Open").sort((a, b) => (b.days_in_inventory ?? 0) - (a.days_in_inventory ?? 0));
    return {
      inStockCount: inStock.length,
      soldCount: sold.length,
      inStockValue,
      estProfit,
      realisedProfit,
      openAlerts: openAlerts.slice(0, 5),
      openAlertCount: openAlerts.length,
    };
  }, [vehicles, summaries, alerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <div>
          <p className="text-xs text-mobile-text-muted">Welcome back</p>
          <h1 className="text-lg font-poppins font-bold text-mobile-text">{user?.email?.split("@")[0] ?? "Dashboard"}</h1>
        </div>
        <button onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-mobile-border text-mobile-text-muted active:bg-mobile-bg" aria-label="Sign out">
          <LogOut size={16} />
        </button>
      </div>

      <div className="px-4 pt-2">
        <Card className="p-5 bg-mobile-navy text-white border-0">
          <p className="text-xs text-white/70">Realised Profit (All Time)</p>
          <p className="text-3xl font-poppins font-bold mt-1">{formatINR(stats.realisedProfit)}</p>
          <p className="text-xs text-white/60 mt-2">
            + {formatINR(stats.estProfit)} estimated across {stats.inStockCount} vehicle{stats.inStockCount !== 1 ? "s" : ""} in stock
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <StatTile icon={<Bike size={16} />} label="In Stock" value={String(stats.inStockCount)} onClick={() => onNavigate("inventory")} />
        <StatTile icon={<CheckCircle2 size={16} />} label="Sold" value={String(stats.soldCount)} />
        <StatTile icon={<Wallet size={16} />} label="Stock Value" value={formatINR(stats.inStockValue, { compact: true })} />
        <StatTile icon={<TrendingUp size={16} />} label="Est. Profit" value={formatINR(stats.estProfit, { compact: true })} />
      </div>

      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<PlusCircle size={18} />} label="Add Vehicle" onClick={() => onNavigate("add-vehicle")} />
          <QuickAction icon={<ClipboardList size={18} />} label="View Reports" onClick={() => onNavigate("reports")} />
        </div>
      </div>

      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2">Needs Attention</p>
        {stats.openAlerts.length === 0 ? (
          <Card className="p-5">
            <EmptyState icon={<CheckCircle2 size={20} />} title="All clear" description="No open alerts right now." />
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.openAlerts.map((a) => (
              <Card key={a.id} className="p-3.5" onClick={() => a.vehicle_id && onNavigate("vehicle", { vehicleId: a.vehicle_id })}>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mobile-warning-bg text-mobile-warning">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mobile-text truncate">{a.title}</p>
                    <p className="text-xs text-mobile-text-muted truncate">
                      {a.vehicle?.stock_number} · {a.vehicle?.manufacturer} {a.vehicle?.model}
                      {a.vehicle && ` · ${daysSince(a.vehicle.onboarded_at)}d in stock`}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  return (
    <Card className="p-3.5" onClick={onClick}>
      <div className="flex items-center gap-1.5 text-mobile-text-muted">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-poppins font-bold text-mobile-text mt-1">{value}</p>
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-2xl border border-mobile-border bg-white p-3.5 active:bg-mobile-bg">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary shrink-0">{icon}</div>
      <span className="text-sm font-medium text-mobile-text">{label}</span>
    </button>
  );
}
