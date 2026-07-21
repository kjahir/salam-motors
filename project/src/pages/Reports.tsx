import { useEffect, useMemo, useState } from "react";
import {
  FileBarChart,
  Download,
  TrendingUp,
  Bike,
  Clock,
  IndianRupee,
  AlertTriangle,
} from "lucide-react";
import { PageHeader, Tabs, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge, AgeingBadge } from "@/components/ui/Badge";
import { formatINR, formatDate, daysSince, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { fetchVehicles, fetchFinancialSummaries, fetchProfitDistributions, fetchInvestments, fetchPartners } from "@/lib/queries";
import type { Vehicle, VehicleFinancialSummary, ProfitDistribution, Investment, Partner } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface ReportsProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

type ReportKey = "inventory" | "ageing" | "profit" | "partner-ledger" | "expenses";

export function Reports({ onNavigate }: ReportsProps) {
  const [tab, setTab] = useState<ReportKey>("inventory");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null })[]>([]);
  const [investments, setInvestments] = useState<(Investment & { partner: Partner | null; vehicle: Vehicle | null })[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [v, s, d, i, p] = await Promise.all([
          fetchVehicles(),
          fetchFinancialSummaries(),
          fetchProfitDistributions(),
          fetchInvestments(),
          fetchPartners(),
        ]);
        setVehicles(v);
        setSummaries(s);
        setDistributions(d);
        setInvestments(i);
        setPartners(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Reports" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Reports" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  const tabs = [
    { key: "inventory", label: "Inventory Report" },
    { key: "ageing", label: "Ageing Report" },
    { key: "profit", label: "Profit by Vehicle" },
    { key: "partner-ledger", label: "Partner Ledger" },
    { key: "expenses", label: "Expense Report" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Reports" description="Business intelligence and exports" icon={<FileBarChart size={20} />} />

      <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as ReportKey)} />

      <div className="mt-5">
        {tab === "inventory" && <InventoryReport vehicles={vehicles} summaryMap={summaryMap} onNavigate={onNavigate} />}
        {tab === "ageing" && <AgeingReport vehicles={vehicles} summaryMap={summaryMap} onNavigate={onNavigate} />}
        {tab === "profit" && <ProfitReport vehicles={vehicles} summaryMap={summaryMap} onNavigate={onNavigate} />}
        {tab === "partner-ledger" && <PartnerLedgerReport partners={partners} investments={investments} distributions={distributions} />}
        {tab === "expenses" && <ExpenseReport vehicles={vehicles} summaryMap={summaryMap} onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

function InventoryReport({ vehicles, summaryMap, onNavigate }: {
  vehicles: Vehicle[];
  summaryMap: Map<string, VehicleFinancialSummary>;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}) {
  const inStock = vehicles.filter((v) => !["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status));
  const totalCost = inStock.reduce((s, v) => s + (summaryMap.get(v.id)?.total_vehicle_cost ?? 0), 0);
  const totalAsking = inStock.reduce((s, v) => s + (v.asking_price ?? 0), 0);

  const exportCsv = () => {
    downloadCSV("inventory-report.csv", inStock.map((v) => {
      const s = summaryMap.get(v.id);
      return {
        "Stock #": v.stock_number,
        "Reg #": v.registration_number ?? "",
        Vehicle: `${v.manufacturer} ${v.model}`,
        Year: v.manufacture_year ?? "",
        Status: v.current_status,
        "Days in Stock": daysSince(v.onboarded_at),
        "Purchase Cost": s?.purchase_cost ?? 0,
        "Total Expense": s?.total_expense ?? 0,
        "Total Cost": s?.total_vehicle_cost ?? 0,
        "Asking Price": v.asking_price ?? 0,
        "Est. Profit": s?.estimated_profit ?? "",
        Invested: s?.total_invested ?? 0,
        Onboarded: formatDate(v.onboarded_at),
      };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Vehicles in Stock" value={inStock.length} icon={<Bike size={18} />} color="brand" />
        <StatCard label="Total Cost" value={formatINR(totalCost, { compact: true })} icon={<IndianRupee size={18} />} />
        <StatCard label="Total Asking" value={formatINR(totalAsking, { compact: true })} icon={<TrendingUp size={18} />} color="emerald" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Current Inventory</h3>
          <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600">
                <th className="px-4 py-3 font-medium">Stock #</th><th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Asking</th><th className="px-4 py-3 font-medium text-right">Est. Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inStock.map((v) => {
                const s = summaryMap.get(v.id);
                const ep = s?.estimated_profit;
                return (
                  <tr key={v.id} onClick={() => onNavigate("vehicle", { vehicleId: v.id })} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{v.stock_number}</td>
                    <td className="px-4 py-3 font-medium">{v.manufacturer} {v.model}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.current_status} /></td>
                    <td className="px-4 py-3 text-right">{formatINR(s?.total_vehicle_cost ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(v.asking_price)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${(ep ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatINR(ep)}</td>
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

function AgeingReport({ vehicles, summaryMap, onNavigate }: {
  vehicles: Vehicle[];
  summaryMap: Map<string, VehicleFinancialSummary>;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}) {
  const inStock = vehicles
    .filter((v) => !["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status))
    .map((v) => ({ v, days: daysSince(v.onboarded_at) }))
    .sort((a, b) => b.days - a.days);

  const breach = inStock.filter((x) => x.days >= 60);
  const high = inStock.filter((x) => x.days >= 45 && x.days < 60);
  const attention = inStock.filter((x) => x.days >= 30 && x.days < 45);
  const normal = inStock.filter((x) => x.days < 30);

  const exportCsv = () => {
    downloadCSV("ageing-report.csv", inStock.map(({ v, days }) => {
      const s = summaryMap.get(v.id);
      const band = days >= 60 ? "Breach" : days >= 45 ? "High priority" : days >= 30 ? "Attention" : "Normal";
      return {
        "Stock #": v.stock_number,
        Vehicle: `${v.manufacturer} ${v.model}`,
        "Days in Stock": days,
        "Band": band,
        "Total Cost": s?.total_vehicle_cost ?? 0,
        "Asking Price": v.asking_price ?? 0,
        "Est. Profit": s?.estimated_profit ?? "",
        Status: v.current_status,
      };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Normal (0-29d)" value={normal.length} icon={<Clock size={18} />} color="emerald" />
        <StatCard label="Attention (30-44d)" value={attention.length} icon={<Clock size={18} />} color="amber" />
        <StatCard label="High (45-59d)" value={high.length} icon={<Clock size={18} />} color="orange" />
        <StatCard label="Breach (60d+)" value={breach.length} icon={<AlertTriangle size={18} />} color="red" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Inventory Ageing</h3>
          <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600">
                <th className="px-4 py-3 font-medium">Vehicle</th><th className="px-4 py-3 font-medium">Days</th>
                <th className="px-4 py-3 font-medium">Band</th><th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Asking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inStock.map(({ v, days }) => {
                const s = summaryMap.get(v.id);
                return (
                  <tr key={v.id} onClick={() => onNavigate("vehicle", { vehicleId: v.id })} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3"><span className="font-medium">{v.manufacturer} {v.model}</span><span className="text-xs text-slate-500 ml-2 font-mono">{v.stock_number}</span></td>
                    <td className="px-4 py-3"><AgeingBadge days={days} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{days >= 60 ? "Breach" : days >= 45 ? "High priority" : days >= 30 ? "Attention" : "Normal"}</td>
                    <td className="px-4 py-3 text-right">{formatINR(s?.total_vehicle_cost ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(v.asking_price)}</td>
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

function ProfitReport({ vehicles, summaryMap, onNavigate }: {
  vehicles: Vehicle[];
  summaryMap: Map<string, VehicleFinancialSummary>;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}) {
  const sold = vehicles.filter((v) => v.current_status === "SOLD" || v.current_status === "DELIVERED");
  const totalProfit = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.gross_profit ?? 0), 0);
  const totalRevenue = sold.reduce((s, v) => s + (summaryMap.get(v.id)?.net_sale_revenue ?? 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const exportCsv = () => {
    downloadCSV("profit-report.csv", sold.map((v) => {
      const s = summaryMap.get(v.id);
      return {
        "Stock #": v.stock_number,
        Vehicle: `${v.manufacturer} ${v.model}`,
        "Sale Price": s?.sale_price ?? 0,
        "Total Cost": s?.total_vehicle_cost ?? 0,
        "Net Revenue": s?.net_sale_revenue ?? 0,
        "Gross Profit": s?.gross_profit ?? 0,
        "Margin %": s && s.net_sale_revenue > 0 ? formatPercent(((s.gross_profit ?? 0) / s.net_sale_revenue) * 100) : "",
        "Sold Date": formatDate(v.sold_at),
      };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Vehicles Sold" value={sold.length} icon={<Bike size={18} />} color="brand" />
        <StatCard label="Total Revenue" value={formatINR(totalRevenue, { compact: true })} icon={<IndianRupee size={18} />} />
        <StatCard label="Total Profit" value={formatINR(totalProfit, { compact: true })} icon={<TrendingUp size={18} />} color="emerald" />
      </div>
      {sold.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<TrendingUp size={20} />} title="No sales yet" description="Profit reports appear after vehicles are sold." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Profit by Vehicle · Avg margin {formatPercent(avgMargin)}</h3>
            <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-600">
                  <th className="px-4 py-3 font-medium">Vehicle</th><th className="px-4 py-3 font-medium text-right">Revenue</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th><th className="px-4 py-3 font-medium text-right">Profit</th>
                  <th className="px-4 py-3 font-medium text-right">Margin</th><th className="px-4 py-3 font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sold.map((v) => {
                  const s = summaryMap.get(v.id);
                  const profit = s?.gross_profit ?? 0;
                  const margin = s && s.net_sale_revenue > 0 ? (profit / s.net_sale_revenue) * 100 : 0;
                  return (
                    <tr key={v.id} onClick={() => onNavigate("vehicle", { vehicleId: v.id })} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3"><span className="font-medium">{v.manufacturer} {v.model}</span><span className="text-xs text-slate-500 ml-2 font-mono">{v.stock_number}</span></td>
                      <td className="px-4 py-3 text-right">{formatINR(s?.net_sale_revenue)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(s?.total_vehicle_cost)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatINR(profit)}</td>
                      <td className={`px-4 py-3 text-right ${margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPercent(margin)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(v.sold_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PartnerLedgerReport({ partners, investments, distributions }: {
  partners: Partner[];
  investments: (Investment & { partner: Partner | null; vehicle: Vehicle | null })[];
  distributions: (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null })[];
}) {
  const rows = partners.map((p) => {
    const inv = investments.filter((i) => i.partner_id === p.id);
    const dist = distributions.filter((d) => d.partner_id === p.id);
    const totalInvested = inv.filter((i) => ["Received", "Partially used", "Fully used"].includes(i.status)).reduce((s, i) => s + i.amount, 0);
    const principalReturned = dist.reduce((s, d) => s + d.principal_return, 0);
    const profitCredited = dist.reduce((s, d) => s + d.profit_share, 0);
    const paid = dist.reduce((s, d) => s + d.amount_paid, 0);
    const balance = dist.reduce((s, d) => s + d.balance_payable, 0);
    const closingBalance = totalInvested - principalReturned;
    return { partner: p, totalInvested, principalReturned, profitCredited, paid, balance, closingBalance, invCount: inv.length };
  });

  const exportCsv = () => {
    downloadCSV("partner-ledger.csv", rows.map((r) => ({
      Partner: r.partner.name,
      "Total Invested": r.totalInvested,
      "Principal Returned": r.principalReturned,
      "Profit Credited": r.profitCredited,
      "Amount Paid": r.paid,
      "Balance Payable": r.balance,
      "Closing Balance": r.closingBalance,
      "Investment Count": r.invCount,
    })));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">Partner Capital Ledger</h3>
        <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-600">
              <th className="px-4 py-3 font-medium">Partner</th>
              <th className="px-4 py-3 font-medium text-right">Invested</th>
              <th className="px-4 py-3 font-medium text-right">Principal Returned</th>
              <th className="px-4 py-3 font-medium text-right">Profit Credited</th>
              <th className="px-4 py-3 font-medium text-right">Paid</th>
              <th className="px-4 py-3 font-medium text-right">Balance</th>
              <th className="px-4 py-3 font-medium text-right">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.partner.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{r.partner.name}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.totalInvested)}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.principalReturned)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(r.profitCredited)}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.paid)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{formatINR(r.balance)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatINR(r.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr className="font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.totalInvested, 0))}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.principalReturned, 0))}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatINR(rows.reduce((s, r) => s + r.profitCredited, 0))}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.paid, 0))}</td>
              <td className="px-4 py-3 text-right text-amber-600">{formatINR(rows.reduce((s, r) => s + r.balance, 0))}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.closingBalance, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function ExpenseReport({ vehicles, summaryMap, onNavigate }: {
  vehicles: Vehicle[];
  summaryMap: Map<string, VehicleFinancialSummary>;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}) {
  const rows = vehicles.map((v) => {
    const s = summaryMap.get(v.id);
    return { v, s };
  }).filter((x) => x.s && x.s.total_expense > 0);

  const totalExpenses = rows.reduce((sum, r) => sum + (r.s?.total_expense ?? 0), 0);

  const exportCsv = () => {
    downloadCSV("expense-report.csv", rows.map(({ v, s }) => ({
      "Stock #": v.stock_number,
      Vehicle: `${v.manufacturer} ${v.model}`,
      Refurbishment: s?.refurbishment_cost ?? 0,
      Holding: s?.holding_cost ?? 0,
      Logistics: s?.logistics_cost ?? 0,
      "Docs & Selling": s?.documentation_selling_cost ?? 0,
      Other: s?.other_cost ?? 0,
      Total: s?.total_expense ?? 0,
    })));
  };

  return (
    <div className="space-y-4">
      <StatCard label="Total Expenses" value={formatINR(totalExpenses, { compact: true })} icon={<IndianRupee size={18} />} />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Expense Breakdown by Vehicle</h3>
          <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600">
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium text-right">Refurb</th>
                <th className="px-4 py-3 font-medium text-right">Holding</th>
                <th className="px-4 py-3 font-medium text-right">Logistics</th>
                <th className="px-4 py-3 font-medium text-right">Docs/Selling</th>
                <th className="px-4 py-3 font-medium text-right">Other</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ v, s }) => (
                <tr key={v.id} onClick={() => onNavigate("vehicle", { vehicleId: v.id })} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3"><span className="font-medium">{v.manufacturer} {v.model}</span><span className="text-xs text-slate-500 ml-2 font-mono">{v.stock_number}</span></td>
                  <td className="px-4 py-3 text-right">{formatINR(s?.refurbishment_cost)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(s?.holding_cost)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(s?.logistics_cost)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(s?.documentation_selling_cost)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(s?.other_cost)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatINR(s?.total_expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
