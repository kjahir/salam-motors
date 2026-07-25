import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  Wallet,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Clock,
  ArrowRight,
  FileWarning,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge, AgeingBadge, ComplianceBadge } from "@/components/ui/Badge";
import { formatINR, formatDate, daysSince } from "@/lib/format";
import { fetchVehicles, fetchFinancialSummaries, fetchAlerts, fetchComplianceStatuses, fetchCompliancePolicies } from "@/lib/queries";
import { syncAllVehiclesCompliance, resolveAlertDestination } from "@/lib/compliance";
import type { Vehicle, VehicleFinancialSummary, Alert, VehicleComplianceStatus, CompliancePolicy } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface DashboardProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<VehicleComplianceStatus[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAllVehiclesCompliance().catch(() => {});
        const [v, s, a, c, p] = await Promise.all([
          fetchVehicles(),
          fetchFinancialSummaries(),
          fetchAlerts(),
          fetchComplianceStatuses(),
          fetchCompliancePolicies(),
        ]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setAlerts(a);
        setComplianceStatuses(c);
        setPolicies(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const policyMap = useMemo(() => new Map(policies.map((p) => [p.id, p])), [policies]);

  const stats = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const complianceMap = new Map(complianceStatuses.map((c) => [c.vehicle_id, c]));
    const complianceIssues = complianceStatuses.filter((c) => c.violation_count > 0).length;
    const inStock = vehicles.filter(
      (v) => !["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status),
    );
    const soldThisMonth = vehicles.filter((v) => {
      if (v.current_status !== "SOLD" && v.current_status !== "DELIVERED") return false;
      if (!v.sold_at) return false;
      const d = new Date(v.sold_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const boughtThisMonth = vehicles.filter((v) => {
      const d = new Date(v.onboarded_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const totalInvestment = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_invested ?? 0), 0);
    const totalCost = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const totalAsking = inStock.reduce((s, v) => s + (v.asking_price ?? 0), 0);
    const estProfit = inStock.reduce((s, v) => {
      const ep = summaryMap.get(v.id)?.estimated_profit;
      return s + (ep ?? 0);
    }, 0);

    const realisedProfitThisMonth = soldThisMonth.reduce((s, v) => {
      const gp = summaryMap.get(v.id)?.gross_profit;
      return s + (gp ?? 0);
    }, 0);

    const stockWithDays = inStock.map((v) => ({ v, days: daysSince(v.onboarded_at) }));
    const aged30 = stockWithDays.filter((x) => x.days >= 30).length;
    const aged45 = stockWithDays.filter((x) => x.days >= 45).length;
    const aged60Count = stockWithDays.filter((x) => x.days >= 60).length;

    const underRepair = inStock.filter((v) => v.current_status === "UNDER_REPAIR").length;
    const readyForSale = inStock.filter((v) => v.current_status === "READY_FOR_SALE").length;

    const openAlerts = alerts.filter((a) => a.status === "Open");

    return {
      inStockCount: inStock.length,
      totalInvestment,
      totalCost,
      totalAsking,
      estProfit,
      boughtThisMonth: boughtThisMonth.length,
      soldThisMonth: soldThisMonth.length,
      realisedProfitThisMonth,
      aged30,
      aged45,
      aged60: aged60Count,
      underRepair,
      readyForSale,
      openAlerts: openAlerts.length,
      inStock,
      summaryMap,
      complianceMap,
      complianceIssues,
      openAlertList: openAlerts.slice(0, 5),
    };
  }, [vehicles, summaries, alerts, complianceStatuses]);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" description="Business overview and key metrics" />
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" />
        <Card className="p-6">
          <EmptyState icon={<AlertTriangle size={24} />} title="Failed to load dashboard" description={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Business overview and key metrics"
        actions={
          <button onClick={() => onNavigate("add-vehicle")} className="btn-primary">
            <Bike size={16} /> Onboard Vehicle
          </button>
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Vehicles in Stock"
          value={stats.inStockCount}
          icon={<Bike size={20} />}
          color="brand"
          hint={`${stats.readyForSale} ready for sale · ${stats.underRepair} under repair`}
          onClick={() => onNavigate("inventory")}
        />
        <StatCard
          label="Total Inventory Cost"
          value={formatINR(stats.totalCost, { compact: true })}
          icon={<Wallet size={20} />}
          color="slate"
          hint={`Asking value ${formatINR(stats.totalAsking, { compact: true })}`}
        />
        <StatCard
          label="Estimated Profit"
          value={formatINR(stats.estProfit, { compact: true })}
          icon={<TrendingUp size={20} />}
          color="emerald"
          hint="Across current stock at asking price"
        />
        <StatCard
          label="Open Alerts"
          value={stats.openAlerts}
          icon={<AlertTriangle size={20} />}
          color="red"
          hint={`${stats.aged60} vehicles past 60-day limit`}
          onClick={() => onNavigate("alerts")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Compliance Issues"
          value={stats.complianceIssues}
          icon={<ShieldAlert size={20} />}
          color={stats.complianceIssues > 0 ? "orange" : "emerald"}
          hint="Vehicles missing required documents or evidence"
          onClick={() => onNavigate("alerts")}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Bought This Month" value={stats.boughtThisMonth} icon={<Bike size={18} />} color="brand" />
        <StatCard label="Sold This Month" value={stats.soldThisMonth} icon={<CheckCircle2 size={18} />} color="emerald" />
        <StatCard
          label="Realised Profit (Month)"
          value={formatINR(stats.realisedProfitThisMonth, { compact: true })}
          icon={<IndianRupee size={18} />}
          color="emerald"
        />
        <StatCard
          label="Total Invested"
          value={formatINR(stats.totalInvestment, { compact: true })}
          icon={<Wallet size={18} />}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory ageing */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Inventory Ageing</h3>
            <button onClick={() => onNavigate("inventory")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <AgeingStat label="0–29 days" count={stats.inStockCount - stats.aged30} color="emerald" />
            <AgeingStat label="30–44 days" count={stats.aged30 - stats.aged45} color="amber" />
            <AgeingStat label="45–59 days" count={stats.aged45 - stats.aged60} color="orange" />
            <AgeingStat label="60+ days" count={stats.aged60} color="red" />
          </div>
          <div className="space-y-2">
            {stats.inStock
              .map((v) => ({ v, days: daysSince(v.onboarded_at) }))
              .sort((a, b) => b.days - a.days)
              .slice(0, 4)
              .map(({ v, days }) => (
                <button
                  key={v.id}
                  onClick={() => onNavigate("vehicle", { vehicleId: v.id })}
                  className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {v.manufacturer} {v.model}
                    </p>
                    <p className="text-xs text-slate-500">
                      {v.stock_number} · {formatINR(stats.summaryMap.get(v.id)?.total_vehicle_cost ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <StatusBadge status={v.current_status} />
                    <AgeingBadge days={days} />
                    <ComplianceBadge
                      violationCount={stats.complianceMap.get(v.id)?.violation_count ?? 0}
                      maxSeverityRank={stats.complianceMap.get(v.id)?.max_severity_rank ?? 0}
                    />
                  </div>
                </button>
              ))}
          </div>
        </Card>

        {/* Open alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Alerts</h3>
            <button onClick={() => onNavigate("alerts")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              All <ArrowRight size={14} />
            </button>
          </div>
          {stats.openAlertList.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={20} />} title="No open alerts" />
          ) : (
            <div className="space-y-3">
              {stats.openAlertList.map((a) => {
                const sevColor =
                  a.severity === "Critical" ? "red" : a.severity === "High" ? "orange" : a.severity === "Warning" ? "amber" : "slate";
                return (
                  <button
                    key={a.id}
                    onClick={() => onNavigate("vehicle", { vehicleId: a.vehicle_id, ...resolveAlertDestination(a.policy_id ? policyMap.get(a.policy_id) : undefined), highlightPolicyId: a.policy_id ?? undefined })}
                    className="flex items-start gap-3 w-full text-left p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        sevColor === "red"
                          ? "bg-red-50 text-red-600"
                          : sevColor === "orange"
                            ? "bg-orange-50 text-orange-600"
                            : sevColor === "amber"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.alert_type === "Ageing" ? (
                        <Clock size={14} />
                      ) : a.alert_type === "Document" ? (
                        <FileWarning size={14} />
                      ) : a.alert_type === "Repair" ? (
                        <Wrench size={14} />
                      ) : a.alert_type === "Compliance" ? (
                        <ShieldAlert size={14} />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.vehicle?.stock_number} · {a.vehicle?.manufacturer} {a.vehicle?.model}
                      </p>
                    </div>
                    <Badge color={sevColor as "red" | "orange" | "amber" | "slate"}>{a.severity}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity / vehicles */}
      <Card className="p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Activity size={18} className="text-slate-400" /> Recently Onboarded
          </h3>
          <button onClick={() => onNavigate("inventory")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            View inventory <ArrowRight size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Stock #</th>
                <th className="pb-2 font-medium">Vehicle</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Cost</th>
                <th className="pb-2 font-medium text-right">Asking</th>
                <th className="pb-2 font-medium">Onboarded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.slice(0, 5).map((v) => {
                const s = stats.summaryMap.get(v.id);
                return (
                  <tr
                    key={v.id}
                    onClick={() => onNavigate("vehicle", { vehicleId: v.id })}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="py-2.5 font-mono text-xs text-slate-600">{v.stock_number}</td>
                    <td className="py-2.5">
                      <span className="font-medium text-slate-900">{v.manufacturer} {v.model}</span>
                      <span className="text-slate-400 ml-1">· {v.manufacture_year}</span>
                    </td>
                    <td className="py-2.5"><StatusBadge status={v.current_status} /></td>
                    <td className="py-2.5 text-right font-medium text-slate-700">{formatINR(s?.total_vehicle_cost ?? 0)}</td>
                    <td className="py-2.5 text-right font-medium text-slate-700">{formatINR(v.asking_price)}</td>
                    <td className="py-2.5 text-slate-500 text-xs">{formatDate(v.onboarded_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AgeingStat({ label, count, color }: { label: string; count: number; color: "emerald" | "amber" | "orange" | "red" }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}
