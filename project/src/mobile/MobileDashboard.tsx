import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, PlusCircle, LogOut, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner, Card, EmptyState } from "./ui/primitives";
import { formatINR, daysSince } from "@/lib/format";
import { fetchVehicles, fetchFinancialSummaries, fetchAlerts, fetchComplianceStatuses, fetchCompliancePolicies } from "@/lib/queries";
import { syncAllVehiclesCompliance, resolveAlertDestination } from "@/lib/compliance";
import { useAuth } from "@/lib/useAuth";
import type { Vehicle, VehicleFinancialSummary, Alert, VehicleComplianceStatus, CompliancePolicy } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileDashboard({ onNavigate }: { onNavigate: MobileNavigate }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<VehicleComplianceStatus[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAllVehiclesCompliance().catch(() => {});
        const [v, s, a, c, p] = await Promise.all([fetchVehicles(), fetchFinancialSummaries(), fetchAlerts(), fetchComplianceStatuses(), fetchCompliancePolicies()]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setAlerts(a);
        setComplianceStatuses(c);
        setPolicies(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const policyMap = useMemo(() => new Map(policies.map((p) => [p.id, p])), [policies]);

  const navigateToAlert = (a: Alert) => {
    const policy = a.policy_id ? policyMap.get(a.policy_id) : undefined;
    const destination = resolveAlertDestination(policy);
    if (destination.openEditVehicle) {
      onNavigate("edit-vehicle", { vehicleId: a.vehicle_id });
    } else {
      onNavigate("vehicle", { vehicleId: a.vehicle_id, tab: destination.tab, highlightPolicyId: policy?.id });
    }
  };

  const stats = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const inStock = vehicles.filter((v) => !SOLD_STATUSES.includes(v.current_status));
    const sold = vehicles.filter((v) => v.current_status === "SOLD" || v.current_status === "DELIVERED");
    const purchasedValue = vehicles.reduce((s, v) => s + (summaryMap.get(v.id)?.purchase_cost ?? 0), 0);
    const soldValue = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.sale_price ?? 0), 0);
    const inStockValue = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const totalExpenses = vehicles.reduce((s, v) => s + (summaryMap.get(v.id)?.total_expense ?? 0), 0);
    const overallProfit = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0);
    const openAlerts = alerts.filter((a) => a.status === "Open").sort((a, b) => (b.days_in_inventory ?? 0) - (a.days_in_inventory ?? 0));
    const complianceIssues = complianceStatuses.filter((c) => c.violation_count > 0).length;
    return {
      purchasedCount: vehicles.length,
      purchasedValue,
      soldCount: sold.length,
      soldValue,
      inStockCount: inStock.length,
      inStockValue,
      totalExpenses,
      overallProfit,
      openAlerts: openAlerts.slice(0, 5),
      openAlertCount: openAlerts.length,
      complianceIssues,
    };
  }, [vehicles, summaries, alerts, complianceStatuses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const plPositive = stats.overallProfit >= 0;

  return (
    <div>
      <div className="bg-mobile-navy text-white px-5 pt-6 pb-8 flex items-start justify-between">
        <div>
          <p className="font-poppins text-[13px] font-medium uppercase tracking-wide text-white/70">Salam</p>
          <h1 className="font-poppins text-2xl font-bold mt-1"> {t("mobileDashboard.dashboard")}</h1>
        </div>
        <button onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20" aria-label={t("auth.signOut")}>
          <LogOut size={16} />
        </button>
      </div>

      <div className="px-4 -mt-4">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-mobile-text-secondary"> {t("mobileDashboard.overallProfitLoss")}</p>
          <p className={`font-poppins text-[32px] font-bold mt-1 ${plPositive ? "text-mobile-success" : "text-mobile-error"}`}>
            {plPositive ? "+" : ""}
            {formatINR(stats.overallProfit)}
          </p>
          <p className="text-xs text-mobile-text-muted mt-1">
            {t("mobileDashboard.soldToDate", { count: stats.soldCount })}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <StatTile label={t("mobileDashboard.purchased")} value={t("mobileDashboard.bikeCount", { count: stats.purchasedCount })} sub={formatINR(stats.purchasedValue)} />
        <StatTile label={t("mobileDashboard.sold")} value={t("mobileDashboard.bikeCount", { count: stats.soldCount })} sub={formatINR(stats.soldValue)} />
        <StatTile
          label={t("mobileDashboard.inStock")}
          value={t("mobileDashboard.bikeCount", { count: stats.inStockCount })}
          sub={formatINR(stats.inStockValue)}
          onClick={() => onNavigate("inventory")}
        />
        <StatTile label={t("mobileDashboard.totalExpenses")} value={formatINR(stats.totalExpenses)} sub={t("mobileDashboard.serviceMore")} />
        <StatTile
          label={t("mobileDashboard.complianceIssues")}
          value={String(stats.complianceIssues)}
          sub={stats.complianceIssues > 0 ? t("mobileDashboard.needsAttentionSub") : t("mobileDashboard.allCompliant")}
          onClick={() => onNavigate("inventory")}
        />
      </div>

      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2"> {t("mobileDashboard.quickActions")}</p>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<PlusCircle size={18} />} label={t("mobileDashboard.addVehicle")} onClick={() => onNavigate("add-vehicle")} />
          <QuickAction icon={<ClipboardList size={18} />} label={t("mobileDashboard.viewReports")} onClick={() => onNavigate("reports")} />
        </div>
      </div>

      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2"> {t("mobileDashboard.needsAttention")}</p>
        {stats.openAlerts.length === 0 ? (
          <Card className="p-5">
            <EmptyState icon={<CheckCircle2 size={20} />} title={t("mobileDashboard.allClear")} description={t("mobileDashboard.noOpenAlerts")} />
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.openAlerts.map((a) => (
              <Card key={a.id} className="p-3.5" onClick={() => a.vehicle_id && navigateToAlert(a)}>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mobile-warning-bg text-mobile-warning">
                    {a.alert_type === "Compliance" ? <ShieldAlert size={15} /> : <AlertTriangle size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mobile-text truncate">{a.title}</p>
                    <p className="text-xs text-mobile-text-muted truncate">
                      {a.vehicle?.stock_number} · {a.vehicle?.manufacturer} {a.vehicle?.model}
                      {a.vehicle && ` · ${t("mobileDashboard.daysInStock", { days: daysSince(a.vehicle.onboarded_at) })}`}
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

function StatTile({ label, value, sub, onClick }: { label: string; value: string; sub: string; onClick?: () => void }) {
  return (
    <Card className="p-4" onClick={onClick}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mobile-text-muted">{label}</p>
      <p className="font-poppins text-[22px] font-bold text-mobile-text mt-1.5">{value}</p>
      <p className="text-[13px] text-mobile-text-secondary mt-0.5">{sub}</p>
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
