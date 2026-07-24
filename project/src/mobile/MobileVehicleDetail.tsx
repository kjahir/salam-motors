import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import { TopBar, Spinner, Card, Tag, SegmentedTabs, Sheet, Button, Field } from "./ui/primitives";
import { PartyPickerField } from "@/components/PartyPickerField";
import { DeleteVehicleModal } from "@/components/DeleteVehicleModal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatDate, formatPercent, daysSince } from "@/lib/format";
import { computeCostBreakdown, computeProfit, computeOverallScore, computePartnerFunding, documentCompleteness } from "@/lib/calc";
import { fetchVehicleFull, fetchPartners } from "@/lib/queries";
import { completeSale } from "@/lib/sale";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { VehicleWithRelations, Partner, InspectionItem } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";
import { MobileDocumentsTab } from "./MobileDocumentsTab";
import { MobileExpensesTab } from "./MobileExpensesTab";
import { MobileInspectionTab } from "./MobileInspectionTab";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileVehicleDetail({ vehicleId, onNavigate, onBack }: { vehicleId: string; onNavigate: MobileNavigate; onBack: () => void }) {
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);

  const reload = async () => {
    const v = await fetchVehicleFull(vehicleId);
    setVehicle(v);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [v, p] = await Promise.all([fetchVehicleFull(vehicleId), fetchPartners()]);
      if (cancelled) return;
      setVehicle(v);
      setPartners(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(() => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []), [vehicle]);
  const profit = useMemo(() => computeProfit(vehicle?.sale, cost), [vehicle, cost]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);
  const latestInspection = (vehicle?.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const inspectionItems = useMemo(() => latestInspection?.items ?? [], [latestInspection]);
  const overallScore = useMemo(() => computeOverallScore(inspectionItems), [inspectionItems]);
  const docCompleteness = useMemo(() => documentCompleteness(vehicle?.documents ?? []), [vehicle]);

  if (loading || !vehicle) {
    return (
      <div>
        <TopBar title="Vehicle" onBack={onBack} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  const isSold = SOLD_STATUSES.includes(vehicle.current_status) && vehicle.current_status !== "CANCELLED" && vehicle.current_status !== "WRITTEN_OFF";
  const days = daysSince(vehicle.onboarded_at);

  return (
    <div>
      <TopBar
        title={`${vehicle.manufacturer} ${vehicle.model}`}
        onBack={onBack}
        actions={
          <>
            <button onClick={() => onNavigate("edit-vehicle", { vehicleId })} className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-text-secondary active:bg-mobile-bg" aria-label="Edit">
              <Pencil size={17} />
            </button>
            <button onClick={() => setShowDelete(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-error active:bg-mobile-bg" aria-label="Delete">
              <Trash2 size={17} />
            </button>
          </>
        }
      />

      <div className="px-4 pt-3">
        <p className="text-xs text-mobile-text-muted font-mono">{vehicle.stock_number} · {vehicle.registration_number ?? "No registration"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 pt-3">
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase">Status</p>
          <div className="mt-1">
            <Tag color={isSold ? "success" : days >= 60 ? "error" : days >= 30 ? "warning" : "primary"}>{vehicle.current_status.replace(/_/g, " ")}</Tag>
          </div>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase">Days in Stock</p>
          <p className="text-base font-poppins font-bold text-mobile-text mt-1">{days}d</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase">Total Cost</p>
          <p className="text-base font-poppins font-bold text-mobile-text mt-1">{formatINR(cost.totalVehicleCost)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase">{isSold ? "Profit" : "Est. Profit"}</p>
          <p className={`text-base font-poppins font-bold mt-1 ${profit ? (profit.grossProfit >= 0 ? "text-mobile-success" : "text-mobile-error") : "text-mobile-text"}`}>
            {profit ? formatINR(profit.grossProfit) : formatINR(vehicle.asking_price ? vehicle.asking_price - cost.totalVehicleCost : null)}
          </p>
        </Card>
      </div>

      <div className="pt-4">
        <SegmentedTabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "documents", label: "Documents", badge: <Tag color="neutral">{vehicle.documents?.length ?? 0}</Tag> },
            { key: "expenses", label: "Expenses", badge: <Tag color="neutral">{vehicle.expenses?.length ?? 0}</Tag> },
            { key: "inspection", label: "Inspection" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-4 pb-4">
        {tab === "overview" && (
          <OverviewTab
            vehicle={vehicle}
            cost={cost}
            profit={profit}
            overallScore={overallScore}
            docCompleteness={docCompleteness}
            funding={funding}
            partners={partners}
            onChanged={reload}
            onNavigate={onNavigate}
          />
        )}
        {tab === "documents" && <MobileDocumentsTab vehicle={vehicle} onChanged={reload} />}
        {tab === "expenses" && <MobileExpensesTab vehicle={vehicle} onChanged={reload} />}
        {tab === "inspection" && <MobileInspectionTab vehicle={vehicle} overallScore={overallScore} onChanged={reload} />}
      </div>

      {showDelete && (
        <DeleteVehicleModal vehicle={vehicle} open={showDelete} onClose={() => setShowDelete(false)} onDeleted={onBack} />
      )}
    </div>
  );
}

function OverviewTab({ vehicle, cost, profit, overallScore, docCompleteness, funding, partners, onChanged, onNavigate }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  overallScore: number | null;
  docCompleteness: ReturnType<typeof documentCompleteness>;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  onChanged: () => void;
  onNavigate: MobileNavigate;
}) {
  const [showSale, setShowSale] = useState(false);
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isBelowCost = Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost;

  const handleRecordSale = async () => {
    setSubmitting(true);
    try {
      await completeSale(
        vehicle,
        cost,
        funding,
        partners,
        {
          buyer_party_id: form.buyer_party_id,
          sale_price: Number(form.sale_price) || 0,
          discount: Number(form.discount) || 0,
          buyer_charges: Number(form.buyer_charges) || 0,
          payment_method: form.payment_method,
          payment_status: "Paid",
          delivery_status: "Pending",
          delivery_location: "",
          notes: form.notes,
        },
        user?.email ?? "Unknown",
      );
      toast("Sale recorded and profit calculated", "success");
      setShowSale(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to record sale", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pt-3">
      {vehicle.sale ? (
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Sale Completed</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Spec label="Buyer" value={vehicle.sale.buyer?.full_name} />
            <Spec label="Sale Price" value={formatINR(vehicle.sale.sale_price)} />
            <Spec label="Net Revenue" value={formatINR(profit?.netSaleRevenue)} />
            <Spec label="Profit" value={formatINR(profit?.grossProfit)} />
            <Spec label="Margin" value={formatPercent(profit?.profitMarginPct)} />
            <Spec label="Return on Cost" value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-poppins font-semibold text-mobile-text">Not Sold Yet</h3>
              <p className="text-xs text-mobile-text-muted mt-0.5">Record the sale to calculate profit</p>
            </div>
            <Button size="sm" onClick={() => setShowSale(true)}><ShoppingCart size={14} /> Record Sale</Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Health Score</h3>
        <div className="flex flex-col items-center">
          <ScoreRing score={overallScore} size={96} strokeWidth={8} label="Overall" />
        </div>
        <div className="mt-3 pt-3 border-t border-mobile-border flex items-center justify-between text-xs">
          <span className="text-mobile-text-muted">Documents</span>
          <span className="font-medium text-mobile-text">{docCompleteness.verified}/{docCompleteness.total} verified</span>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Specifications</h3>
        <div className="grid grid-cols-2 gap-3">
          <Spec label="Category" value={vehicle.category} />
          <Spec label="Fuel Type" value={vehicle.fuel_type} />
          <Spec label="Colour" value={vehicle.colour} />
          <Spec label="Year" value={String(vehicle.manufacture_year ?? "—")} />
          <Spec label="Odometer" value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("en-IN")} km` : "—"} />
          <Spec label="Owners" value={String(vehicle.owner_count)} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Purchase</h3>
        <div className="grid grid-cols-2 gap-3">
          <Spec label="Seller" value={vehicle.purchase?.seller?.full_name} />
          <Spec label="Seller Mobile" value={vehicle.purchase?.seller?.mobile} />
          <Spec label="Purchase Price" value={formatINR(vehicle.purchase?.agreed_price)} />
          <Spec label="Purchase Date" value={formatDate(vehicle.purchase?.purchase_date)} />
        </div>
      </Card>

      <button
        onClick={() => onNavigate("edit-vehicle", { vehicleId: vehicle.id })}
        className="w-full text-center text-xs text-mobile-text-muted py-1"
      >
        Full financial detail available on desktop
      </button>

      <Sheet
        open={showSale}
        onClose={() => setShowSale(false)}
        title="Record Sale"
        description={`${vehicle.stock_number} · Total cost ${formatINR(cost.totalVehicleCost)}`}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSale(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleRecordSale} loading={submitting}>Complete Sale</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <PartyPickerField partyType="buyer" value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} />
          <Field label="Sale Price (₹)" required>
            <input className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-sm" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="79000" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (₹)">
              <input className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-sm" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
            </Field>
            <Field label="Buyer Charges (₹)">
              <input className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-sm" type="number" value={form.buyer_charges} onChange={(e) => setForm((f) => ({ ...f, buyer_charges: e.target.value }))} />
            </Field>
          </div>
          <Field label="Payment Method">
            <select className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-sm" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Notes" required={isBelowCost} hint={isBelowCost ? "Required: this sale is below total cost" : undefined}>
            <textarea className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-sm" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
          {isBelowCost && (
            <div className="flex items-start gap-2 rounded-xl bg-mobile-error-bg p-3 text-xs text-mobile-error">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> This sale is below cost — a reason is required in notes.
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-mobile-text-muted uppercase">{label}</p>
      <p className="text-xs font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}
