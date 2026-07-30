import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { computeCostBreakdown, computePartnerFunding } from "@/lib/calc";
import { fetchVehicleFull, fetchPartners, fetchCompliancePolicies } from "@/lib/queries";
import { completeSale } from "@/lib/sale";
import { evaluateVehicleCompliance, acknowledgeViolation, isHardBlocking } from "@/lib/compliance";
import { PAYMENT_METHODS, PAYMENT_STATUSES, DELIVERY_STATUSES } from "@/lib/constants";
import type { Partner, VehicleWithRelations, CompliancePolicy } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

const initialForm = {
  buyer_party_id: "",
  sale_price: "",
  discount: "0",
  buyer_charges: "0",
  payment_method: "UPI",
  payment_status: "Paid",
  delivery_status: "Pending",
  delivery_location: "",
  notes: "",
};

// Desktop counterpart to src/mobile/MobileAddSale.tsx: pick a vehicle, then the same
// compliance-block / acknowledge-and-proceed / below-cost logic from VehicleDetail.tsx's
// SaleTab, minus its cost-sheet and sale-projection summary cards.
export function QuickMakeSale({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const reload = async () => {
    if (!vehicleId) return;
    const v = await fetchVehicleFull(vehicleId);
    setVehicle(v);
  };

  useEffect(() => {
    if (!vehicleId) {
      setVehicle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setForm(initialForm);
    Promise.all([fetchVehicleFull(vehicleId), fetchPartners(), fetchCompliancePolicies()]).then(([v, p, pol]) => {
      if (cancelled) return;
      setVehicle(v);
      setPartners(p);
      setPolicies(pol);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(() => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []), [vehicle]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);
  const complianceViolations = useMemo(() => (vehicle ? evaluateVehicleCompliance(vehicle, policies) : []), [vehicle, policies]);

  const isBelowCost = Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost;
  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);
  const manualViolations = complianceViolations.filter((v) => !isHardBlocking(v));
  const unacknowledgedManual = manualViolations.filter(
    (v) => vehicle?.alerts?.find((a) => a.policy_id === v.policyId)?.status !== "Acknowledged",
  );

  const handleAcknowledgeAll = async () => {
    setAcknowledging(true);
    try {
      await Promise.all(unacknowledgedManual.map((v) => acknowledgeViolation(vehicleId, v.policyId)));
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleRecordSale = async () => {
    if (!vehicle) return;
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
          payment_status: form.payment_status,
          delivery_status: form.delivery_status,
          delivery_location: form.delivery_location,
          notes: form.notes,
        },
        user?.email ?? "Unknown",
        complianceViolations,
      );
      toast(t("mobileVehicle.saleRecorded"), "success");
      onNavigate("vehicle", { vehicleId, tab: "sale" });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileVehicle.saleFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileVehicle.recordSale")} />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {vehicleId && (loading || !vehicle) && (
        <Card className="p-6 flex items-center justify-center"><Spinner size={24} /></Card>
      )}

      {vehicleId && !loading && vehicle && vehicle.sale && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> {t("mobileVehicle.saleCompleted")}</h3>
        </Card>
      )}

      {vehicleId && !loading && vehicle && !vehicle.sale && hardBlockingViolations.length > 0 && (
        <Card className="p-5">
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title={t("vehicleDetail.saleBlockedTitle")}
            description={t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
          />
        </Card>
      )}

      {vehicleId && !loading && vehicle && !vehicle.sale && hardBlockingViolations.length === 0 && (
        <Card className="p-6 space-y-4">
          {manualViolations.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-2">
              <p className="font-medium flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {t("vehicleDetail.nonBlockingIssues", { count: manualViolations.length, list: manualViolations.map((v) => v.name).join(", ") })}
              </p>
              {unacknowledgedManual.length > 0 ? (
                <button type="button" onClick={handleAcknowledgeAll} disabled={acknowledging} className="btn-secondary btn-sm">
                  {acknowledging ? <Spinner size={12} /> : null} {t("vehicleDetail.acknowledgeAndProceed")}
                </button>
              ) : (
                <p className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={14} /> {t("status.Acknowledged")}</p>
              )}
            </div>
          )}

          <PartyPickerField partyType="buyer" value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={t("mobileVehicle.salePrice")} required>
              <input className="input" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="79000" />
            </Field>
            <Field label={t("mobileVehicle.discount")}>
              <input className="input" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
            </Field>
            <Field label={t("mobileVehicle.buyerCharges")}>
              <input className="input" type="number" value={form.buyer_charges} onChange={(e) => setForm((f) => ({ ...f, buyer_charges: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("mobileVehicle.paymentMethod")}>
              <Select value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={PAYMENT_METHODS} />
            </Field>
            <Field label="Delivery Location">
              <input className="input" value={form.delivery_location} onChange={(e) => setForm((f) => ({ ...f, delivery_location: e.target.value }))} placeholder="Chennai" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Payment Status" required>
              <Select value={form.payment_status} onChange={(v) => setForm((f) => ({ ...f, payment_status: v }))} options={PAYMENT_STATUSES} />
            </Field>
            <Field label="Delivery Status" required>
              <Select value={form.delivery_status} onChange={(v) => setForm((f) => ({ ...f, delivery_status: v }))} options={DELIVERY_STATUSES} />
            </Field>
          </div>
          <Field label={t("mobileVehicle.notes")} required={isBelowCost} hint={isBelowCost ? t("mobileVehicle.belowCostHint") : undefined}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
          {isBelowCost && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t("mobileVehicle.belowCostWarning")}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={handleRecordSale}
              disabled={submitting || hardBlockingViolations.length > 0 || unacknowledgedManual.length > 0}
              className="btn-primary"
            >
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileVehicle.completeSale")}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
