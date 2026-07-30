import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, TrendingUp, ShoppingCart, Bike, ArrowUpDown, Wallet, Receipt, Users } from "lucide-react";
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
import { vehicleRef } from "@/lib/vehicleLabel";
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

type ReportTab = "investments" | "purchases" | "expenses" | "inventory" | "sales" | "settlements";
type SortDir = "desc" | "asc";

const PAGE_SIZE = 10;

export function MobileReports() {
  const [tab, setTab] = useState<ReportTab>("inventory");
  const [purchases, setPurchases] = useState<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]>([]);
  const [sales, setSales] = useState<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [investments, setInvestments] = useState<(Investment & { vehicle?: Vehicle | null; partner?: Partner | null })[]>([]);
  const [expenses, setExpenses] = useState<(Expense & { vehicle?: Vehicle | null; partner?: Partner | null })[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null; vehicle?: Vehicle | null })[]>([]);
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
  const investmentRows = useMemo(
    () =>
      investments
        .filter((i) => isWithinDateRange(i.investment_date, dateRange) && matches(i.vehicle))
        .sort((a, b) => dirFactor * (+new Date(a.investment_date) - +new Date(b.investment_date))),
    [investments, dateRange, matches, dirFactor],
  );
  const expenseRows = useMemo(
    () =>
      expenses
        .filter((e) => isWithinDateRange(e.expense_date, dateRange) && matches(e.vehicle))
        .sort((a, b) => dirFactor * (+new Date(a.expense_date) - +new Date(b.expense_date))),
    [expenses, dateRange, matches, dirFactor],
  );
  const settlementRows = useMemo(
    () => distributions.filter((d) => matches(d.vehicle)),
    [distributions, matches],
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
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mobile-text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("financePage.searchPlaceholder")} className="pl-10" />
        </div>
        <SegmentedTabs
          tabs={[
            { key: "inventory", label: t("mobileReports.tabs.inventory") },
            { key: "investments", label: t("financePage.tabs.investments") },
            { key: "purchases", label: t("mobileReports.tabs.purchases") },
            { key: "expenses", label: t("financePage.tabs.expenses") },
            { key: "sales", label: t("mobileReports.tabs.sales") },
            { key: "settlements", label: t("financePage.tabs.settlements") },
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
                        <p className="text-xs text-mobile-text-muted font-mono">{vehicleRef(v)}</p>
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
        {tab === "investments" && (
          <>
            <ListSection
              empty={{ icon: <Wallet size={20} />, title: t("financePage.empty.investments") }}
              rows={investmentRows.slice(0, limit)}
              total={investmentRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(i) => (
                <Card key={i.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{i.partner?.name ?? "—"}</p>
                      <p className="text-xs text-mobile-text-muted truncate">
                        {i.vehicle ? vehicleRef(i.vehicle) : t("financePage.generalCapital")} · {formatDate(i.investment_date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-mobile-text shrink-0">{formatINR(i.amount)}</span>
                  </div>
                </Card>
              )}
            />
            {investmentRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: investmentRows.length })}
                value={formatINR(investmentRows.reduce((sum, i) => sum + i.amount, 0))}
              />
            )}
          </>
        )}
        {tab === "expenses" && (
          <>
            <ListSection
              empty={{ icon: <Receipt size={20} />, title: t("financePage.empty.expenses") }}
              rows={expenseRows.slice(0, limit)}
              total={expenseRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(e) => (
                <Card key={e.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{e.category}</p>
                      <p className="text-xs text-mobile-text-muted truncate">
                        {vehicleRef(e.vehicle)} · {formatDate(e.expense_date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-mobile-text">{formatINR(e.amount)}</p>
                      <p className="text-xs text-mobile-text-muted">{e.partner?.name ?? t("financePage.business")}</p>
                    </div>
                  </div>
                </Card>
              )}
            />
            {expenseRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: expenseRows.length })}
                value={formatINR(expenseRows.reduce((sum, e) => sum + e.amount, 0))}
              />
            )}
          </>
        )}
        {tab === "settlements" && (
          <>
            <ListSection
              empty={{ icon: <Users size={20} />, title: t("financePage.empty.settlements") }}
              rows={settlementRows.slice(0, limit)}
              total={settlementRows.length}
              limit={limit}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
              render={(d) => (
                <Card key={d.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{d.partner?.name ?? "—"}</p>
                      <p className="text-xs text-mobile-text-muted truncate">
                        {d.vehicle ? vehicleRef(d.vehicle) : "—"} · {t("financePage.columns.profit")} {formatINR(d.profit_share)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-mobile-text">{formatINR(d.total_entitlement)}</p>
                      <p className={`text-xs font-medium ${d.balance_payable > 0 ? "text-mobile-warning" : "text-mobile-success"}`}>
                        {formatINR(d.balance_payable)}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            />
            {settlementRows.length > 0 && (
              <TotalFooter
                label={t("mobileReports.totalWithCount", { count: settlementRows.length })}
                value={formatINR(settlementRows.reduce((sum, d) => sum + d.total_entitlement, 0))}
                sub={t("financePage.payableToPartners") + ": " + formatINR(settlementRows.reduce((sum, d) => sum + d.balance_payable, 0))}
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
