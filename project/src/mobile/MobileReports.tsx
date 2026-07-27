import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, TrendingUp, ShoppingCart, Bike, ArrowUpDown } from "lucide-react";
import { TopBar, Input, Spinner, Card, EmptyState, Tag, SegmentedTabs, Button } from "./ui/primitives";
import { formatINR, formatDate, daysSince } from "@/lib/format";
import {
  fetchAllPurchases,
  fetchAllSales,
  fetchVehicles,
  fetchFinancialSummaries,
  fetchInvestments,
  fetchAllExpenses,
  fetchProfitDistributions,
} from "@/lib/queries";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/dateRange";
import type {
  Purchase,
  Sale,
  Vehicle,
  Party,
  VehicleFinancialSummary,
  Investment,
  Expense,
  ProfitDistribution,
  Partner,
} from "@/lib/types";

type ReportTab = "purchases" | "inventory" | "sales";
type SortDir = "desc" | "asc";

const PAGE_SIZE = 10;

export function MobileReports() {
  const [tab, setTab] = useState<ReportTab>("inventory");
  const [purchases, setPurchases] = useState<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]>([]);
  const [sales, setSales] = useState<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { t } = useTranslation();

  const trDateRange = (value: DateRangeKey, label: string) => t("dateRange." + value, { defaultValue: label });

  useEffect(() => {
    (async () => {
      const [p, s, v, sm, inv, exp, dist] = await Promise.all([
        fetchAllPurchases(),
        fetchAllSales(),
        fetchVehicles(),
        fetchFinancialSummaries(),
        fetchInvestments(),
        fetchAllExpenses(),
        fetchProfitDistributions(),
      ]);
      setPurchases(p);
      setSales(s);
      setVehicles(v);
      setSummaries(sm);
      setInvestments(inv);
      setExpenses(exp);
      setDistributions(dist);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [tab, search, dateRange]);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

  const totals = useMemo(() => {
    const totalInvested = investments
      .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
      .reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.filter((e) => e.approval_status === "Approved").reduce((s, e) => s + e.amount, 0);
    const totalPurchases = purchases.reduce((s, p) => s + p.agreed_price + p.broker_commission + p.other_fee, 0);
    const totalPurchaseAndExpenses = totalPurchases + totalExpenses;
    const completedSales = sales.filter((s) => s.status === "Completed");
    const totalSales = completedSales.reduce((s, sale) => s + sale.sale_price, 0);
    const totalProfit = distributions.reduce((s, d) => s + d.profit_share, 0);
    const totalPayable = distributions.reduce((s, d) => s + d.balance_payable, 0);
    return { totalInvested, totalExpenses, totalPurchases, totalPurchaseAndExpenses, totalSales, totalProfit, totalPayable };
  }, [investments, expenses, purchases, sales, distributions]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (v: Vehicle | null | undefined) =>
      !q || [v?.stock_number, v?.registration_number, v?.manufacturer, v?.model].filter(Boolean).join(" ").toLowerCase().includes(q);
  }, [search]);

  const dirFactor = sortDir === "desc" ? -1 : 1;

  const purchaseRows = useMemo(
    () => purchases.filter((p) => isWithinDateRange(p.purchase_date, dateRange) && matches(p.vehicle)).sort((a, b) => dirFactor * (+new Date(a.purchase_date) - +new Date(b.purchase_date))),
    [purchases, dateRange, matches, dirFactor],
  );
  const saleRows = useMemo(
    () => sales.filter((s) => isWithinDateRange(s.sale_date, dateRange) && matches(s.vehicle)).sort((a, b) => dirFactor * (+new Date(a.sale_date) - +new Date(b.sale_date))),
    [sales, dateRange, matches, dirFactor],
  );
  const inventoryRows = useMemo(
    () =>
      vehicles
        .filter((v) => !["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status) && isWithinDateRange(v.onboarded_at, dateRange) && matches(v))
        .sort((a, b) => dirFactor * (+new Date(a.onboarded_at) - +new Date(b.onboarded_at))),
    [vehicles, dateRange, matches, dirFactor],
  );

  if (loading) {
    return (
      <div>
        <TopBar title={t("mobileReports.title")} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t("mobileReports.title")} />
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <StatTile label={t("financePage.totalInvested")} value={formatINR(totals.totalInvested)} />
        <StatTile
          label={t("mobileReports.purchaseExpenses")}
          value={formatINR(totals.totalPurchaseAndExpenses)}
          sub={t("financePage.purchasesExpensesShort", { purchases: formatINR(totals.totalPurchases), expenses: formatINR(totals.totalExpenses) })}
        />
        <StatTile label={t("mobileReports.salesProfit")} value={formatINR(totals.totalSales)} sub={t("financePage.profitHint", { profit: formatINR(totals.totalProfit) })} />
        <StatTile label={t("financePage.payableToPartners")} value={formatINR(totals.totalPayable)} />
      </div>
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mobile-text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("financePage.searchPlaceholder")} className="pl-10" />
        </div>
        <SegmentedTabs
          tabs={[
            { key: "purchases", label: t("mobileReports.tabs.purchases") },
            { key: "inventory", label: t("mobileReports.tabs.inventory") },
            { key: "sales", label: t("mobileReports.tabs.sales") },
          ]}
          active={tab}
          onChange={(k) => setTab(k as ReportTab)}
        />
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${dateRange === opt.value ? "bg-mobile-navy text-white" : "bg-white text-mobile-text-secondary border border-mobile-border"}`}
            >
              {trDateRange(opt.value, opt.label)}
            </button>
          ))}
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="shrink-0 ml-auto inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium bg-white text-mobile-text-secondary border border-mobile-border"
          >
            <ArrowUpDown size={12} /> {sortDir === "desc" ? t("mobileReports.newest") : t("mobileReports.oldest")}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-2.5 pb-4">
        {tab === "purchases" && (
          <>
            <ListSection
              empty={{ icon: <ShoppingCart size={20} />, title: t("mobileReports.noPurchases") }}
              rows={purchaseRows.slice(0, limit)}
              total={purchaseRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(p) => (
                <Card key={p.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{p.vehicle?.manufacturer} {p.vehicle?.model}</p>
                      <p className="text-xs text-mobile-text-muted">{p.seller?.full_name ?? "—"} · {formatDate(p.purchase_date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-mobile-text shrink-0">{formatINR(p.agreed_price)}</span>
                  </div>
                </Card>
              )}
            />
            {purchaseRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: purchaseRows.length })}
                value={formatINR(purchaseRows.reduce((s, p) => s + p.agreed_price + p.broker_commission + p.other_fee, 0))}
              />
            )}
          </>
        )}
        {tab === "inventory" && (
          <>
            <ListSection
              empty={{ icon: <Bike size={20} />, title: t("mobileReports.noVehicles") }}
              rows={inventoryRows.slice(0, limit)}
              total={inventoryRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(v) => {
                const s = summaryMap.get(v.id);
                const days = daysSince(v.onboarded_at);
                return (
                  <Card key={v.id} className="p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-mobile-text truncate">{v.manufacturer} {v.model}</p>
                        <p className="text-xs text-mobile-text-muted font-mono">{v.stock_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-mobile-text">{formatINR(s?.total_vehicle_cost ?? 0)}</p>
                        <Tag color={days >= 60 ? "error" : days >= 30 ? "warning" : "neutral"}>{days}d</Tag>
                      </div>
                    </div>
                  </Card>
                );
              }}
            />
            {inventoryRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: inventoryRows.length })}
                value={formatINR(inventoryRows.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0))}
              />
            )}
          </>
        )}
        {tab === "sales" && (
          <>
            <ListSection
              empty={{ icon: <TrendingUp size={20} />, title: t("mobileReports.noSales") }}
              rows={saleRows.slice(0, limit)}
              total={saleRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(sale) => {
                const s = sale.vehicle_id ? summaryMap.get(sale.vehicle_id) : undefined;
                const profit = s?.gross_profit ?? null;
                return (
                  <Card key={sale.id} className="p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-mobile-text truncate">{sale.vehicle?.manufacturer} {sale.vehicle?.model}</p>
                        <p className="text-xs text-mobile-text-muted">{sale.buyer?.full_name ?? "—"} · {formatDate(sale.sale_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-mobile-text">{formatINR(sale.sale_price)}</p>
                        {profit !== null && <p className={`text-xs font-medium ${profit >= 0 ? "text-mobile-success" : "text-mobile-error"}`}>{formatINR(profit)}</p>}
                      </div>
                    </div>
                  </Card>
                );
              }}
            />
            {saleRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: saleRows.length })}
                value={formatINR(saleRows.reduce((s, sale) => s + sale.sale_price, 0))}
                sub={t("financePage.profitHint", { profit: formatINR(saleRows.reduce((s, sale) => s + (summaryMap.get(sale.vehicle_id)?.gross_profit ?? 0), 0)) })}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ListSection<T>({ rows, total, limit, onLoadMore, render, empty }: {
  rows: T[];
  total: number;
  limit: number;
  onLoadMore: () => void;
  render: (row: T) => React.ReactNode;
  empty: { icon: React.ReactNode; title: string };
}) {
  const { t } = useTranslation();

  if (total === 0) {
    return <Card className="p-5"><EmptyState icon={empty.icon} title={empty.title} /></Card>;
  }
  return (
    <>
      {rows.map(render)}
      {limit < total && (
        <Button variant="secondary" className="w-full" onClick={onLoadMore}>
          {t("mobileReports.loadMore", { count: total - limit })}
        </Button>
      )}
    </>
  );
}

function TotalFooter({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3.5 bg-mobile-bg border-2 border-mobile-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mobile-text">{label}</span>
        <div className="text-right">
          <span className="text-sm font-bold text-mobile-text">{value}</span>
          {sub && <p className="text-xs text-mobile-text-muted mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mobile-text-muted">{label}</p>
      <p className="font-poppins text-[20px] font-bold text-mobile-text mt-1.5 truncate">{value}</p>
      {sub && <p className="text-[12px] text-mobile-text-secondary mt-0.5 truncate">{sub}</p>}
    </Card>
  );
}
