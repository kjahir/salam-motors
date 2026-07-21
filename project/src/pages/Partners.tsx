import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Wallet, TrendingUp, IndianRupee, AlertTriangle, Trash2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatINR, formatDate, formatPercent, initials } from "@/lib/format";
import { fetchPartners, fetchInvestments, fetchProfitDistributions, fetchFinancialSummaries } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { Partner, Investment, ProfitDistribution, VehicleFinancialSummary } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface PartnersProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

export function Partners({ onNavigate }: PartnersProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [investments, setInvestments] = useState<(Investment & { partner: Partner | null; vehicle: { id: string; stock_number: string; manufacturer: string; model: string } | null })[]>([]);
  const [distributions, setDistributions] = useState<(ProfitDistribution & { partner: Partner | null; vehicle: { id: string; stock_number: string } | null })[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", default_profit_share_pct: "50" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const reload = async () => {
    try {
      const [p, i, d, s] = await Promise.all([fetchPartners(), fetchInvestments(), fetchProfitDistributions(), fetchFinancialSummaries()]);
      setPartners(p);
      setInvestments(i);
      setDistributions(d);
      setSummaries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const partnerStats = useMemo(() => {
    return partners.map((p) => {
      const inv = investments.filter((i) => i.partner_id === p.id);
      const totalInvested = inv
        .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
        .reduce((s, i) => s + i.amount, 0);
      const dist = distributions.filter((d) => d.partner_id === p.id);
      const totalProfit = dist.reduce((s, d) => s + d.profit_share, 0);
      const totalPaid = dist.reduce((s, d) => s + d.amount_paid, 0);
      const balancePayable = dist.reduce((s, d) => s + d.balance_payable, 0);
      const activeVehicles = new Set(inv.filter((i) => i.vehicle_id).map((i) => i.vehicle_id)).size;
      return { partner: p, totalInvested, totalProfit, totalPaid, balancePayable, activeVehicles, investmentCount: inv.length };
    });
  }, [partners, investments, distributions]);

  const totalInvestedAll = partnerStats.reduce((s, p) => s + p.totalInvested, 0);
  const totalProfitAll = partnerStats.reduce((s, p) => s + p.totalProfit, 0);
  const totalPayableAll = partnerStats.reduce((s, p) => s + p.balancePayable, 0);

  const handleAdd = async () => {
    if (!form.name) {
      toast("Enter partner name", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("partners").insert({
        name: form.name,
        mobile: form.mobile || null,
        email: form.email || null,
        default_profit_share_pct: Number(form.default_profit_share_pct) || 0,
      });
      if (error) throw error;
      toast("Partner added", "success");
      setShowAdd(false);
      setForm({ name: "", mobile: "", email: "", default_profit_share_pct: "50" });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add partner", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner? Related investments will remain but become unlinked.")) return;
    try {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
      toast("Partner removed", "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Partners" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Partners" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Partners"
        description="Joint-venture partners, capital, and profit-share"
        icon={<Users size={20} />}
        actions={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> Add Partner</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Capital Invested" value={formatINR(totalInvestedAll, { compact: true })} icon={<Wallet size={20} />} color="brand" />
        <StatCard label="Total Profit Earned" value={formatINR(totalProfitAll, { compact: true })} icon={<TrendingUp size={20} />} color="emerald" />
        <StatCard label="Balance Payable" value={formatINR(totalPayableAll, { compact: true })} icon={<IndianRupee size={20} />} color="amber" />
      </div>

      {partnerStats.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Users size={24} />} title="No partners" description="Add joint-venture partners to track investments and profit sharing." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {partnerStats.map(({ partner: p, totalInvested, totalProfit, totalPaid, balancePayable, activeVehicles, investmentCount }) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
                    {initials(p.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.mobile ?? "No mobile"} · Joined {formatDate(p.joining_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={p.status === "active" ? "emerald" : "slate"}>{p.status}</Badge>
                  <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <div>
                  <p className="text-xs text-slate-500">Default Profit Share</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatPercent(p.default_profit_share_pct, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active Vehicles</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{activeVehicles}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Capital Invested</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatINR(totalInvested)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Profit Earned</p>
                  <p className="text-sm font-semibold text-emerald-600 mt-0.5">{formatINR(totalProfit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount Paid</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatINR(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Balance Payable</p>
                  <p className="text-sm font-semibold text-amber-600 mt-0.5">{formatINR(balancePayable)}</p>
                </div>
              </div>

              {/* Recent investments */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Recent Investments ({investmentCount})</p>
                {investments.filter((i) => i.partner_id === p.id).slice(0, 3).map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}
                    className="flex items-center justify-between w-full p-2 rounded hover:bg-slate-50 text-left text-sm"
                  >
                    <div>
                      <span className="text-slate-700">{inv.vehicle?.manufacturer} {inv.vehicle?.model}</span>
                      <span className="text-xs text-slate-400 ml-1.5">{inv.vehicle?.stock_number}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatINR(inv.amount)}</span>
                  </button>
                ))}
                {investmentCount === 0 && <p className="text-xs text-slate-400">No investments yet.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Profit-share allocations note */}
      <Card className="p-4 mt-5 bg-slate-50/50">
        <p className="text-xs text-slate-600">
          <strong className="font-medium">Profit-sharing model:</strong> Each vehicle uses the default partnership percentage ({partners.map((p) => `${p.default_profit_share_pct}%`).join(" / ")}) unless overridden on the vehicle. Capital is returned first, then profit is split per the agreed percentage.
        </p>
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Partner"
        footer={<>
          <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Add Partner</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Full Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Arjun Mehta" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mobile"><input className="input" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="9876543210" /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="arjun@example.com" /></Field>
          </div>
          <Field label="Default Profit Share %" hint="Sum of all partner percentages should equal 100%"><input className="input" type="number" value={form.default_profit_share_pct} onChange={(e) => setForm((f) => ({ ...f, default_profit_share_pct: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
