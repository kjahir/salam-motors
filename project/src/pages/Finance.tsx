import { useEffect, useMemo, useState } from "react";
import { Wallet, IndianRupee, Receipt, TrendingUp, Download, AlertTriangle, ShoppingCart, Banknote } from "lucide-react";
import { PageHeader, Tabs, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SettlementModal } from "@/components/SettlementModal";
import { viewProof } from "@/lib/proofStorage";
import { formatINR, formatDate, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import {
  fetchInvestments,
  fetchAllExpenses,
  fetchProfitDistributions,
  fetchAllPurchases,
  fetchAllSales,
  fetchFinancialSummaries,
} from "@/lib/queries";
import type { Investment, Expense, ProfitDistribution, ProfitSettlementPayment, Purchase, Sale, Vehicle, Partner, Party, VehicleFinancialSummary } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

type DistributionRow = ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };

interface FinanceProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

export function Finance({ onNavigate }: FinanceProps) {
  const [tab, setTab] = useState("investments");
  const [investments, setInvestments] = useState<(Investment & { partner: Partner | null; vehicle: { id: string; stock_number: string; manufacturer: string; model: string } | null })[]>([]);
  const [expenses, setExpenses] = useState<(Expense & { vehicle?: { id: string; stock_number: string; manufacturer: string; model: string } | null; partner?: { name: string } | null })[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [purchases, setPurchases] = useState<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]>([]);
  const [sales, setSales] = useState<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settlingDistribution, setSettlingDistribution] = useState<DistributionRow | null>(null);

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

      <Tabs
        tabs={[
          { key: "investments", label: "Investments", badge: <Badge color="slate">{investments.length}</Badge> },
          { key: "purchases", label: "Purchase", badge: <Badge color="slate">{purchases.length}</Badge> },
          { key: "expenses", label: "Expenses", badge: <Badge color="slate">{expenses.length}</Badge> },
          { key: "saleprofit", label: "Sale and Profit", badge: <Badge color="slate">{soldSales.length}</Badge> },
          { key: "settlements", label: "Settlements", badge: <Badge color="slate">{distributions.length}</Badge> },
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
                onClick={() => downloadCSV("investments.csv", investments.map((i) => ({
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
            {investments.length === 0 ? (
              <EmptyState icon={<IndianRupee size={20} />} title="No investments" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <Th>Partner</Th><Th>Vehicle</Th><Th className="text-right">Amount</Th><Th>Date</Th><Th>Purpose</Th><Th>Status</Th><Th></Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {investments.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 cursor-pointer" onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}>{inv.partner?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}>{inv.vehicle ? `${inv.vehicle.stock_number} · ${inv.vehicle.manufacturer} ${inv.vehicle.model}` : "General capital"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(inv.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.investment_date, { withTime: true })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{inv.purpose ?? "—"}</td>
                      <td className="px-4 py-3"><Badge color={inv.status === "Fully used" ? "emerald" : inv.status === "Received" ? "blue" : "amber"}>{inv.status}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {inv.proof_url && (
                          <button onClick={() => viewProof("finance-proofs", inv.proof_url!)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">Proof</button>
                        )}
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
                onClick={() => downloadCSV("purchases.csv", purchases.map((p) => ({
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
            {purchases.length === 0 ? (
              <EmptyState icon={<ShoppingCart size={20} />} title="No purchases" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <Th>Vehicle</Th><Th>Seller</Th><Th className="text-right">Agreed Price</Th><Th className="text-right">Fees</Th><Th className="text-right">Total</Th><Th>Payment</Th><Th>Date</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.map((p) => (
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
                onClick={() => downloadCSV("expenses.csv", expenses.map((e) => ({
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
            {expenses.length === 0 ? (
              <EmptyState icon={<Receipt size={20} />} title="No expenses" />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <Th>Vehicle</Th><Th>Category</Th><Th className="text-right">Amount</Th><Th>Paid By</Th><Th>Date</Th><Th>Bill</Th><Th>Status</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((e) => (
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
                onClick={() => downloadCSV("sale-and-profit.csv", soldSales.map((s) => {
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
            {soldSales.length === 0 ? (
              <EmptyState icon={<Banknote size={20} />} title="No sales" description="Completed sales and their profit appear here." />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <Th>Vehicle</Th><Th>Buyer</Th><Th className="text-right">Sale Price</Th><Th className="text-right">Total Cost</Th><Th className="text-right">Gross Profit</Th><Th className="text-right">Margin</Th><Th>Payment</Th><Th>Delivery</Th><Th>Date</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {soldSales.map((s) => {
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
                onClick={() => downloadCSV("settlements.csv", distributions.map((d) => ({
                  Partner: d.partner?.name ?? "",
                  Vehicle: d.vehicle ? `${d.vehicle.manufacturer} ${d.vehicle.model}` : "",
                  "Stock #": d.vehicle?.stock_number ?? "",
                  Principal: d.principal_return,
                  "Profit Share": d.profit_share,
                  "Total Entitlement": d.total_entitlement,
                  "Amount Paid": d.amount_paid,
                  "Balance Payable": d.balance_payable,
                  Status: d.status,
                })))}
                className="btn-ghost btn-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
            {distributions.length === 0 ? (
              <EmptyState icon={<TrendingUp size={20} />} title="No settlements" description="Profit distributions appear after a sale is completed." />
            ) : (
              <TableWrapper>
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <Th>Partner</Th><Th>Vehicle</Th><Th className="text-right">Principal</Th><Th className="text-right">Profit</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th>Status</Th><Th></Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {distributions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.partner?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => onNavigate("vehicle", { vehicleId: d.vehicle_id })}>{d.vehicle?.stock_number}</td>
                      <td className="px-4 py-3 text-right">{formatINR(d.principal_return)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(d.profit_share)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatINR(d.total_entitlement)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(d.amount_paid)}</td>
                      <td className="px-4 py-3"><Badge color={d.status === "Paid" ? "emerald" : d.status === "Calculated" ? "amber" : "slate"}>{d.status}</Badge></td>
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
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>;
}
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
