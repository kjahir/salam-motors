import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3, Bell, ClipboardCheck, FileText, HandCoins,
  History, LogOut, Minus, Pencil, Plus, PlusCircle,
  Receipt, ScrollText, ShieldCheck, UserCircle, UserCog,
  Users, Wallet, Warehouse,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner, Card, Sheet } from "./ui/primitives";
import { formatINR } from "@/lib/format";
import { fetchVehicles, fetchFinancialSummaries, fetchInvestments, fetchProfitDistributions } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Vehicle, VehicleFinancialSummary, Investment, ProfitDistribution, Partner } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileDashboard({ onNavigate }: { onNavigate: MobileNavigate }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"overview" | null>(null);
  const { signOut } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, s, inv, dist] = await Promise.all([
          fetchVehicles(),
          fetchFinancialSummaries(),
          fetchInvestments(),
          fetchProfitDistributions(),
        ]);
        if (cancelled) return;
        setVehicles(v);
        setSummaries(s);
        setInvestments(inv);
        setDistributions(dist);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const inStock = vehicles.filter((v) => !SOLD_STATUSES.includes(v.current_status));
    const sold = vehicles.filter((v) => v.current_status === "SOLD" || v.current_status === "DELIVERED");
    const soldValue = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.sale_price ?? 0), 0);
    const inStockValue = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
    const overallProfit = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0);
    const purchaseAndExpenses = vehicles.reduce(
      (s, v) => s + (summaryMap.get(v.id)?.purchase_cost ?? 0) + (summaryMap.get(v.id)?.total_expense ?? 0),
      0,
    );
    const totalInvested = investments
      .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
      .reduce((s, i) => s + i.amount, 0);
    const paidToPartners = distributions.reduce((s, d) => s + d.amount_paid, 0);
    const now = new Date();
    const inThisMonth = (iso: string | null | undefined) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const soldThisMonthList = sold.filter((v) => inThisMonth(v.sold_at));
    return {
      totalInvested,
      paidToPartners,
      purchaseAndExpenses,
      soldValue,
      inStockValue,
      overallProfit,
      soldThisMonth: soldThisMonthList.length,
      boughtThisMonth: vehicles.filter((v) => inThisMonth(v.onboarded_at)).length,
      profitThisMonth: soldThisMonthList.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0),
    };
  }, [vehicles, summaries, investments, distributions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const plPositive = stats.overallProfit >= 0;
  const remaining = stats.totalInvested - stats.purchaseAndExpenses;
  const remainingPositive = remaining >= 0;

  return (
    <div>
      {/* Header */}
      <div className="bg-mobile-navy text-white px-5 pt-6 pb-8 flex items-start justify-between">
        <div>
          <p className="font-poppins text-[13px] font-medium uppercase tracking-wide text-white/70">Salam</p>
          <h1 className="font-poppins text-2xl font-bold mt-1">{t("mobileDashboard.dashboard")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="mobile" />
          <button onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20" aria-label={t("auth.signOut")}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Tappable summary tile — opens combined This Month + Financial Overview sheet */}
      <div className="px-4 -mt-4">
        <Card className="p-5 active:opacity-80 cursor-pointer" onClick={() => setPanel("overview")}>
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
                <p className="text-xs text-mobile-text-muted">{t("financePage.totalPurchaseExpenses")}</p>
                <p className="text-xs font-semibold text-mobile-text-secondary shrink-0">{formatINR(stats.purchaseAndExpenses)}</p>
              </div>
            </div>
            <Wallet size={18} className="text-mobile-text-muted mt-1 shrink-0" />
          </div>
        </Card>
      </div>

      {/* Quick Actions ── Vehicle */}
      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2">
          {t("mobileDashboard.sectionVehicle")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<PlusCircle size={22} />} tone="primary" label={t("mobileDashboard.addVehicle")} onClick={() => onNavigate("add-vehicle")} />
          <QuickAction icon={<HandCoins size={22} />} tone="success" label={t("dashboard.sellVehicle")} onClick={() => onNavigate("add-sale")} />
          <QuickAction icon={<Pencil size={22} />} tone="navy" label={t("nav.manageVehicles")} onClick={() => onNavigate("update-vehicle")} />
          <QuickAction icon={<Receipt size={22} />} tone="secondary" label={t("vehicleDetail.expenses")} onClick={() => onNavigate("add-expense")} />
          <QuickAction icon={<FileText size={22} />} tone="success-soft" label={t("vehicleDetail.documents")} onClick={() => onNavigate("add-document")} />
          <QuickAction icon={<ClipboardCheck size={22} />} tone="warning-soft" label={t("vehicleDetail.inspection")} onClick={() => onNavigate("add-inspection")} />
        </div>
      </div>

      {/* Quick Actions ── Status */}
      <div className="px-4 pt-4">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2">
          {t("mobileDashboard.sectionStatus")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<Warehouse size={22} />} tone="navy" label={t("nav.inventory")} onClick={() => onNavigate("inventory")} />
          <QuickAction icon={<BarChart3 size={22} />} tone="navy-70" label={t("nav.reports")} onClick={() => onNavigate("reports")} />
          <QuickAction icon={<Bell size={22} />} tone="navy-40" label={t("nav.alerts")} onClick={() => onNavigate("alerts")} />
        </div>
      </div>

      {/* Quick Actions ── More */}
      <div className="px-4 pt-4 pb-8">
        <p className="text-xs font-semibold text-mobile-text-secondary uppercase tracking-wide mb-2">
          {t("mobileDashboard.sectionMore")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<UserCircle size={22} />} tone="purple" label={t("nav.parties")} onClick={() => onNavigate("parties")} />
          <QuickAction icon={<Users size={22} />} tone="purple-80" label={t("nav.partners")} onClick={() => onNavigate("partners")} />
          <QuickAction icon={<UserCog size={22} />} tone="purple-60" label={t("nav.team")} onClick={() => onNavigate("team")} />
          <QuickAction icon={<ShieldCheck size={22} />} tone="purple-40" label={t("nav.policies")} onClick={() => onNavigate("policies")} />
          <QuickAction icon={<History size={22} />} tone="purple-25" label={t("nav.history")} onClick={() => onNavigate("history")} />
          <QuickAction icon={<ScrollText size={22} />} tone="purple-15" label={t("nav.audit")} onClick={() => onNavigate("audit")} />
        </div>
      </div>

      {/* Combined overview sheet — This Month first, Financial Overview second */}
      <Sheet open={panel === "overview"} onClose={() => setPanel(null)} title={t("mobileDashboard.overview")}>
        <p className="text-[11px] font-semibold text-mobile-text-secondary uppercase tracking-wide pb-1">
          {t("dashboard.thisMonth")}
        </p>
        <SheetRow label={t("dashboard.boughtThisMonth")} value={String(stats.boughtThisMonth)} />
        <SheetRow label={t("dashboard.soldThisMonth")} value={String(stats.soldThisMonth)} />
        <SheetRow
          label={t("dashboard.realisedProfitMonth")}
          value={formatINR(stats.profitThisMonth)}
          valueClass={stats.profitThisMonth >= 0 ? "text-mobile-success" : "text-mobile-error"}
        />
        <p className="text-[11px] font-semibold text-mobile-text-secondary uppercase tracking-wide pt-4 pb-1">
          {t("dashboard.financialOverview")}
        </p>
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
    </div>
  );
}

function QuickAction({ icon, label, tone, onClick }: {
  icon: ReactNode;
  label: string;
  tone: "primary" | "success" | "secondary" | "navy" | "success-soft" | "warning-soft"
    | "navy-70" | "navy-40"
    | "purple" | "purple-80" | "purple-60" | "purple-40" | "purple-25" | "purple-15"
    | "none";
  onClick: () => void;
}) {
  const tones = {
    primary:      "bg-mobile-primary text-white shadow-mobile-sm",
    success:      "bg-mobile-success text-white shadow-mobile-sm",
    secondary:    "bg-mobile-secondary text-mobile-navy shadow-mobile-sm",
    navy:         "bg-mobile-navy text-white shadow-mobile-sm",
    "success-soft": "bg-mobile-success-bg text-mobile-success",
    "warning-soft": "bg-mobile-warning-bg text-mobile-warning",
    // navy gradient (Status section: dark → mid → light)
    "navy-70":    "bg-mobile-navy/70 text-white shadow-mobile-sm",
    "navy-40":    "bg-mobile-navy/40 text-mobile-navy",
    // purple gradient (More section: solid → fades to tint)
    purple:       "bg-mobile-purple text-white shadow-mobile-sm",
    "purple-80":  "bg-mobile-purple/80 text-white shadow-mobile-sm",
    "purple-60":  "bg-mobile-purple/60 text-white shadow-mobile-sm",
    "purple-40":  "bg-mobile-purple/40 text-mobile-purple",
    "purple-25":  "bg-mobile-purple/25 text-mobile-purple",
    "purple-15":  "bg-mobile-purple/15 text-mobile-purple",
    none:         "border border-mobile-border bg-mobile-card text-mobile-text-secondary",
  };
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 py-2 active:opacity-60">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span>
      <span className="text-[11px] font-medium text-mobile-text-secondary text-center leading-tight">{label}</span>
    </button>
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
