import { useEffect, useMemo, useState } from "react";
import { Wallet, IndianRupee, Receipt, TrendingUp, Download, AlertTriangle, ShoppingCart, Banknote, Search, ChevronUp, ChevronDown } from "lucide-react";
import { PageHeader, Tabs, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SettlementModal } from "@/components/SettlementModal";
import { Lightbox } from "@/components/ui/Lightbox";
import { useProofLightbox } from "@/hooks/useProofLightbox";
import { formatINR, formatDate, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/dateRange";
import {
  fetchInvestments,
  fetchAllExpenses,
  fetchProfitDistributions,
  fetchAllPurchases,
  fetchAllSales,
  fetchFinancialSummaries,
} from "@/lib/queries";
import type { Investment, Expense, ProfitDistribution, ProfitSettlementPayment, Purchase, Sale, Vehicle, Partner, Party, VehicleFinancialSummary } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

type SortDir = "asc" | "desc";
interface SortState {
  key: string;
  dir: SortDir;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function applySort<T>(rows: T[], sort: SortState | null, accessors: Record<string, (row: T) => string | number>): T[] {
  if (!sort || !accessors[sort.key]) return rows;
  const acc = accessors[sort.key];
  const sorted = [...rows].sort((a, b) => compareValues(acc(a), acc(b)));
  return sort.dir === "asc" ? sorted : sorted.reverse();
}

type DistributionRow = ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };

interface FinanceProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Finance({ onNavigate }: FinanceProps) {
  const [tab, setTab] = useState("investments");
  const [investments, setInvestments] = useState<(Investment & { partner: Partner | null; vehicle: Vehicle | null })[]>([]);
  const [expenses, setExpenses] = useState<(Expense & { vehicle?: Vehicle | null; partner?: Partner | null })[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [purchases, setPurchases] = useState<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]>([]);
  const [sales, setSales] = useState<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settlingDistribution, setSettlingDistribution] = useState<DistributionRow | null>(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [sort, setSort] = useState<SortState | null>(null);
  const proofLightbox = useProofLightbox("finance-proofs");

  useEffect(() => {
    setSort(null);
  }, [tab]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (vehicle: Vehicle | null | undefined) =>
      !q || [vehicle?.stock_number, vehicle?.registration_number, vehicle?.manufacturer, vehicle?.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
  }, [search]);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const reload = async () => {
    try {
      const [i, e, d, p, s, f] = await Promise.all([
        fetchInvestments(),
        fetchAllExpenses(),
        fetchProfitDistributions(),
        fetchAllPurchases(),
        fetchAllSales(),
        fetchFinancialSummaries(),
      ]);
      setInvestments(i);
      setExpenses(e);
      setDistributions(d);
      setPurchases(p);
      setSales(s);
      setSummaries(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

  const soldSales = useMemo(() => sales.filter((s) => s.status === "Completed"), [sales]);

  const totals = useMemo(() => {
    const totalInvested = investments
      .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
      .reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.filter((e) => e.approval_status === "Approved").reduce((s, e) => s + e.amount, 0);
    const pendingExpenses = expenses.filter((e) => e.approval_status === "Submitted" || e.approval_status === "Draft");
    const totalProfit = distributions.reduce((s, d) => s + d.profit_share, 0);
    const totalSettled = distributions.reduce((s, d) => s + d.amount_paid, 0);
    const totalPayable = distributions.reduce((s, d) => s + d.balance_payable, 0);
    return { totalInvested, totalExpenses, pendingExpenses, totalProfit, totalSettled, totalPayable };
  }, [investments, expenses, distributions]);

  const investmentRows = useMemo(() => {
    const filtered = investments.filter((i) => isWithinDateRange(i.investment_date, dateRange) && matches(i.vehicle));
    return applySort(filtered, sort, {
      partner: (i) => i.partner?.name ?? "",
      vehicle: (i) => i.vehicle ? `${i.vehicle.manufacturer} ${i.vehicle.model}` : "",
      amount: (i) => i.amount,
      date: (i) => +new Date(i.investment_date),
      purpose: (i) => i.purpose ?? "",
      status: (i) => i.status,
    });
  }, [investments, dateRange, matches, sort]);

  const purchaseRows = useMemo(() => {
    const filtered = purchases.filter((p) => isWithinDateRange(p.purchase_date, dateRange) && matches(p.vehicle));
    return applySort(filtered, sort, {
      vehicle: (p) => p.vehicle ? `${p.vehicle.manufacturer} ${p.vehicle.model}` : "",
      seller: (p) => p.seller?.full_name ?? "",
      agreedPrice: (p) => p.agreed_price,
      fees: (p) => p.broker_commission + p.other_fee,
      total: (p) => p.agreed_price + p.broker_commission + p.other_fee,
      payment: (p) => p.payment_status,
      date: (p) => +new Date(p.purchase_date),
    });
  }, [purchases, dateRange, matches, sort]);

  const expenseRows = useMemo(() => {
    const filtered = expenses.filter((e) => isWithinDateRange(e.expense_date, dateRange) && matches(e.vehicle));
    return applySort(filtered, sort, {
      vehicle: (e) => e.vehicle ? `${e.vehicle.manufacturer} ${e.vehicle.model}` : "",
      category: (e) => e.category,
      amount: (e) => e.amount,
      paidBy: (e) => e.partner?.name ?? "Business",
      date: (e) => +new Date(e.expense_date),
      bill: (e) => (e.bill_available ? 1 : 0),
      status: (e) => e.approval_status,
    });
  }, [expenses, dateRange, matches, sort]);

  const saleRows = useMemo(() => {
    const filtered = soldSales.filter((s) => isWithinDateRange(s.sale_date, dateRange) && matches(s.vehicle));
    return applySort(filtered, sort, {
      vehicle: (s) => s.vehicle ? `${s.vehicle.manufacturer} ${s.vehicle.model}` : "",
      buyer: (s) => s.buyer?.full_name ?? "",
      salePrice: (s) => s.sale_price,
      totalCost: (s) => summaryMap.get(s.vehicle_id)?.total_vehicle_cost ?? 0,
      grossProfit: (s) => summaryMap.get(s.vehicle_id)?.gross_profit ?? 0,
      margin: (s) => {
        const summary = summaryMap.get(s.vehicle_id);
        const netRevenue = summary?.net_sale_revenue ?? (s.sale_price + s.buyer_charges - s.discount);
        const grossProfit = summary?.gross_profit ?? 0;
        return netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
      },
      payment: (s) => s.payment_status,
      delivery: (s) => s.delivery_status,
      date: (s) => +new Date(s.sale_date),
    });
  }, [soldSales, dateRange, matches, sort, summaryMap]);

  const settlementRows = useMemo(() => {
    const filtered = distributions.filter((d) => isWithinDateRange(d.created_at, dateRange) && matches(d.vehicle));
    return applySort(filtered, sort, {
      partner: (d) => d.partner?.name ?? "",
      vehicle: (d) => d.vehicle ? `${d.vehicle.manufacturer} ${d.vehicle.model}` : "",
      principal: (d) => d.principal_return,
      profit: (d) => d.profit_share,
      total: (d) => d.total_entitlement,
      paid: (d) => d.amount_paid,
      status: (d) => d.status,
      date: (d) => +new Date(d.created_at),
    });
  }, [distributions, dateRange, matches, sort]);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Finance" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Finance" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Finance" description="Investments, expenses, and profit settlements" icon={<Wallet size={20} />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invested" value={formatINR(totals.totalInvested, { compact: true })} icon={<IndianRupee size={18} />} color="brand" />
        <StatCard label="Total Expenses" value={formatINR(totals.totalExpenses, { compact: true })} icon={<Receipt size={18} />} color="slate" />
        <StatCard label="Total Profit" value={formatINR(totals.totalProfit, { compact: true })} icon={<TrendingUp size={18} />} color="emerald" />
        <StatCard label="Payable to Partners" value={formatINR(totals.totalPayable, { compact: true })} icon={<Wallet size={18} />} color="amber" />
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by make, model or reg. no."
              className="input pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium ${dateRange === opt.value ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { key: "investments", label: "Investments", badge: <Badge color="slate">{investmentRows.length}</Badge> },
          { key: "purchases", label: "Purchase", badge: <Badge color="slate">{purchaseRows.length}</Badge> },
          { key: "expenses", label: "Expenses", badge: <Badge color="slate">{expenseRows.length}</Badge> },
          { key: "saleprofit", label: "Sale and Profit", badge: <Badge color="slate">{saleRows.length}</Badge> },
          { key: "settlements", label: "Settlements", badge: <Badge color="slate">{settlementRows.length}</Badge> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === "investments" && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">All Investments</h3>
              <button
                onClick={() => downloadCSV("investments.csv", investmentRows.map((i) => ({
                  Partner: i.partner?.name ?? "",
                  Vehicle: i.vehicle ? `${i.vehicle.manufacturer} ${i.vehicle.model}` : "",
                  "Stock #": i.vehicle?.stock_number ?? "",
                  Amount: i.amount,
                  Date: formatDate(i.investment_date, { withTime: true }),
                  Purpose: i.purpose ?? "",
                  Status: i.status,
                })))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {investmentRows.length === 0 ? (
              <EmptyState icon={<IndianRupee size={20} />} title="No investments" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <SortableTh sortKey="partner" sort={sort} onSort={toggleSort}>Partner</SortableTh>
                  <SortableTh sortKey="vehicle" sort={sort} onSort={toggleSort}>Vehicle</SortableTh>
                  <SortableTh sortKey="amount" sort={sort} onSort={toggleSort} className="text-right">Amount</SortableTh>
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>Date</SortableTh>
                  <SortableTh sortKey="purpose" sort={sort} onSort={toggleSort}>Purpose</SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                  <Th></Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {investmentRows.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 cursor-pointer" onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}>{inv.partner?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}>{inv.vehicle ? `${inv.vehicle.stock_number} · ${inv.vehicle.manufacturer} ${inv.vehicle.model}` : "General capital"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(inv.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.investment_date, { withTime: true })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{inv.purpose ?? "—"}</td>
                      <td className="px-4 py-3"><Badge color={inv.status === "Fully used" ? "emerald" : inv.status === "Received" ? "blue" : "amber"}>{inv.status}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const paths = inv.proof_urls?.length ? inv.proof_urls : inv.proof_url ? [inv.proof_url] : [];
                          return paths.length > 0 ? (
                            <button onClick={() => proofLightbox.open(paths)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                              Proof{paths.length > 1 ? ` (${paths.length})` : ""}
                            </button>
                          ) : null;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Card>
        )}

        {tab === "purchases" && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">All Purchases</h3>
              <button
                onClick={() => downloadCSV("purchases.csv", purchaseRows.map((p) => ({
                  Vehicle: p.vehicle ? `${p.vehicle.manufacturer} ${p.vehicle.model}` : "",
                  "Stock #": p.vehicle?.stock_number ?? "",
                  Seller: p.seller?.full_name ?? "",
                  "Agreed Price": p.agreed_price,
                  "Broker Commission": p.broker_commission,
                  "Other Fees": p.other_fee,
                  Total: p.agreed_price + p.broker_commission + p.other_fee,
                  "Payment Status": p.payment_status,
                  Date: formatDate(p.purchase_date, { withTime: true }),
                })))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {purchaseRows.length === 0 ? (
              <EmptyState icon={<ShoppingCart size={20} />} title="No purchases" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <SortableTh sortKey="vehicle" sort={sort} onSort={toggleSort}>Vehicle</SortableTh>
                  <SortableTh sortKey="seller" sort={sort} onSort={toggleSort}>Seller</SortableTh>
                  <SortableTh sortKey="agreedPrice" sort={sort} onSort={toggleSort} className="text-right">Agreed Price</SortableTh>
                  <SortableTh sortKey="fees" sort={sort} onSort={toggleSort} className="text-right">Fees</SortableTh>
                  <SortableTh sortKey="total" sort={sort} onSort={toggleSort} className="text-right">Total</SortableTh>
                  <SortableTh sortKey="payment" sort={sort} onSort={toggleSort}>Payment</SortableTh>
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>Date</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseRows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate("vehicle", { vehicleId: p.vehicle_id })}>
                      <td className="px-4 py-3 text-sm">{p.vehicle?.stock_number} · {p.vehicle?.manufacturer} {p.vehicle?.model}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.seller?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(p.agreed_price)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatINR(p.broker_commission + p.other_fee)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatINR(p.agreed_price + p.broker_commission + p.other_fee)}</td>
                      <td className="px-4 py-3"><Badge color={p.payment_status === "Paid" ? "emerald" : p.payment_status === "Partially paid" ? "amber" : "slate"}>{p.payment_status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.purchase_date, { withTime: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Card>
        )}

        {tab === "expenses" && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">All Expenses {totals.pendingExpenses.length > 0 && <Badge color="amber" className="ml-2">{totals.pendingExpenses.length} pending</Badge>}</h3>
              <button
                onClick={() => downloadCSV("expenses.csv", expenseRows.map((e) => ({
                  Vehicle: e.vehicle ? `${e.vehicle.manufacturer} ${e.vehicle.model}` : "",
                  "Stock #": e.vehicle?.stock_number ?? "",
                  Category: e.category,
                  Amount: e.amount,
                  "Paid By": e.partner?.name ?? "Business",
                  Vendor: e.vendor ?? "",
                  Date: formatDate(e.expense_date),
                  Bill: e.bill_available ? "Yes" : "No",
                  Status: e.approval_status,
                })))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {expenseRows.length === 0 ? (
              <EmptyState icon={<Receipt size={20} />} title="No expenses" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <SortableTh sortKey="vehicle" sort={sort} onSort={toggleSort}>Vehicle</SortableTh>
                  <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>Category</SortableTh>
                  <SortableTh sortKey="amount" sort={sort} onSort={toggleSort} className="text-right">Amount</SortableTh>
                  <SortableTh sortKey="paidBy" sort={sort} onSort={toggleSort}>Paid By</SortableTh>
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>Date</SortableTh>
                  <SortableTh sortKey="bill" sort={sort} onSort={toggleSort}>Bill</SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseRows.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate("vehicle", { vehicleId: e.vehicle_id })}>
                      <td className="px-4 py-3 text-sm">{e.vehicle?.stock_number} · {e.vehicle?.manufacturer} {e.vehicle?.model}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{e.category}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(e.amount)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.partner?.name ?? "Business"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(e.expense_date)}</td>
                      <td className="px-4 py-3">{e.bill_available ? <Badge color="emerald">Yes</Badge> : <Badge color="slate">No</Badge>}</td>
                      <td className="px-4 py-3"><Badge color={e.approval_status === "Approved" ? "emerald" : e.approval_status === "Submitted" ? "amber" : e.approval_status === "Rejected" ? "red" : "slate"}>{e.approval_status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Card>
        )}

        {tab === "saleprofit" && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Sale and Profit</h3>
              <button
                onClick={() => downloadCSV("sale-and-profit.csv", saleRows.map((s) => {
                  const summary = summaryMap.get(s.vehicle_id);
                  const netRevenue = s.sale_price + s.buyer_charges - s.discount;
                  return {
                    Vehicle: s.vehicle ? `${s.vehicle.manufacturer} ${s.vehicle.model}` : "",
                    "Stock #": s.vehicle?.stock_number ?? "",
                    Buyer: s.buyer?.full_name ?? "",
                    "Sale Price": s.sale_price,
                    "Total Cost": summary?.total_vehicle_cost ?? 0,
                    "Net Revenue": netRevenue,
                    "Gross Profit": summary?.gross_profit ?? 0,
                    "Payment Status": s.payment_status,
                    "Delivery Status": s.delivery_status,
                    Date: formatDate(s.sale_date, { withTime: true }),
                  };
                }))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {saleRows.length === 0 ? (
              <EmptyState icon={<Banknote size={20} />} title="No sales" description="Completed sales and their profit appear here." />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <SortableTh sortKey="vehicle" sort={sort} onSort={toggleSort}>Vehicle</SortableTh>
                  <SortableTh sortKey="buyer" sort={sort} onSort={toggleSort}>Buyer</SortableTh>
                  <SortableTh sortKey="salePrice" sort={sort} onSort={toggleSort} className="text-right">Sale Price</SortableTh>
                  <SortableTh sortKey="totalCost" sort={sort} onSort={toggleSort} className="text-right">Total Cost</SortableTh>
                  <SortableTh sortKey="grossProfit" sort={sort} onSort={toggleSort} className="text-right">Gross Profit</SortableTh>
                  <SortableTh sortKey="margin" sort={sort} onSort={toggleSort} className="text-right">Margin</SortableTh>
                  <SortableTh sortKey="payment" sort={sort} onSort={toggleSort}>Payment</SortableTh>
                  <SortableTh sortKey="delivery" sort={sort} onSort={toggleSort}>Delivery</SortableTh>
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>Date</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {saleRows.map((s) => {
                    const summary = summaryMap.get(s.vehicle_id);
                    const grossProfit = summary?.gross_profit ?? 0;
                    const netRevenue = summary?.net_sale_revenue ?? (s.sale_price + s.buyer_charges - s.discount);
                    const marginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate("vehicle", { vehicleId: s.vehicle_id })}>
                        <td className="px-4 py-3 text-sm">{s.vehicle?.stock_number} · {s.vehicle?.manufacturer} {s.vehicle?.model}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{s.buyer?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatINR(s.sale_price)}</td>
                        <td className="px-4 py-3 text-right">{formatINR(summary?.total_vehicle_cost ?? 0)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatINR(grossProfit)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatPercent(marginPct)}</td>
                        <td className="px-4 py-3"><Badge color={s.payment_status === "Paid" ? "emerald" : s.payment_status === "Partially paid" ? "amber" : "slate"}>{s.payment_status}</Badge></td>
                        <td className="px-4 py-3"><Badge color={s.delivery_status === "Delivered" ? "emerald" : "amber"}>{s.delivery_status}</Badge></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(s.sale_date, { withTime: true })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}
          </Card>
        )}

        {tab === "settlements" && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Profit Settlements</h3>
              <button
                onClick={() => downloadCSV("settlements.csv", settlementRows.map((d) => ({
                  Partner: d.partner?.name ?? "",
                  Vehicle: d.vehicle ? `${d.vehicle.manufacturer} ${d.vehicle.model}` : "",
                  "Stock #": d.vehicle?.stock_number ?? "",
                  Principal: d.principal_return,
                  "Profit Share": d.profit_share,
                  "Total Entitlement": d.total_entitlement,
                  "Amount Paid": d.amount_paid,
                  "Balance Payable": d.balance_payable,
                  Status: d.status,
                  Date: formatDate(d.created_at, { withTime: true }),
                })))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {settlementRows.length === 0 ? (
              <EmptyState icon={<TrendingUp size={20} />} title="No settlements" description="Profit distributions appear after a sale is completed." />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <SortableTh sortKey="partner" sort={sort} onSort={toggleSort}>Partner</SortableTh>
                  <SortableTh sortKey="vehicle" sort={sort} onSort={toggleSort}>Vehicle</SortableTh>
                  <SortableTh sortKey="principal" sort={sort} onSort={toggleSort} className="text-right">Principal</SortableTh>
                  <SortableTh sortKey="profit" sort={sort} onSort={toggleSort} className="text-right">Profit</SortableTh>
                  <SortableTh sortKey="total" sort={sort} onSort={toggleSort} className="text-right">Total</SortableTh>
                  <SortableTh sortKey="paid" sort={sort} onSort={toggleSort} className="text-right">Paid</SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>Date</SortableTh>
                  <Th></Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {settlementRows.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.partner?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => onNavigate("vehicle", { vehicleId: d.vehicle_id })}>{d.vehicle?.stock_number}</td>
                      <td className="px-4 py-3 text-right">{formatINR(d.principal_return)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(d.profit_share)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatINR(d.total_entitlement)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(d.amount_paid)}</td>
                      <td className="px-4 py-3"><Badge color={d.status === "Paid" ? "emerald" : d.status === "Calculated" ? "amber" : "slate"}>{d.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(d.created_at, { withTime: true })}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSettlingDistribution(d)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                          {d.status === "Paid" ? "View" : "Settle"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Card>
        )}
      </div>

      {settlingDistribution && (
        <SettlementModal
          distribution={settlingDistribution}
          open={Boolean(settlingDistribution)}
          onClose={() => setSettlingDistribution(null)}
          onSaved={reload}
        />
      )}
      {proofLightbox.lightbox && (
        <Lightbox
          items={proofLightbox.lightbox.items}
          index={proofLightbox.lightbox.index}
          onClose={proofLightbox.close}
          onIndexChange={proofLightbox.setIndex}
        />
      )}
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>;
}
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

function SortableTh({ children, sortKey, sort, onSort, className = "" }: {
  children?: React.ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-4 py-3 font-medium select-none ${className}`}>
      <button onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-slate-900 ${active ? "text-slate-900" : ""}`}>
        {children}
        {active ? (sort!.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />}
      </button>
    </th>
  );
}
