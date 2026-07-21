import { useEffect, useMemo, useState, useRef } from "react";
import {
  ChevronLeft,
  Bike,
  IndianRupee,
  Receipt,
  ClipboardCheck,
  FileText,
  ShoppingCart,
  TrendingUp,
  History,
  Plus,
  Trash2,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Upload,
  Camera,
  Star,
  Pencil,
  Search,
} from "lucide-react";
import { PageHeader, Tabs, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge, ScoreBadge, VerificationBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatINR, formatDate, daysSince, formatPercent } from "@/lib/format";
import {
  computeCostBreakdown,
  computeProfit,
  computeOverallScore,
  computePartnerFunding,
  documentCompleteness,
} from "@/lib/calc";
import { fetchVehicleFull, fetchPartners, fetchParties, fetchMechanics } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  EXPENSE_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_VERIFICATION_STATUSES,
  INVESTMENT_STATUSES,
} from "@/lib/constants";
import type { VehicleWithRelations, Partner, Party, Expense, VehicleDocument, Inspection, InspectionItem, MechanicInspectionFeedback } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface VehicleDetailProps {
  vehicleId: string;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
  onBack: () => void;
}

export function VehicleDetail({ vehicleId, onNavigate, onBack }: VehicleDetailProps) {
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const { toast } = useToast();

  const reload = async () => {
    try {
      const v = await fetchVehicleFull(vehicleId);
      setVehicle(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicle");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, p] = await Promise.all([fetchVehicleFull(vehicleId), fetchPartners()]);
        if (cancelled) return;
        setVehicle(v);
        setPartners(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load vehicle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(
    () => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []),
    [vehicle],
  );
  const profit = useMemo(() => computeProfit(vehicle?.sale, cost), [vehicle, cost]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);

  const latestInspection = (vehicle?.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const inspectionItems: InspectionItem[] = latestInspection?.items ?? [];
  const overallScore = useMemo(() => computeOverallScore(inspectionItems), [inspectionItems]);
  const docCompleteness = useMemo(
    () => documentCompleteness(vehicle?.documents ?? []),
    [vehicle],
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={onBack} className="btn-ghost mb-4"><ChevronLeft size={16} /> Back</button>
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Vehicle not found" description={error ?? undefined} /></Card>
      </div>
    );
  }

  const days = daysSince(vehicle.onboarded_at);
  const isSold = vehicle.current_status === "SOLD" || vehicle.current_status === "DELIVERED";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "purchase", label: "Purchase" },
    { key: "investment", label: "Investment" },
    { key: "expenses", label: "Expenses", badge: <Badge color="slate">{vehicle.expenses?.length ?? 0}</Badge> },
    { key: "inspection", label: "Inspection" },
    { key: "documents", label: "Documents", badge: <Badge color="slate">{vehicle.documents?.length ?? 0}</Badge> },
    { key: "sale", label: "Sale & Profit" },
    { key: "passport", label: "Passport" },
    { key: "alerts", label: "Alerts", badge: (vehicle.alerts?.filter((a) => a.status === "Open").length ?? 0) > 0 ? <Badge color="red">{vehicle.alerts?.filter((a) => a.status === "Open").length}</Badge> : undefined },
    { key: "history", label: "History" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={onBack} className="btn-ghost mb-3 text-sm"><ChevronLeft size={16} /> Back to Inventory</button>

      <PageHeader
        title={`${vehicle.manufacturer} ${vehicle.model}`}
        description={`${vehicle.stock_number} · ${vehicle.registration_number ?? "No registration"} · ${vehicle.manufacture_year ?? "—"}`}
        icon={<Bike size={20} />}
        actions={
          <>
            <button onClick={() => onNavigate("passport", { vehicleId: vehicle.id })} className="btn-secondary">
              <Share2 size={16} /> View Passport
            </button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="p-4">
          <p className="stat-label">Status</p>
          <div className="mt-1.5"><StatusBadge status={vehicle.current_status} /></div>
        </Card>
        <Card className="p-4">
          <p className="stat-label">Days in Stock</p>
          <p className="stat-value mt-1.5">{isSold ? `${Math.round((new Date(vehicle.sold_at ?? vehicle.onboarded_at).getTime() - new Date(vehicle.onboarded_at).getTime()) / 86400000)}d` : `${days}d`}</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">Total Vehicle Cost</p>
          <p className="stat-value mt-1.5">{formatINR(cost.totalVehicleCost)}</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">{isSold ? "Realised Profit" : "Est. Profit"}</p>
          <p className={`stat-value mt-1.5 ${profit ? (profit.grossProfit >= 0 ? "text-emerald-600" : "text-red-600") : "text-slate-900"}`}>
            {profit ? formatINR(profit.grossProfit) : formatINR(vehicle.asking_price ? vehicle.asking_price - cost.totalVehicleCost : null)}
          </p>
        </Card>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === "overview" && <OverviewTab vehicle={vehicle} cost={cost} profit={profit} overallScore={overallScore} docCompleteness={docCompleteness} funding={funding} />}
        {tab === "purchase" && <PurchaseTab vehicle={vehicle} />}
        {tab === "investment" && <InvestmentTab vehicle={vehicle} partners={partners} funding={funding} onChanged={reload} />}
        {tab === "expenses" && <ExpensesTab vehicle={vehicle} partners={partners} onChanged={reload} />}
        {tab === "inspection" && <InspectionTab vehicle={vehicle} overallScore={overallScore} onChanged={reload} />}
        {tab === "documents" && <DocumentsTab vehicle={vehicle} onChanged={reload} />}
        {tab === "sale" && <SaleTab vehicle={vehicle} cost={cost} profit={profit} funding={funding} partners={partners} onChanged={reload} onNavigate={onNavigate} />}
        {tab === "passport" && <PassportPreviewTab vehicle={vehicle} overallScore={overallScore} />}
        {tab === "alerts" && <AlertsTab vehicle={vehicle} onChanged={reload} />}
        {tab === "history" && <HistoryTab vehicle={vehicle} />}
      </div>
    </div>
  );
}

// ============ OVERVIEW ============
function OverviewTab({ vehicle, cost, profit, overallScore, docCompleteness, funding }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  overallScore: number | null;
  docCompleteness: ReturnType<typeof documentCompleteness>;
  funding: ReturnType<typeof computePartnerFunding>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold text-slate-900 mb-4">Vehicle Specifications</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          <Spec label="Category" value={vehicle.category} />
          <Spec label="Fuel Type" value={vehicle.fuel_type} />
          <Spec label="Colour" value={vehicle.colour} />
          <Spec label="Year" value={String(vehicle.manufacture_year ?? "—")} />
          <Spec label="Odometer" value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("en-IN")} km` : "—"} />
          <Spec label="Previous Owners" value={String(vehicle.owner_count)} />
          <Spec label="Registration Date" value={formatDate(vehicle.registration_date)} />
          <Spec label="Registration City" value={vehicle.registration_city} />
          <Spec label="Registration State" value={vehicle.registration_state} />
          <Spec label="Chassis #" value={vehicle.chassis_number} />
          <Spec label="Engine #" value={vehicle.engine_number} />
          <Spec label="Current Location" value={vehicle.current_location} />
        </div>
        {vehicle.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-700">{vehicle.notes}</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Health Score</h3>
        <div className="flex flex-col items-center">
          <ScoreRing score={overallScore} label="Overall score" />
          <p className="text-xs text-slate-500 mt-3 text-center">
            {overallScore === null
              ? "No inspection recorded yet"
              : overallScore >= 70
                ? "Vehicle is in good condition"
                : "Needs attention before sale"}
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Documents</span>
            <span className="font-medium">{docCompleteness.verified}/{docCompleteness.total} verified</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${docCompleteness.pct}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold text-slate-900 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Spec label="Purchase Cost" value={formatINR(cost.purchaseCost)} />
          <Spec label="Refurbishment" value={formatINR(cost.refurbishmentCost)} />
          <Spec label="Holding Cost" value={formatINR(cost.holdingCost)} />
          <Spec label="Logistics Cost" value={formatINR(cost.logisticsCost)} />
          <Spec label="Docs & Selling" value={formatINR(cost.documentationSellingCost)} />
          <Spec label="Other Cost" value={formatINR(cost.otherCost)} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Total Vehicle Cost</span>
          <span className="text-lg font-bold text-slate-900">{formatINR(cost.totalVehicleCost)}</span>
        </div>
        {profit && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Net Sale Revenue</span>
              <span className="text-sm font-medium">{formatINR(profit.netSaleRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Gross Profit</span>
              <span className={`text-sm font-bold ${profit.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatINR(profit.grossProfit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Margin</span>
              <span className="text-sm font-medium">{formatPercent(profit.profitMarginPct)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Return on Cost</span>
              <span className="text-sm font-medium">{formatPercent(profit.returnOnCostPct)}</span>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Partner Funding</h3>
        {funding.length === 0 ? (
          <EmptyState title="No investments" description="Record an investment in the Investment tab." />
        ) : (
          <div className="space-y-3">
            {funding.map((f) => {
              const partner = vehicle.investments?.find((i) => i.partner_id === f.partnerId)?.partner;
              return (
                <div key={f.partnerId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{partner?.name ?? "—"}</span>
                    <span className="text-slate-600">{formatINR(f.totalInvested)}</span>
                  </div>
                  <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${f.fundingPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{formatPercent(f.fundingPct, 1)} of vehicle funding</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

// ============ PURCHASE ============
function PurchaseTab({ vehicle }: { vehicle: VehicleWithRelations }) {
  const p = vehicle.purchase;
  if (!p) return <Card className="p-6"><EmptyState icon={<ShoppingCart size={20} />} title="No purchase record" /></Card>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Purchase Details</h3>
        <div className="space-y-3">
          <Spec label="Seller" value={p.seller?.full_name} />
          <Spec label="Seller Mobile" value={p.seller?.mobile} />
          <Spec label="Purchase Date" value={formatDate(p.purchase_date, { withTime: true })} />
          <Spec label="Agreed Price" value={formatINR(p.agreed_price)} />
          <Spec label="Broker Commission" value={formatINR(p.broker_commission)} />
          <Spec label="Other Fees" value={formatINR(p.other_fee)} />
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="font-semibold">Total Purchase Cost</span>
            <span className="font-bold text-lg">{formatINR(p.agreed_price + p.broker_commission + p.other_fee)}</span>
          </div>
          <Spec label="Payment Status" value={p.payment_status} />
          <Spec label="Handover Location" value={p.handover_location} />
          <Spec label="Odometer at Purchase" value={p.odometer_at_purchase ? `${p.odometer_at_purchase.toLocaleString("en-IN")} km` : "—"} />
          <div className="flex gap-4">
            <Spec label="Keys Received" value={p.keys_received ? "Yes" : "No"} />
            <Spec label="Documents Received" value={p.documents_received ? "Yes" : "No"} />
          </div>
          {p.notes && <Spec label="Notes" value={p.notes} />}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Payment Records</h3>
        {p.payments && p.payments.length > 0 ? (
          <div className="space-y-3">
            {p.payments.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatINR(pay.amount)}</p>
                  <p className="text-xs text-slate-500">{pay.payment_method} · {formatDate(pay.paid_at, { withTime: true })}</p>
                  {pay.reference && <p className="text-xs text-slate-400 font-mono mt-0.5">{pay.reference}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No payments recorded" />
        )}
      </Card>
    </div>
  );
}

// ============ INVESTMENT ============
function InvestmentTab({ vehicle, partners, funding, onChanged }: {
  vehicle: VehicleWithRelations;
  partners: Partner[];
  funding: ReturnType<typeof computePartnerFunding>;
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("Vehicle investment");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!partnerId || !amount || Number(amount) <= 0) {
      toast("Select partner and enter amount", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("investments").insert({
        partner_id: partnerId,
        vehicle_id: vehicle.id,
        amount: Number(amount),
        purpose,
        status: "Received",
      });
      if (error) throw error;
      toast("Investment added", "success");
      setShowAdd(false);
      setAmount("");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add investment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this investment record?")) return;
    try {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
      toast("Investment removed", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Partner Funding Summary</h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Investment</button>
        </div>
        {funding.length === 0 ? (
          <EmptyState icon={<IndianRupee size={20} />} title="No investments" description="Add an investment to track partner capital." />
        ) : (
          <div className="space-y-4">
            {funding.map((f) => {
              const partner = vehicle.investments?.find((i) => i.partner_id === f.partnerId)?.partner;
              return (
                <div key={f.partnerId} className="p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-900">{partner?.name ?? "—"}</span>
                    <span className="text-lg font-bold text-slate-900">{formatINR(f.totalInvested)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${f.fundingPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatPercent(f.fundingPct, 1)} of total vehicle funding</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Investment Records</h3>
        {vehicle.investments && vehicle.investments.length > 0 ? (
          <div className="space-y-2">
            {vehicle.investments.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{inv.partner?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{formatINR(inv.amount)} · {formatDate(inv.investment_date, { withTime: true })}</p>
                  {inv.purpose && <p className="text-xs text-slate-400 mt-0.5">{inv.purpose}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={inv.status === "Fully used" ? "emerald" : inv.status === "Received" ? "blue" : "amber"}>{inv.status}</Badge>
                  <button onClick={() => handleDelete(inv.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No investment records" />
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Investment"
        description={`Record partner capital for ${vehicle.stock_number}`}
        footer={
          <>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Add</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Partner" required>
            <Select value={partnerId} onChange={setPartnerId} placeholder="Select partner" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Amount (₹)" required>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="62000" />
          </Field>
          <Field label="Purpose">
            <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ============ EXPENSES ============
function ExpensesTab({ vehicle, partners, onChanged }: {
  vehicle: VehicleWithRelations;
  partners: Partner[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Spare parts", amount: "", vendor: "", description: "", paid_by_partner_id: "", bill_available: false, approval_status: "Approved" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        vehicle_id: vehicle.id,
        category: form.category,
        amount: Number(form.amount),
        paid_by_partner_id: form.paid_by_partner_id || null,
        vendor: form.vendor || null,
        description: form.description || null,
        bill_available: form.bill_available,
        approval_status: form.approval_status,
        approved_by: form.approval_status === "Approved" ? "Operator" : null,
        approved_at: form.approval_status === "Approved" ? new Date().toISOString() : null,
      });
      if (error) throw error;
      toast("Expense added", "success");
      setShowAdd(false);
      setForm({ category: "Spare parts", amount: "", vendor: "", description: "", paid_by_partner_id: "", bill_available: false, approval_status: "Approved" });
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add expense", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast("Expense removed", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const handleApprove = async (e: Expense) => {
    try {
      const { error } = await supabase.from("expenses").update({ approval_status: "Approved", approved_by: "Operator", approved_at: new Date().toISOString() }).eq("id", e.id);
      if (error) throw error;
      toast("Expense approved", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    }
  };

  const total = (vehicle.expenses ?? []).filter((e) => e.approval_status === "Approved" || e.approval_status === "Paid").reduce((s, e) => s + e.amount, 0);
  const pending = (vehicle.expenses ?? []).filter((e) => e.approval_status === "Submitted" || e.approval_status === "Draft").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4"><p className="stat-label">Total Approved Expenses</p><p className="stat-value mt-1">{formatINR(total)}</p></Card>
        <Card className="p-4"><p className="stat-label">Pending Approval</p><p className="stat-value mt-1">{pending}</p></Card>
        <Card className="p-4"><p className="stat-label">Total Records</p><p className="stat-value mt-1">{vehicle.expenses?.length ?? 0}</p></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Expense Records</h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Expense</button>
        </div>
        {vehicle.expenses && vehicle.expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Category</th><th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium">Paid By</th><th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Bill</th><th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.expenses.map((e) => {
                  const partner = partners.find((p) => p.id === e.paid_by_partner_id);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2.5"><span className="font-medium text-slate-900">{e.category}</span>{e.description && <p className="text-xs text-slate-500">{e.description}</p>}</td>
                      <td className="py-2.5 text-right font-medium">{formatINR(e.amount)}</td>
                      <td className="py-2.5 text-slate-600">{partner?.name ?? "Business"}</td>
                      <td className="py-2.5 text-slate-500 text-xs">{formatDate(e.expense_date)}</td>
                      <td className="py-2.5">{e.bill_available ? <Badge color="emerald">Yes</Badge> : <Badge color="slate">No</Badge>}</td>
                      <td className="py-2.5"><Badge color={e.approval_status === "Approved" ? "emerald" : e.approval_status === "Submitted" ? "amber" : e.approval_status === "Rejected" ? "red" : "slate"}>{e.approval_status}</Badge></td>
                      <td className="py-2.5 text-right">
                        {e.approval_status === "Submitted" && <button onClick={() => handleApprove(e)} className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-2">Approve</button>}
                        <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Receipt size={20} />} title="No expenses recorded" description="Add refurbishment, transportation, or other vehicle expenses." />
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Expense"
        footer={<>
          <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Add Expense</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Category" required>
            <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EXPENSE_CATEGORIES} />
          </Field>
          <Field label="Amount (₹)" required>
            <input className="input" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="3500" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Paid By">
              <Select value={form.paid_by_partner_id} onChange={(v) => setForm((f) => ({ ...f, paid_by_partner_id: v }))} placeholder="Business" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
            <Field label="Vendor">
              <input className="input" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Sai Spares" />
            </Field>
          </div>
          <Field label="Description">
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brake pads + air filter" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bill Available">
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.bill_available} onChange={(e) => setForm((f) => ({ ...f, bill_available: e.target.checked }))} className="rounded border-slate-300" />
                <span className="text-sm">Bill attached</span>
              </label>
            </Field>
            <Field label="Approval Status">
              <Select value={form.approval_status} onChange={(v) => setForm((f) => ({ ...f, approval_status: v }))} options={EXPENSE_STATUSES} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ INSPECTION ============
function InspectionTab({ vehicle, overallScore, onChanged }: { vehicle: VehicleWithRelations; overallScore: number | null; onChanged: () => void }) {
  const insp = (vehicle.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const [mechanics, setMechanics] = useState<Party[]>([]);
  const [showLinkMechanic, setShowLinkMechanic] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ mechanic_party_id: "", rating: "3", feedback_text: "", areas_of_concern: "", recommended_actions: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMechanics().then(setMechanics).catch(() => { /* ignore */ });
  }, []);

  const feedback = (vehicle.mechanic_feedback ?? []) as (MechanicInspectionFeedback & { mechanic?: Party | null })[];

  const handleLinkMechanic = async () => {
    if (!insp || !selectedMechanic) {
      toast("Select a mechanic to link", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("inspections")
        .update({ mechanic_party_id: selectedMechanic })
        .eq("id", insp.id);
      if (error) throw error;
      toast("Mechanic linked as inspector", "success");
      setShowLinkMechanic(false);
      setSelectedMechanic("");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to link mechanic", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFeedback = async () => {
    if (!feedbackForm.mechanic_party_id || !feedbackForm.feedback_text.trim()) {
      toast("Select a mechanic and enter feedback text", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("mechanic_inspection_feedback").insert({
        vehicle_id: vehicle.id,
        mechanic_party_id: feedbackForm.mechanic_party_id,
        inspection_id: insp?.id ?? null,
        rating: Number(feedbackForm.rating),
        feedback_text: feedbackForm.feedback_text.trim(),
        areas_of_concern: feedbackForm.areas_of_concern.trim() || null,
        recommended_actions: feedbackForm.recommended_actions.trim() || null,
        status: "Submitted",
      });
      if (error) throw error;
      toast("Mechanic feedback added", "success");
      setShowFeedback(false);
      setFeedbackForm({ mechanic_party_id: "", rating: "3", feedback_text: "", areas_of_concern: "", recommended_actions: "" });
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!insp) {
    return <Card className="p-6"><EmptyState icon={<ClipboardCheck size={20} />} title="No inspection recorded" description="Inspections are added via the onboarding or maintenance workflow." /></Card>;
  }
  const items: InspectionItem[] = insp.items ?? [];
  const mechanic = (insp as Inspection & { mechanic?: Party | null }).mechanic;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Inspection Summary</h3>
          <div className="flex flex-col items-center">
            <ScoreRing score={overallScore} label="Overall score" />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Spec label="Inspection Type" value={insp.inspection_type} />
            <Spec label="Inspector" value={insp.inspector_name} />
            <div className="pt-2">
              <p className="text-xs text-slate-500">Assigned Mechanic</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                {mechanic ? (
                  <Badge color="brand"><Wrench size={11} className="mr-1" />{mechanic.full_name}</Badge>
                ) : (
                  <span className="text-xs text-slate-400">No mechanic linked</span>
                )}
                <button onClick={() => setShowLinkMechanic(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  {mechanic ? "Change" : "Link"}
                </button>
              </div>
            </div>
            <Spec label="Date" value={formatDate(insp.inspection_date, { withTime: true })} />
            <div className="pt-2">
              <p className="text-xs text-slate-500">Accident Status</p>
              <div className="mt-1">
                <Badge color={
                  insp.accident_status === "No known accident" ? "emerald"
                    : insp.accident_status === "Minor accident suspected" ? "amber"
                      : insp.accident_status === "Accident confirmed" ? "red" : "slate"
                }>{insp.accident_status}</Badge>
              </div>
            </div>
            {insp.accident_evidence && <Spec label="Evidence" value={insp.accident_evidence} />}
          </div>
          {insp.summary && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Summary</p>
              <p className="text-sm text-slate-700">{insp.summary}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-4">Component Scores</h3>
          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item: InspectionItem) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-slate-800">{item.category}</p>
                    <p className="text-xs text-slate-400">Weight {item.weight}%</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(item.score ?? 0) >= 80 ? "bg-emerald-500" : (item.score ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${item.score ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className="font-mono font-semibold text-sm">{item.score ?? "—"}</span>
                  </div>
                  <div className="w-24 text-right">
                    <Badge color={
                      item.condition_level === "Excellent" ? "emerald"
                        : item.condition_level === "Good" ? "green"
                          : item.condition_level === "Fair" ? "amber"
                            : item.condition_level === "Poor" || item.condition_level === "Critical" ? "red" : "slate"
                    }>{item.condition_level ?? "—"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No component scores" />
          )}
          {items.some((i: InspectionItem) => i.recommended_action && i.recommended_action !== "None") && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Recommended Actions</h4>
              <div className="space-y-2">
                {items.filter((i: InspectionItem) => i.recommended_action && i.recommended_action !== "None").map((i: InspectionItem) => (
                  <div key={i.id} className="flex items-start gap-2 text-sm">
                    <Wrench size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-slate-700"><strong className="font-medium">{i.category}:</strong> {i.recommended_action} {i.estimated_cost > 0 && <span className="text-slate-500">({formatINR(i.estimated_cost)})</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Mechanic Inspection Feedback section */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Wrench size={18} className="text-slate-400" /> Mechanic Inspection Feedback</h3>
          <button onClick={() => setShowFeedback(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Feedback</button>
        </div>
        {feedback.length > 0 ? (
          <div className="space-y-3">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Wrench size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{f.mechanic?.full_name ?? "Unknown mechanic"}</p>
                      <p className="text-xs text-slate-400">{formatDate(f.created_at, { withTime: true })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= f.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-700">{f.feedback_text}</p>
                {f.areas_of_concern && (
                  <div className="mt-2 text-xs">
                    <span className="text-slate-500">Areas of concern: </span>
                    <span className="text-red-600">{f.areas_of_concern}</span>
                  </div>
                )}
                {f.recommended_actions && (
                  <div className="mt-1 text-xs">
                    <span className="text-slate-500">Recommended: </span>
                    <span className="text-slate-700">{f.recommended_actions}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Wrench size={20} />} title="No mechanic feedback yet" description="Add a mechanic and record their inspection feedback for this vehicle." />
        )}
      </Card>

      {/* Link mechanic modal */}
      <Modal
        open={showLinkMechanic}
        onClose={() => setShowLinkMechanic(false)}
        title="Link Mechanic as Inspector"
        description="Assign a mechanic from Parties to this inspection"
        footer={<>
          <button onClick={() => setShowLinkMechanic(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleLinkMechanic} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Link Mechanic</button>
        </>}
      >
        {mechanics.length === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            No mechanics found in Parties. Add a mechanic with party type "Mechanic" from the Parties page first.
          </div>
        ) : (
          <Field label="Select Mechanic" required>
            <Select
              value={selectedMechanic}
              onChange={setSelectedMechanic}
              placeholder="Choose a mechanic"
              options={mechanics.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.mobile ?? "No mobile"} · ${(m.party_subtype ?? "").replace(/_/g, " ")}` }))}
            />
          </Field>
        )}
      </Modal>

      {/* Add feedback modal */}
      <Modal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        title="Add Mechanic Inspection Feedback"
        size="lg"
        footer={<>
          <button onClick={() => setShowFeedback(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleAddFeedback} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Submit Feedback</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Mechanic" required>
            {mechanics.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                No mechanics found. Add a mechanic from the Parties page first.
              </div>
            ) : (
              <Select
                value={feedbackForm.mechanic_party_id}
                onChange={(v) => setFeedbackForm((f) => ({ ...f, mechanic_party_id: v }))}
                placeholder="Select mechanic"
                options={mechanics.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.mobile ?? "—"}` }))}
              />
            )}
          </Field>
          <Field label="Rating" required>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFeedbackForm((f) => ({ ...f, rating: String(r) }))}
                  className="p-1"
                >
                  <Star
                    size={24}
                    className={r <= Number(feedbackForm.rating) ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}
                  />
                </button>
              ))}
              <span className="text-sm text-slate-500 ml-2">{feedbackForm.rating}/5</span>
            </div>
          </Field>
          <Field label="Feedback" required>
            <textarea className="input" rows={3} value={feedbackForm.feedback_text} onChange={(e) => setFeedbackForm((f) => ({ ...f, feedback_text: e.target.value }))} placeholder="Overall inspection feedback from the mechanic…" />
          </Field>
          <Field label="Areas of Concern">
            <input className="input" value={feedbackForm.areas_of_concern} onChange={(e) => setFeedbackForm((f) => ({ ...f, areas_of_concern: e.target.value }))} placeholder="e.g. Engine noise, worn brake pads" />
          </Field>
          <Field label="Recommended Actions">
            <input className="input" value={feedbackForm.recommended_actions} onChange={(e) => setFeedbackForm((f) => ({ ...f, recommended_actions: e.target.value }))} placeholder="e.g. Replace brake pads, oil change" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ============ DOCUMENTS ============
function DocumentsTab({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ document_type: "RC book", document_number: "", issue_date: "", expiry_date: "", issuer: "", verification_status: "Uploaded", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("File too large (max 10MB)", "error");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${vehicle.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vehicle-documents").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("vehicle-documents").getPublicUrl(path);
      setUploadedFile({ url: pub.publicUrl, name: file.name });
      toast("File uploaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicle.id,
        document_type: form.document_type,
        document_number: form.document_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        issuer: form.issuer || null,
        verification_status: form.verification_status,
        file_url: uploadedFile?.url || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast("Document added", "success");
      setShowAdd(false);
      setForm({ document_type: "RC book", document_number: "", issue_date: "", expiry_date: "", issuer: "", verification_status: "Uploaded", notes: "" });
      setUploadedFile(null);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add document", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (d: VehicleDocument) => {
    try {
      const { error } = await supabase.from("vehicle_documents").update({
        verification_status: "Verified",
        verified_by: "Operator",
        verified_at: new Date().toISOString(),
      }).eq("id", d.id);
      if (error) throw error;
      toast("Document verified", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to verify", "error");
    }
  };

  const handleDelete = async (d: VehicleDocument) => {
    if (!confirm("Delete this document record?")) return;
    try {
      if (d.file_url) {
        const path = d.file_url.split("/vehicle-documents/")[1];
        if (path) await supabase.storage.from("vehicle-documents").remove([path]);
      }
      const { error } = await supabase.from("vehicle_documents").delete().eq("id", d.id);
      if (error) throw error;
      toast("Document removed", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Vehicle Documents</h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Document</button>
        </div>
        {vehicle.documents && vehicle.documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Number</th>
                <th className="pb-2 font-medium">File</th><th className="pb-2 font-medium">Expiry</th>
                <th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2.5"><span className="font-medium text-slate-900">{d.document_type}</span>{d.issuer && <p className="text-xs text-slate-500">{d.issuer}</p>}</td>
                    <td className="py-2.5 font-mono text-xs text-slate-600">{d.document_number || "—"}</td>
                    <td className="py-2.5">
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium">
                          <Download size={13} /> View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">{formatDate(d.expiry_date)}</td>
                    <td className="py-2.5"><VerificationBadge status={d.verification_status} /></td>
                    <td className="py-2.5 text-right">
                      {d.verification_status !== "Verified" && <button onClick={() => handleVerify(d)} className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-2">Verify</button>}
                      <button onClick={() => handleDelete(d)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<FileText size={20} />} title="No documents" description="Add RC, insurance, PUC, and other vehicle documents." />
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setUploadedFile(null); }}
        title="Add Document"
        size="lg"
        footer={<>
          <button onClick={() => { setShowAdd(false); setUploadedFile(null); }} className="btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={submitting || uploading} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Add</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Document Type" required>
            <Select value={form.document_type} onChange={(v) => setForm((f) => ({ ...f, document_type: v }))} options={DOCUMENT_TYPES} />
          </Field>

          {/* File upload */}
          <Field label="Document File / Photo" hint="Upload a photo or scan of the physical document (max 10MB)">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
            {uploadedFile ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-sm text-slate-700 truncate max-w-xs">{uploadedFile.name}</span>
                </div>
                <button onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary flex-1">
                  {uploading ? <Spinner size={14} /> : <Upload size={15} />} Choose File
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary flex-1">
                  <Camera size={15} /> Take Photo
                </button>
              </div>
            )}
            {uploadedFile && uploadedFile.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) && (
              <img src={uploadedFile.url} alt="Preview" className="mt-3 rounded-lg max-h-48 object-contain border border-slate-200" />
            )}
          </Field>

          <Field label="Document Number">
            <input className="input" value={form.document_number} onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))} placeholder="TN22AB1234" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue Date"><input className="input" type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} /></Field>
            <Field label="Expiry Date"><input className="input" type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} /></Field>
          </div>
          <Field label="Issuing Organisation"><input className="input" value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="RTO Chennai" /></Field>
          <Field label="Verification Status">
            <Select value={form.verification_status} onChange={(v) => setForm((f) => ({ ...f, verification_status: v }))} options={DOCUMENT_VERIFICATION_STATUSES} />
          </Field>
          <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ============ SALE & PROFIT ============
function SaleTab({ vehicle, cost, profit, funding, partners, onChanged, onNavigate }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  onChanged: () => void;
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showBuyers, setShowBuyers] = useState(false);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [addBuyerMode, setAddBuyerMode] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ full_name: "", mobile: "", city: "", party_subtype: "individual" });
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", delivery_location: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const sale = vehicle.sale;
  const distributions = vehicle.profit_distributions ?? [];

  const handleRecordSale = async () => {
    if (!form.buyer_party_id || !form.sale_price || Number(form.sale_price) <= 0) {
      toast("Select buyer and enter sale price", "error");
      return;
    }
    // Loss check: if sale price (net) is below total cost, notes are mandatory
    const salePrice = Number(form.sale_price);
    const discount = Number(form.discount) || 0;
    const buyerCharges = Number(form.buyer_charges) || 0;
    const netRevenue = salePrice + buyerCharges - discount;
    if (netRevenue < cost.totalVehicleCost && !form.notes.trim()) {
      toast("This sale is at a loss. Please enter a reason in the Notes field explaining why the vehicle is being sold below cost.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const grossProfit = netRevenue - cost.totalVehicleCost;

      // Create sale
      const { data: saleRec, error: saleErr } = await supabase.from("sales").insert({
        vehicle_id: vehicle.id,
        buyer_party_id: form.buyer_party_id,
        sale_date: new Date().toISOString(),
        sale_price: salePrice,
        discount,
        buyer_charges: buyerCharges,
        payment_status: "Paid",
        delivery_status: "Delivered",
        delivered_at: new Date().toISOString(),
        delivery_location: form.delivery_location || null,
        notes: form.notes || null,
        status: "Completed",
      }).select().single();
      if (saleErr) throw saleErr;

      // Create sale payment
      await supabase.from("sale_payments").insert({
        sale_id: saleRec.id,
        amount: netRevenue,
        payment_method: form.payment_method,
        paid_at: new Date().toISOString(),
      });

      // Update vehicle status
      await supabase.from("vehicles").update({
        current_status: "SOLD",
        sold_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", vehicle.id);

      await supabase.from("vehicle_status_history").insert({
        vehicle_id: vehicle.id,
        previous_status: vehicle.current_status,
        new_status: "SOLD",
        reason: `Sale completed at ${formatINR(salePrice)}`,
      });

      // Calculate profit distributions
      const allocations = vehicle.profit_share_allocations ?? [];
      const isLoss = grossProfit < 0;
      const absProfit = Math.abs(grossProfit);

      for (const alloc of allocations) {
        const fund = funding.find((f) => f.partnerId === alloc.partner_id);
        const principalReturn = fund?.totalInvested ?? 0;
        const profitShare = isLoss ? 0 : (absProfit * alloc.percentage) / 100;
        const lossShare = isLoss ? (absProfit * alloc.percentage) / 100 : 0;
        const totalEntitlement = principalReturn + profitShare - lossShare;

        await supabase.from("profit_distributions").insert({
          vehicle_id: vehicle.id,
          sale_id: saleRec.id,
          partner_id: alloc.partner_id,
          principal_return: principalReturn,
          profit_share: profitShare,
          loss_share: lossShare,
          total_entitlement: totalEntitlement,
          amount_paid: 0,
          balance_payable: totalEntitlement,
          status: "Calculated",
        });
      }

      await supabase.from("audit_logs").insert({
        entity_type: "vehicle",
        entity_id: vehicle.id,
        action: "sold",
        performed_by: "Operator",
        reason: `Sale completed at ${formatINR(salePrice)}, profit ${formatINR(grossProfit)}`,
      });

      toast("Sale recorded and profit calculated", "success");
      setShowAdd(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to record sale", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const loadBuyers = async () => {
    const b = await fetchParties("buyer");
    setBuyers(b);
    setShowBuyers(true);
  };

  const handleAddBuyerInline = async () => {
    if (!newBuyer.full_name.trim() || !newBuyer.mobile.trim()) {
      toast("Enter buyer name and mobile", "error");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          party_type: "buyer",
          party_subtype: newBuyer.party_subtype,
          full_name: newBuyer.full_name.trim(),
          mobile: newBuyer.mobile.trim(),
          city: newBuyer.city.trim() || null,
          consent: true,
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as Party;
      setBuyers((b) => [...b, created]);
      setForm((f) => ({ ...f, buyer_party_id: created.id }));
      setAddBuyerMode(false);
      setNewBuyer({ full_name: "", mobile: "", city: "", party_subtype: "individual" });
      toast("Buyer added", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add buyer", "error");
    }
  };

  const handleSettle = async (distId: string) => {
    try {
      const { error } = await supabase.from("profit_distributions").update({
        amount_paid: 0, // will be set below
      }).eq("id", distId);
      // Actually mark as paid - get current
      if (error) throw error;
      const dist = distributions.find((d) => d.id === distId);
      if (!dist) return;
      const { error: e2 } = await supabase.from("profit_distributions").update({
        amount_paid: dist.total_entitlement,
        balance_payable: 0,
        status: "Paid",
      }).eq("id", distId);
      if (e2) throw e2;
      toast("Settlement marked as paid", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to settle", "error");
    }
  };

  if (sale) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> Sale Completed</h3>
            <Badge color="emerald">{formatDate(sale.sale_date, { withTime: true })}</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Spec label="Buyer" value={sale.buyer?.full_name} />
            <Spec label="Sale Price" value={formatINR(sale.sale_price)} />
            <Spec label="Discount" value={formatINR(sale.discount)} />
            <Spec label="Net Revenue" value={formatINR(profit?.netSaleRevenue)} />
            <Spec label="Total Cost" value={formatINR(cost.totalVehicleCost)} />
            <Spec label="Gross Profit" value={formatINR(profit?.grossProfit)} />
            <Spec label="Margin" value={formatPercent(profit?.profitMarginPct)} />
            <Spec label="Return on Cost" value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-slate-400" /> Profit Distribution</h3>
          {distributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-medium">Partner</th><th className="pb-2 font-medium text-right">Principal</th>
                  <th className="pb-2 font-medium text-right">Profit</th><th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Paid</th><th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {distributions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium">{d.partner?.name}</td>
                      <td className="py-2.5 text-right">{formatINR(d.principal_return)}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">{formatINR(d.profit_share)}</td>
                      <td className="py-2.5 text-right font-bold">{formatINR(d.total_entitlement)}</td>
                      <td className="py-2.5 text-right">{formatINR(d.amount_paid)}</td>
                      <td className="py-2.5"><Badge color={d.status === "Paid" ? "emerald" : d.status === "Calculated" ? "amber" : "slate"}>{d.status}</Badge></td>
                      <td className="py-2.5 text-right">
                        {d.status !== "Paid" && <button onClick={() => handleSettle(d.id)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">Mark Paid</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No profit distributions calculated" />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Cost Sheet</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Spec label="Purchase Cost" value={formatINR(cost.purchaseCost)} />
          <Spec label="Refurbishment" value={formatINR(cost.refurbishmentCost)} />
          <Spec label="Holding Cost" value={formatINR(cost.holdingCost)} />
          <Spec label="Logistics Cost" value={formatINR(cost.logisticsCost)} />
          <Spec label="Docs & Selling" value={formatINR(cost.documentationSellingCost)} />
          <Spec label="Other" value={formatINR(cost.otherCost)} />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="font-semibold">Total Vehicle Cost</span>
          <span className="text-lg font-bold">{formatINR(cost.totalVehicleCost)}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Sale Projection</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Spec label="Asking Price" value={formatINR(vehicle.asking_price)} />
          <Spec label="Minimum Price" value={formatINR(vehicle.minimum_price)} />
          {(() => {
            const estProfitAsking = vehicle.asking_price ? vehicle.asking_price - cost.totalVehicleCost : null;
            const estProfitMin = vehicle.minimum_price ? vehicle.minimum_price - cost.totalVehicleCost : null;
            const colorFor = (p: number | null) => {
              if (p === null || cost.totalVehicleCost <= 0) return "text-slate-900";
              const pct = (p / cost.totalVehicleCost) * 100;
              if (pct < 3) return "text-red-600";
              if (pct <= 10) return "text-amber-600";
              return "text-emerald-600";
            };
            const badgeFor = (p: number | null) => {
              if (p === null || cost.totalVehicleCost <= 0) return null;
              const pct = (p / cost.totalVehicleCost) * 100;
              if (pct < 3) return <Badge color="red">Low (&lt;3%)</Badge>;
              if (pct <= 10) return <Badge color="amber">Moderate (3-10%)</Badge>;
              return <Badge color="emerald">Healthy (&gt;10%)</Badge>;
            };
            return (
              <>
                <div>
                  <p className="text-xs text-slate-500">Est. Profit at Asking</p>
                  <p className={`text-sm font-bold mt-0.5 ${colorFor(estProfitAsking)}`}>{formatINR(estProfitAsking)}</p>
                  <div className="mt-1">{badgeFor(estProfitAsking)}</div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Est. Profit at Minimum</p>
                  <p className={`text-sm font-bold mt-0.5 ${colorFor(estProfitMin)}`}>{formatINR(estProfitMin)}</p>
                  <div className="mt-1">{badgeFor(estProfitMin)}</div>
                </div>
              </>
            );
          })()}
        </div>
      </Card>

      <Card className="p-5">
        <EmptyState
          icon={<ShoppingCart size={20} />}
          title="No sale recorded"
          description="Record a sale to calculate profit and partner distributions."
          action={<button onClick={loadBuyers} className="btn-primary"><ShoppingCart size={16} /> Record Sale</button>}
        />
      </Card>

      <Modal
        open={showBuyers}
        onClose={() => setShowBuyers(false)}
        title="Record Sale"
        description={`${vehicle.stock_number} · Total cost ${formatINR(cost.totalVehicleCost)}`}
        size="lg"
        footer={<>
          <button onClick={() => setShowBuyers(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleRecordSale} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Complete Sale</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Buyer" required>
            {addBuyerMode ? (
              <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">New Buyer</span>
                  <button onClick={() => setAddBuyerMode(false)} className="text-xs text-slate-500 hover:text-slate-700">Use existing instead</button>
                </div>
                <Select
                  value={newBuyer.party_subtype}
                  onChange={(v) => setNewBuyer((b) => ({ ...b, party_subtype: v }))}
                  options={[{ value: "individual", label: "Individual (Person)" }, { value: "agent", label: "Agent" }]}
                />
                <input className="input" placeholder="Full name" value={newBuyer.full_name} onChange={(e) => setNewBuyer((b) => ({ ...b, full_name: e.target.value }))} />
                <input className="input" placeholder="Mobile number" value={newBuyer.mobile} onChange={(e) => setNewBuyer((b) => ({ ...b, mobile: e.target.value }))} />
                <input className="input" placeholder="City (optional)" value={newBuyer.city} onChange={(e) => setNewBuyer((b) => ({ ...b, city: e.target.value }))} />
                <button onClick={handleAddBuyerInline} className="btn-primary btn-sm w-full">Add Buyer</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} placeholder="Select buyer" options={buyers.map((b) => ({ value: b.id, label: `${b.full_name} · ${b.mobile}` }))} />
                <button onClick={() => setAddBuyerMode(true)} className="btn-secondary shrink-0" title="Add new buyer"><Plus size={16} /> New</button>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Sale Price (₹)" required><input className="input" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="79000" /></Field>
            <Field label="Discount (₹)"><input className="input" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} /></Field>
            <Field label="Buyer Charges (₹)"><input className="input" type="number" value={form.buyer_charges} onChange={(e) => setForm((f) => ({ ...f, buyer_charges: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Method"><Select value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={PAYMENT_METHODS} /></Field>
            <Field label="Delivery Location"><input className="input" value={form.delivery_location} onChange={(e) => setForm((f) => ({ ...f, delivery_location: e.target.value }))} placeholder="Chennai" /></Field>
          </div>
          <Field label="Notes" required={Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost ? "Required: explain why this vehicle is being sold below cost" : "Optional notes"} />
            {Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost && (
              <p className="text-xs text-red-600 mt-1">This sale is below cost — a reason is required.</p>
            )}
          </Field>
          <div className="rounded-lg bg-brand-50 border border-brand-200 p-3 text-xs text-brand-800">
            On completion, the vehicle will be marked SOLD, profit calculated as (Net Revenue − Total Cost), and profit distributed to partners based on their allocation percentages.
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ PASSPORT PREVIEW ============
function PassportPreviewTab({ vehicle, overallScore }: { vehicle: VehicleWithRelations; overallScore: number | null }) {
  const listing = vehicle.listing;
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Vehicle Passport</h3>
        {listing && (
          <Badge color={listing.status === "Active" ? "emerald" : listing.status === "Sold" ? "blue" : "amber"}>Listing: {listing.status}</Badge>
        )}
      </div>
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Share2 size={24} /></div>
        <p className="text-sm text-slate-700 font-medium">Public Vehicle Passport</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          A buyer-facing digital passport showing vehicle identity, inspection scores, documents, and condition — without exposing purchase price, expenses, or partner information.
        </p>
        {listing && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-600">
            /passport/{listing.public_slug}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="stat-label">Overall Score</p>
          <div className="mt-2"><ScoreBadge score={overallScore} /></div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="stat-label">Listing Status</p>
          <p className="text-sm font-medium mt-2">{listing?.status ?? "No listing"}</p>
        </div>
      </div>
    </Card>
  );
}

// ============ ALERTS ============
function AlertsTab({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const { toast } = useToast();
  const alerts = vehicle.alerts ?? [];

  const handleResolve = async (id: string) => {
    try {
      const { error } = await supabase.from("alerts").update({ status: "Resolved", resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast("Alert resolved", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to resolve", "error");
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const { error } = await supabase.from("alerts").update({ status: "Acknowledged", acknowledged_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast("Alert acknowledged", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Vehicle Alerts</h3>
      {alerts.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={20} />} title="No alerts" description="This vehicle has no active alerts." />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const sevColor = a.severity === "Critical" ? "red" : a.severity === "High" ? "orange" : a.severity === "Warning" ? "amber" : "slate";
            return (
              <div key={a.id} className={`p-4 rounded-lg border ${a.status === "Open" ? "border-slate-200" : "border-slate-100 bg-slate-50/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={sevColor as "red" | "orange" | "amber" | "slate"}>{a.severity}</Badge>
                      <span className="text-xs text-slate-400">{a.alert_type}</span>
                      {a.status !== "Open" && <Badge color="slate">{a.status}</Badge>}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    {a.message && <p className="text-xs text-slate-500 mt-1">{a.message}</p>}
                    <p className="text-xs text-slate-400 mt-1">{formatDate(a.created_at, { withTime: true })}{a.assigned_to && ` · Assigned to ${a.assigned_to}`}</p>
                  </div>
                  {a.status === "Open" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleAcknowledge(a.id)} className="btn-ghost btn-sm">Acknowledge</button>
                      <button onClick={() => handleResolve(a.id)} className="btn-secondary btn-sm">Resolve</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============ HISTORY ============
function HistoryTab({ vehicle }: { vehicle: VehicleWithRelations }) {
  const history = vehicle.status_history ?? [];
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><History size={18} className="text-slate-400" /> Status Timeline</h3>
        {history.length === 0 ? (
          <EmptyState title="No status changes recorded" />
        ) : (
          <div className="space-y-0">
            {history.map((h, i) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${i === 0 ? "bg-brand-600" : "bg-slate-300"}`} />
                  {i < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={h.new_status} />
                    {h.previous_status && <span className="text-xs text-slate-400">from {h.previous_status.replace(/_/g, " ")}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(h.changed_at, { withTime: true })}</p>
                  {h.reason && <p className="text-xs text-slate-600 mt-1">{h.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
