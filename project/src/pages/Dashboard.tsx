import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike,
  Wallet,
  TrendingUp,
  BellRing,
  AlertTriangle,
  ArrowRight,
  Activity,
  Pencil,
  ShoppingCart,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Modal } from "@/components/ui/Modal";
import { DualRangeSlider } from "@/components/ui/DualRangeSlider";
import { StatusBadge, AgeingBadge, ComplianceBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatINRRange, formatDate, daysSince } from "@/lib/format";
import { vehicleRef } from "@/lib/vehicleLabel";
import { computeEstimatedProfitRange } from "@/lib/calc";
import { INVESTMENT_TOTAL_STATUSES } from "@/lib/constants";
import {
  fetchVehicles,
  fetchFinancialSummaries,
  fetchAlerts,
  fetchComplianceStatuses,
  fetchInvestments,
  fetchAppSettings,
  updateAppSettings,
  fetchPartners,
  fetchProfitDistributions,
} from "@/lib/queries";
import { syncAllVehiclesCompliance } from "@/lib/compliance";
import type {
  Vehicle,
  VehicleFinancialSummary,
  Alert,
  VehicleComplianceStatus,
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
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editingMargin, setEditingMargin] = useState(false);
  /** Which headline tile's detail popup is open. */
  const [panel, setPanel] = useState<"stock" | "month" | "finance" | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAllVehiclesCompliance().catch(() => {});
        const [v, s, a, c, inv, st, pt, dist] = await Promise.all([
          fetchVehicles(),
          fetchFinancialSummaries(),
          fetchAlerts(),
          fetchComplianceStatuses(),
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
      .filter((i) => INVESTMENT_TOTAL_STATUSES.includes(i.status))
      .reduce((s, i) => s + i.amount, 0);
    const totalCost = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const totalAsking = inStock.reduce((s, v) => s + (v.asking_price ?? 0), 0);

    // All-time (not just current stock) — for the Financial Overview widget
    const totalCostAllTime = summaries.reduce((s, x) => s + x.total_vehicle_cost, 0);
    const totalSalesAllTime = summaries.reduce((s, x) => s + x.sale_price, 0);
    const totalProfitAllTime = summaries.reduce((s, x) => s + (x.gross_profit ?? 0), 0);
    const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
    const marginHigh = settings?.estimated_profit_margin_high_pct ?? 50;
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
          <>
            <LanguageSwitcher preferredLanguages={settings?.preferred_languages ?? null} />
            <button onClick={() => onNavigate("quick-add-sale")} className="btn-sell">
              <ShoppingCart size={16} /> {t("dashboard.sellVehicle")}
            </button>
            <button onClick={() => onNavigate("add-vehicle")} className="btn-primary">
              <Bike size={16} /> {t("dashboard.onboardVehicle")}
            </button>
          </>
        }
      />

      {/* Four headline tiles. Each one carries a single number worth reacting to; the
          supporting figures live behind a click so the page reads in one glance. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <HeadlineTile
          label={t("dashboard.stockTile")}
          value={String(stats.inStockCount)}
          hint={t("dashboard.readyUnderRepair", { ready: stats.readyForSale, repair: stats.underRepair })}
          icon={<Bike size={24} />}
          color="brand"
          onClick={() => setPanel("stock")}
        />
        <HeadlineTile
          label={t("dashboard.thisMonth")}
          value={String(stats.soldThisMonth)}
          hint={t("dashboard.soldBoughtHint", { bought: stats.boughtThisMonth })}
          icon={<TrendingUp size={24} />}
          color="emerald"
          onClick={() => setPanel("month")}
        />
        <HeadlineTile
          label={t("dashboard.financialOverview")}
          value={formatINR(stats.totalProfitAllTime, { compact: true })}
          hint={t("dashboard.totalProfitHint")}
          icon={<Wallet size={24} />}
          color={stats.totalProfitAllTime >= 0 ? "amber" : "red"}
          onClick={() => setPanel("finance")}
        />
        <HeadlineTile
          label={t("dashboard.alertsTile")}
          value={String(stats.openAlerts)}
          hint={t("dashboard.alertsVehiclesHint", { count: stats.openAlertVehicleCount })}
          icon={<BellRing size={24} />}
          color={stats.openAlerts > 0 ? "red" : "slate"}
          onClick={() => onNavigate("alerts")}
        />
      </div>

      {/* Inventory ageing — kept as a table, per its own request */}
      <div>
        <Card className="p-5">
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
                      {vehicleRef(v)} · {formatINR(stats.summaryMap.get(v.id)?.total_vehicle_cost ?? 0)}
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
                <th className="pb-2 font-medium">{t("dashboard.registration")}</th>
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
                    <td className="py-2.5 font-mono text-xs text-slate-600">{vehicleRef(v)}</td>
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

      <Modal open={panel === "stock"} onClose={() => setPanel(null)} title={t("dashboard.asOfToday")}>
        <div className="space-y-1">
          <DetailRow
            label={t("dashboard.vehiclesInStock")}
            value={String(stats.inStockCount)}
            hint={t("dashboard.readyUnderRepair", { ready: stats.readyForSale, repair: stats.underRepair })}
            onClick={() => {
              setPanel(null);
              onNavigate("inventory");
            }}
          />
          <DetailRow
            label={t("dashboard.totalInventoryCost")}
            value={formatINR(stats.totalCost, { compact: true })}
            hint={t("dashboard.askingValue", { value: formatINR(stats.totalAsking, { compact: true }) })}
          />
          <DetailRow
            label={t("dashboard.estimatedProfit")}
            value={formatINRRange(stats.estProfitLow, stats.estProfitHigh, { compact: true })}
            hint={
              <span className="inline-flex items-center gap-1">
                {t("dashboard.marginHint", { low: stats.marginLow, high: stats.marginHigh })} <Pencil size={11} className="opacity-60" />
              </span>
            }
            valueClass="text-emerald-600"
            onClick={() => {
              setPanel(null);
              setEditingMargin(true);
            }}
          />
        </div>
      </Modal>

      <Modal open={panel === "month"} onClose={() => setPanel(null)} title={t("dashboard.thisMonth")}>
        <div className="space-y-1">
          <DetailRow label={t("dashboard.boughtThisMonth")} value={String(stats.boughtThisMonth)} />
          <DetailRow label={t("dashboard.soldThisMonth")} value={String(stats.soldThisMonth)} valueClass="text-emerald-600" />
          <DetailRow
            label={t("dashboard.realisedProfitMonth")}
            value={formatINR(stats.realisedProfitThisMonth, { compact: true })}
            valueClass={stats.realisedProfitThisMonth >= 0 ? "text-emerald-600" : "text-red-600"}
            onClick={() => {
              setPanel(null);
              onNavigate("finance");
            }}
          />
        </div>
      </Modal>

      <Modal open={panel === "finance"} onClose={() => setPanel(null)} title={t("dashboard.financialOverview")}>
        <div className="space-y-1">
          <DetailRow label={t("dashboard.totalInvested")} value={formatINR(stats.totalInvestment, { compact: true })} />
          <DetailRow label={t("dashboard.totalCost")} value={formatINR(stats.totalCostAllTime, { compact: true })} />
          <DetailRow label={t("dashboard.totalSales")} value={formatINR(stats.totalSalesAllTime, { compact: true })} />
          <DetailRow
            label={t("dashboard.totalProfit")}
            value={formatINR(stats.totalProfitAllTime, { compact: true })}
            valueClass={stats.totalProfitAllTime >= 0 ? "text-emerald-600" : "text-red-600"}
          />
          <div className="pt-4 mt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("dashboard.profitShareByPartner")}</p>
            {partnerShares.length === 0 ? (
              <p className="text-sm text-slate-400">{t("dashboard.noPartners")}</p>
            ) : (
              partnerShares.map((ps) => (
                <DetailRow key={ps.id} label={ps.name} value={formatINR(ps.amount, { compact: true })} valueClass="text-emerald-600" />
              ))
            )}
          </div>
        </div>
      </Modal>

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
  const { user, orgId } = useAuth();

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
    if (!orgId) return;
    setSaving(true);
    try {
      await updateAppSettings(
        { estimated_profit_margin_low_pct: low, estimated_profit_margin_high_pct: high },
        orgId,
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

// A dashboard headline: one number big enough to read across the room, with the
// supporting figures a click away rather than crowding the page. Each tile owns a colour
// so the four read as four different things at a glance rather than one grey row.
const TILE_THEMES = {
  brand: {
    card: "border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white hover:border-brand-300",
    icon: "bg-brand-600 text-white shadow-sm",
    value: "text-brand-700",
    label: "text-brand-600",
  },
  emerald: {
    card: "border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white hover:border-accent-300",
    icon: "bg-accent-600 text-white shadow-sm",
    value: "text-accent-700",
    label: "text-accent-600",
  },
  amber: {
    card: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white hover:border-amber-300",
    icon: "bg-amber-500 text-white shadow-sm",
    value: "text-amber-700",
    label: "text-amber-600",
  },
  red: {
    card: "border-red-200 bg-gradient-to-br from-red-50 via-white to-white hover:border-red-300",
    icon: "bg-red-600 text-white shadow-sm",
    value: "text-red-700",
    label: "text-red-600",
  },
  slate: {
    card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white hover:border-slate-300",
    icon: "bg-slate-600 text-white shadow-sm",
    value: "text-slate-800",
    label: "text-slate-500",
  },
} as const;

function HeadlineTile({ label, value, hint, icon, color, onClick }: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  color: keyof typeof TILE_THEMES;
  onClick: () => void;
}) {
  const theme = TILE_THEMES[color];
  return (
    <button
      onClick={onClick}
      className={`card card-hover w-full p-5 text-left transition-all ${theme.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.label}`}>{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight truncate ${theme.value}`}>{value}</p>
          {hint && <p className="mt-1.5 text-xs text-slate-500 truncate">{hint}</p>}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}>{icon}</div>
      </div>
    </button>
  );
}

/** One supporting figure inside a tile's popup; clickable when it leads somewhere. */
function DetailRow({ label, value, hint, valueClass = "text-slate-900", onClick }: {
  label: string;
  value: string;
  hint?: ReactNode;
  valueClass?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-sm text-slate-600">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <p className={`text-base font-bold shrink-0 ${valueClass}`}>{value}</p>
    </>
  );
  if (!onClick) return <div className="flex items-center justify-between gap-3 py-2.5">{content}</div>;
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg py-2.5 px-2 -mx-2 text-left transition-colors hover:bg-slate-50">
      {content}
    </button>
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
