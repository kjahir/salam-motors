import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Pencil,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Badge, StatusBadge, AgeingBadge, ComplianceBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatINRRange, formatDate, daysSince } from "@/lib/format";
import { computeEstimatedProfitRange } from "@/lib/calc";
import {
  fetchVehicles,
  fetchFinancialSummaries,
  fetchAlerts,
  fetchComplianceStatuses,
  fetchCompliancePolicies,
  fetchInvestments,
  fetchAppSettings,
  updateAppSettings,
  fetchPartners,
  fetchProfitDistributions,
} from "@/lib/queries";
import { syncAllVehiclesCompliance, resolveAlertDestination } from "@/lib/compliance";
import { translateAlertCopy } from "@/lib/i18nText";
import type {
  Vehicle,
  VehicleFinancialSummary,
  Alert,
  VehicleComplianceStatus,
  CompliancePolicy,
  Investment,
  AppSettings,
  Partner,
  ProfitDistribution,
} from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface DashboardProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<VehicleComplianceStatus[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editingMargin, setEditingMargin] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAllVehiclesCompliance().catch(() => {});
        const [v, s, a, c, p, inv, st, pt, dist] = await Promise.all([
          fetchVehicles(),
          fetchFinancialSummaries(),
          fetchAlerts(),
          fetchComplianceStatuses(),
          fetchCompliancePolicies(),
          fetchInvestments(),
          fetchAppSettings(),
          fetchPartners(),
          fetchProfitDistributions(),
        ]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setAlerts(a);
        setComplianceStatuses(c);
        setPolicies(p);
        setInvestments(inv);
        setSettings(st);
        setPartners(pt);
        setDistributions(dist);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("dashboard.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const policyMap = useMemo(() => new Map(policies.map((p) => [p.id, p])), [policies]);

  const stats = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const complianceMap = new Map(complianceStatuses.map((c) => [c.vehicle_id, c]));
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

    const totalInvestment = investments
      .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
      .reduce((s, i) => s + i.amount, 0);
    const totalCost = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const totalAsking = inStock.reduce((s, v) => s + (v.asking_price ?? 0), 0);

    // All-time (not just current stock) — for the Financial Overview widget
    const totalCostAllTime = summaries.reduce((s, x) => s + x.total_vehicle_cost, 0);
    const totalSalesAllTime = summaries.reduce((s, x) => s + x.sale_price, 0);
    const totalProfitAllTime = summaries.reduce((s, x) => s + (x.gross_profit ?? 0), 0);
    const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
    const marginHigh = settings?.estimated_profit_margin_high_pct ?? 30;
    const estProfitLow = inStock.reduce((s, v) => {
      const cost = summaryMap.get(v.id)?.total_vehicle_cost ?? 0;
      return s + computeEstimatedProfitRange(cost, marginLow, marginHigh).low;
    }, 0);
    const estProfitHigh = inStock.reduce((s, v) => {
      const cost = summaryMap.get(v.id)?.total_vehicle_cost ?? 0;
      return s + computeEstimatedProfitRange(cost, marginLow, marginHigh).high;
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
    const openAlertVehicleCount = new Set(openAlerts.map((a) => a.vehicle_id).filter(Boolean)).size;

    return {
      inStockCount: inStock.length,
      totalInvestment,
      totalCost,
      totalAsking,
      totalCostAllTime,
      totalSalesAllTime,
      totalProfitAllTime,
      estProfitLow,
      estProfitHigh,
      marginLow,
      marginHigh,
      boughtThisMonth: boughtThisMonth.length,
      soldThisMonth: soldThisMonth.length,
      realisedProfitThisMonth,
      aged30,
      aged45,
      aged60: aged60Count,
      underRepair,
      readyForSale,
      openAlerts: openAlerts.length,
      openAlertVehicleCount,
      inStock,
      summaryMap,
      complianceMap,
      openAlertList: openAlerts.slice(0, 5),
    };
  }, [vehicles, summaries, alerts, complianceStatuses, investments, settings]);

  const partnerShares = useMemo(() => {
    const byPartner = new Map<string, number>();
    for (const d of distributions) {
      byPartner.set(d.partner_id, (byPartner.get(d.partner_id) ?? 0) + d.profit_share);
    }
    return partners
      .map((p) => ({ id: p.id, name: p.name, amount: byPartner.get(p.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [partners, distributions]);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("dashboard.title")} />
        <Card className="p-6">
          <EmptyState icon={<AlertTriangle size={24} />} title={t("dashboard.failedToLoad")} description={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <button onClick={() => onNavigate("add-vehicle")} className="btn-primary">
            <Bike size={16} /> {t("dashboard.onboardVehicle")}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: As of Today + This Month, stacked */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("dashboard.asOfToday")}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label={t("dashboard.vehiclesInStock")}
                value={stats.inStockCount}
                icon={<Bike size={20} />}
                color="brand"
                hint={t("dashboard.readyUnderRepair", { ready: stats.readyForSale, repair: stats.underRepair })}
                onClick={() => onNavigate("inventory")}
              />
              <StatCard
                label={t("dashboard.totalInventoryCost")}
                value={formatINR(stats.totalCost, { compact: true })}
                icon={<Wallet size={20} />}
                color="slate"
                hint={t("dashboard.askingValue", { value: formatINR(stats.totalAsking, { compact: true }) })}
              />
              <StatCard
                label={t("dashboard.estimatedProfit")}
                value={formatINRRange(stats.estProfitLow, stats.estProfitHigh, { compact: true })}
                icon={<TrendingUp size={20} />}
                color="emerald"
                hint={
                  <span className="inline-flex items-center gap-1">
                    {t("dashboard.marginHint", { low: stats.marginLow, high: stats.marginHigh })} <Pencil size={11} className="opacity-60" />
                  </span>
                }
                onClick={() => setEditingMargin(true)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("dashboard.thisMonth")}</h3>
              <button onClick={() => onNavigate("finance")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                {t("dashboard.viewAll")} <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label={t("dashboard.boughtThisMonth")} value={stats.boughtThisMonth} icon={<Bike size={18} />} color="brand" />
              <StatCard label={t("dashboard.soldThisMonth")} value={stats.soldThisMonth} icon={<CheckCircle2 size={18} />} color="emerald" />
              <StatCard
                label={t("dashboard.realisedProfitMonth")}
                value={formatINR(stats.realisedProfitThisMonth, { compact: true })}
                icon={<IndianRupee size={18} />}
                color="emerald"
              />
            </div>
          </div>
        </div>

        {/* Right: Financial Overview, spanning the height of both rows on the left */}
        <Card className="p-5 h-full">
          <h3 className="font-semibold text-slate-900 mb-4">{t("dashboard.financialOverview")}</h3>
          <div className="space-y-3">
            <FinancialStatRow label={t("dashboard.totalInvested")} value={formatINR(stats.totalInvestment, { compact: true })} color="text-slate-900" />
            <FinancialStatRow label={t("dashboard.totalCost")} value={formatINR(stats.totalCostAllTime, { compact: true })} color="text-slate-900" />
            <FinancialStatRow label={t("dashboard.totalSales")} value={formatINR(stats.totalSalesAllTime, { compact: true })} color="text-slate-900" />
            <FinancialStatRow
              label={t("dashboard.totalProfit")}
              value={formatINR(stats.totalProfitAllTime, { compact: true })}
              color={stats.totalProfitAllTime >= 0 ? "text-emerald-600" : "text-red-600"}
            />
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t("dashboard.profitShareByPartner")}</p>
            {partnerShares.length === 0 ? (
              <p className="text-sm text-slate-400">{t("dashboard.noPartners")}</p>
            ) : (
              <div className="space-y-3">
                {partnerShares.map((p) => (
                  <FinancialStatRow key={p.id} label={p.name} value={formatINR(p.amount, { compact: true })} color="text-emerald-600" />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory ageing */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{t("dashboard.inventoryAgeing")}</h3>
            <button onClick={() => onNavigate("inventory")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              {t("dashboard.viewAll")} <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <AgeingStat label={t("dashboard.ageing0")} count={stats.inStockCount - stats.aged30} color="emerald" />
            <AgeingStat label={t("dashboard.ageing30")} count={stats.aged30 - stats.aged45} color="amber" />
            <AgeingStat label={t("dashboard.ageing45")} count={stats.aged45 - stats.aged60} color="orange" />
            <AgeingStat label={t("dashboard.ageing60")} count={stats.aged60} color="red" />
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
            <h3 className="font-semibold text-slate-900">
              {t("dashboard.recentAlerts", { alerts: stats.openAlerts, vehicles: stats.openAlertVehicleCount, alertPlural: stats.openAlerts !== 1 ? "s" : "", vehiclePlural: stats.openAlertVehicleCount !== 1 ? "s" : "" })}
            </h3>
            <button onClick={() => onNavigate("alerts")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              {t("dashboard.all")} <ArrowRight size={14} />
            </button>
          </div>
          {stats.openAlertList.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={20} />} title={t("dashboard.noOpenAlerts")} />
          ) : (
            <div className="space-y-3">
              {stats.openAlertList.map((a) => {
                const sevColor =
                  a.severity === "Critical" ? "red" : a.severity === "High" ? "orange" : a.severity === "Warning" ? "amber" : "slate";
                const copy = translateAlertCopy(t, a.title, a.message);
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
                      <p className="text-sm font-medium text-slate-900 truncate">{copy.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.vehicle?.stock_number} · {a.vehicle?.manufacturer} {a.vehicle?.model}
                      </p>
                    </div>
                    <Badge color={sevColor as "red" | "orange" | "amber" | "slate"}>{t(`status.${a.severity}`, { defaultValue: a.severity })}</Badge>
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
            <Activity size={18} className="text-slate-400" /> {t("dashboard.recentlyOnboarded")}
          </h3>
          <button onClick={() => onNavigate("inventory")} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            {t("dashboard.viewInventory")} <ArrowRight size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">{t("dashboard.stockNumber")}</th>
                <th className="pb-2 font-medium">{t("dashboard.vehicle")}</th>
                <th className="pb-2 font-medium">{t("dashboard.status")}</th>
                <th className="pb-2 font-medium text-right">{t("dashboard.cost")}</th>
                <th className="pb-2 font-medium text-right">{t("dashboard.asking")}</th>
                <th className="pb-2 font-medium">{t("dashboard.onboarded")}</th>
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

      {editingMargin && settings && (
        <EstimatedProfitMarginModal
          settings={settings}
          totalCost={stats.totalCost}
          onClose={() => setEditingMargin(false)}
          onSaved={(updated) => {
            setSettings(updated);
            setEditingMargin(false);
          }}
        />
      )}
    </div>
  );
}

function EstimatedProfitMarginModal({ settings, totalCost, onClose, onSaved }: {
  settings: AppSettings;
  totalCost: number;
  onClose: () => void;
  onSaved: (settings: AppSettings) => void;
}) {
  const { t } = useTranslation();
  const [low, setLow] = useState(settings.estimated_profit_margin_low_pct);
  const [high, setHigh] = useState(settings.estimated_profit_margin_high_pct);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleLowChange = (v: number) => {
    setLow(v);
    if (v > high) setHigh(v);
  };
  const handleHighChange = (v: number) => {
    setHigh(v);
    if (v < low) setLow(v);
  };

  const previewLow = totalCost * (low / 100);
  const previewHigh = totalCost * (high / 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAppSettings(
        { estimated_profit_margin_low_pct: low, estimated_profit_margin_high_pct: high },
        user?.email ?? "Unknown",
      );
      toast(t("dashboard.marginUpdated"), "success");
      onSaved({ ...settings, estimated_profit_margin_low_pct: low, estimated_profit_margin_high_pct: high });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("dashboard.failedUpdateMargin"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("dashboard.marginModalTitle")}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">{t("dashboard.cancel")}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? t("dashboard.saving") : t("dashboard.save")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          {t("dashboard.marginHelp")}
        </p>

        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{t("dashboard.estimatedProfitPreview")}</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatINRRange(previewLow, previewHigh, { compact: true })}</p>
          <p className="text-xs text-emerald-600 mt-0.5">{t("dashboard.acrossCurrentStockCost", { value: formatINR(totalCost, { compact: true }) })}</p>
        </div>

        <div className="px-1 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-600 tabular-nums">{t("dashboard.low", { value: low })}</span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">{t("dashboard.high", { value: high })}</span>
          </div>
          <DualRangeSlider low={low} high={high} onLowChange={handleLowChange} onHighChange={handleHighChange} />
        </div>
      </div>
    </Modal>
  );
}

function DualRangeSlider({ low, high, onLowChange, onHighChange, min = 0, max = 100 }: {
  low: number;
  high: number;
  onLowChange: (value: number) => void;
  onHighChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const thumbClass =
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none";

  return (
    <div className="relative h-6 flex items-center">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-emerald-400"
        style={{ left: `${low}%`, right: `${100 - high}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={low}
        onChange={(e) => onLowChange(Number(e.target.value))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:border-amber-500 [&::-moz-range-thumb]:border-amber-500 ${thumbClass}`}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={high}
        onChange={(e) => onHighChange(Number(e.target.value))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:border-emerald-600 [&::-moz-range-thumb]:border-emerald-600 ${thumbClass}`}
      />
    </div>
  );
}

function FinancialStatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500 truncate">{label}</p>
      <p className={`text-sm font-bold shrink-0 ${color}`}>{value}</p>
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
