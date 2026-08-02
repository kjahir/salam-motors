import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Bike, CalendarDays, CheckCircle2, HandCoins, Minus, Plus, PlusCircle, LogOut, ShieldAlert, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner, Card, EmptyState, Sheet } from "./ui/primitives";
import { formatINR, formatINRRange, daysSince } from "@/lib/format";
import { computeEstimatedProfitRange } from "@/lib/calc";
import { fetchVehicles, fetchFinancialSummaries, fetchAlerts, fetchComplianceStatuses, fetchCompliancePolicies, fetchInvestments, fetchProfitDistributions, fetchAppSettings } from "@/lib/queries";
import { syncAllVehiclesCompliance, resolveAlertDestination } from "@/lib/compliance";
import { useAuth } from "@/lib/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { translateAlertCopy } from "@/lib/i18nText";
import type { Vehicle, VehicleFinancialSummary, Alert, VehicleComplianceStatus, CompliancePolicy, Investment, ProfitDistribution, Partner, AppSettings } from "@/lib/types";
import { vehicleLabel } from "@/lib/vehicleLabel";
import type { MobileNavigate } from "./MobileApp";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileDashboard({ onNavigate }: { onNavigate: MobileNavigate }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<VehicleComplianceStatus[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null })[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"finance" | "stock" | "month" | null>(null);
  const { signOut } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAllVehiclesCompliance().catch(() => {});
        const [v, s, a, c, p, inv, dist, st] = await Promise.all([fetchVehicles(), fetchFinancialSummaries(), fetchAlerts(), fetchComplianceStatuses(), fetchCompliancePolicies(), fetchInvestments(), fetchProfitDistributions(), fetchAppSettings()]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setAlerts(a);
        setComplianceStatuses(c);
        setPolicies(p);
        setInvestments(inv);
        setDistributions(dist);
        setSettings(st);
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
    const now = new Date();
    const inThisMonth = (iso: string | null | undefined) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const soldThisMonthList = sold.filter((v) => inThisMonth(v.sold_at));
    return {
      readyForSale: inStock.filter((v) => v.current_status === "READY_FOR_SALE").length,
      underRepair: inStock.filter((v) => v.current_status === "UNDER_REPAIR").length,
      totalAsking: inStock.reduce((s, v) => s + (v.asking_price ?? 0), 0),
      totalInvested: investments
        .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
        .reduce((s, i) => s + i.amount, 0),
      paidToPartners: distributions.reduce((s, d) => s + d.amount_paid, 0),
      purchaseAndExpenses: vehicles.reduce(
        (s, v) => s + (summaryMap.get(v.id)?.purchase_cost ?? 0) + (summaryMap.get(v.id)?.total_expense ?? 0),
        0,
      ),
      soldThisMonth: soldThisMonthList.length,
      boughtThisMonth: vehicles.filter((v) => inThisMonth(v.onboarded_at)).length,
      profitThisMonth: soldThisMonthList.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0),
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
  }, [vehicles, summaries, alerts, complianceStatuses, investments, distributions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const plPositive = stats.overallProfit >= 0;
  // Headline figure: capital put in, less what has been spent on the vehicles. Positive means
  // there is still unspent investment; negative means spending has outrun what was invested.
  const remaining = stats.totalInvested - stats.totalExpenses;
  const remainingPositive = remaining >= 0;
  const estRange = computeEstimatedProfitRange(
    stats.inStockValue,
    settings?.estimated_profit_margin_low_pct ?? 10,
    settings?.estimated_profit_margin_high_pct ?? 30,
  );

  return (
    <div>
      <div className="bg-mobile-navy text-white px-5 pt-6 pb-8 flex items-start justify-between">
        <div>
          <p className="font-poppins text-[13px] font-medium uppercase tracking-wide text-white/70">Salam</p>
          <h1 className="font-poppins text-2xl font-bold mt-1"> {t("mobileDashboard.dashboard")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="mobile" />
          <button onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20" aria-label={t("auth.signOut")}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-mobile-text-secondary">{t("mobileDashboard.totalAmountInvested")}</p>
                <p className="text-[13px] font-semibold text-mobile-text shrink-0">{formatINR(stats.totalInvested)}</p>
              </div>
              <p className={`flex items-center gap-0.5 font-poppins text-[32px] font-bold mt-1 ${remainingPositive ? "text-mobile-success" : "text-mobile-error"}`}>
                {remainingPositive ? <Plus size={26} strokeWidth={3} /> : <Minus size={26} strokeWidth={3} />}
                {formatINR(Math.abs(remaining))}
              </p>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <p className="text-xs text-mobile-text-muted">{t("mobileDashboard.totalExpenses")}</p>
                <p className="text-xs font-medium text-mobile-text-secondary shrink-0">{formatINR(stats.totalExpenses)}</p>
              </div>
            </div>
            <button
              onClick={() => setPanel("finance")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mobile-secondary text-mobile-navy active:opacity-80"
              aria-label={t("dashboard.financialOverview")}
            >
              <Wallet size={18} />
            </button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <IconTile
          label={t("dashboard.stockTile")}
          value={String(stats.inStockCount)}
          icon={<Bike size={18} />}
          tone="primary"
          onClick={() => setPanel("stock")}
        />
        <IconTile
          label={t("dashboard.thisMonth")}
          value={String(stats.soldThisMonth)}
          icon={<CalendarDays size={18} />}
          tone="success"
          onClick={() => setPanel("month")}
        />
      </div>

      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2"> {t("mobileDashboard.quickActions")}</p>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<PlusCircle size={22} />} tone="primary" label={t("mobileDashboard.addVehicle")} onClick={() => onNavigate("add-vehicle")} />
          <QuickAction icon={<HandCoins size={22} />} tone="success" label={t("dashboard.sellVehicle")} onClick={() => onNavigate("add-sale")} />
          <QuickAction icon={<BarChart3 size={22} />} tone="secondary" label={t("mobileDashboard.viewReports")} onClick={() => onNavigate("reports")} />
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
                    {/* Alert titles are stored in English (compliance.ts writes the policy name
                        verbatim), so they have to be translated at render time, same as Alerts.tsx. */}
                    <p className="text-sm font-medium text-mobile-text truncate">{translateAlertCopy(t, a.title, a.message).title}</p>
                    <p className="text-xs text-mobile-text-muted truncate">
                      {vehicleLabel(a.vehicle)}
                      {a.vehicle && ` · ${t("mobileDashboard.daysInStock", { days: daysSince(a.vehicle.onboarded_at) })}`}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={panel === "stock"} onClose={() => setPanel(null)} title={t("dashboard.asOfToday")}>
        <SheetRow label={t("dashboard.vehiclesInStock")} value={String(stats.inStockCount)} />
        <SheetRow label={t("mobileDashboard.readyForSale")} value={String(stats.readyForSale)} />
        <SheetRow label={t("mobileDashboard.underRepair")} value={String(stats.underRepair)} />
        <SheetRow label={t("dashboard.totalInventoryCost")} value={formatINR(stats.inStockValue)} />
        <SheetRow label={t("mobileDashboard.askingValue")} value={formatINR(stats.totalAsking)} />
        <SheetRow
          label={t("dashboard.estimatedProfit")}
          value={formatINRRange(estRange.low, estRange.high, { compact: true })}
          valueClass="text-mobile-success"
        />
      </Sheet>

      <Sheet open={panel === "finance"} onClose={() => setPanel(null)} title={t("dashboard.financialOverview")}>
        <SheetRow label={t("dashboard.totalInvested")} value={formatINR(stats.totalInvested)} />
        <SheetRow
          label={t("dashboard.totalProfit")}
          value={formatINR(stats.overallProfit)}
          valueClass={plPositive ? "text-mobile-success" : "text-mobile-error"}
        />
        <SheetRow label={t("mobileDashboard.paidToPartners")} value={formatINR(stats.paidToPartners)} />
        <SheetRow label={t("mobileReports.purchaseExpenses")} value={formatINR(stats.purchaseAndExpenses)} />
        <SheetRow label={t("mobileDashboard.totalSold")} value={formatINR(stats.soldValue)} />
        <SheetRow label={t("mobileDashboard.inStock")} value={formatINR(stats.inStockValue)} />
      </Sheet>

      <Sheet open={panel === "month"} onClose={() => setPanel(null)} title={t("dashboard.thisMonth")}>
        <SheetRow label={t("dashboard.boughtThisMonth")} value={String(stats.boughtThisMonth)} />
        <SheetRow label={t("dashboard.soldThisMonth")} value={String(stats.soldThisMonth)} />
        <SheetRow
          label={t("dashboard.realisedProfitMonth")}
          value={formatINR(stats.profitThisMonth)}
          valueClass={stats.profitThisMonth >= 0 ? "text-mobile-success" : "text-mobile-error"}
        />
      </Sheet>
    </div>
  );
}

/**
 * Icon-first shortcut on a filled colour tile, one brand colour per action, so the three
 * actions are told apart by colour before the label is read. Colour is what carries the
 * distinction here — the tiles are all the same size and shape on purpose. The 44px tap
 * target comes from the 44px tile itself.
 */
function QuickAction({ icon, label, tone, onClick }: {
  icon: ReactNode;
  label: string;
  tone: "primary" | "success" | "secondary";
  onClick: () => void;
}) {
  const tones = {
    primary: "bg-mobile-primary text-white",
    success: "bg-mobile-success text-white",
    secondary: "bg-mobile-secondary text-mobile-navy",
  };
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 py-2 active:opacity-60">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-mobile-sm ${tones[tone]}`}>{icon}</span>
      <span className="text-[11px] font-medium text-mobile-text-secondary text-center leading-tight">{label}</span>
    </button>
  );
}

/** A colour-led tile whose figures live in a sheet, so the dashboard stays scannable. */
function IconTile({ label, value, icon, tone, onClick }: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "primary" | "success";
  onClick: () => void;
}) {
  const tones = {
    primary: "bg-mobile-primary text-white",
    success: "bg-mobile-success text-white",
  };
  return (
    <Card className="p-3.5" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-mobile-text-muted uppercase truncate">{label}</p>
          <p className="font-poppins text-xl font-bold text-mobile-text mt-0.5">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
    </Card>
  );
}

function SheetRow({ label, value, valueClass = "text-mobile-text" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-mobile-border last:border-0">
      <p className="text-sm text-mobile-text-secondary">{label}</p>
      <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
