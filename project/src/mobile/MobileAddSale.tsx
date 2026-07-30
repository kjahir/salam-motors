import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner, Card, Field, Button } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { computeCostBreakdown, computePartnerFunding } from "@/lib/calc";
import { fetchVehicleFull, fetchPartners, fetchCompliancePolicies } from "@/lib/queries";
import { completeSale } from "@/lib/sale";
import { evaluateVehicleCompliance, acknowledgeViolation, isHardBlocking } from "@/lib/compliance";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Partner, VehicleWithRelations, CompliancePolicy } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

// Full-screen "Record Sale" page. This owns the compliance acknowledge-and-proceed logic
// relocated verbatim from the former inline Sheet in MobileSaleTab.tsx (Phase 4): the
// hard-block / manual-violation / acknowledge-all / below-cost predicates and the
// completeSale() call are unchanged, only the surrounding shell moved from a bottom Sheet
// to a full-screen page. Fetches its own vehicle/partners/compliance context since it's no
// longer nested inside MobileVehicleDetail.
export function MobileAddSale({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(Boolean(vehicleId));
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgingAll, setAcknowledgingAll] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

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
    setForm({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
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
  // Hard block: only auto_only violations stop the sale outright; manual-resolution
  // violations are dealer-acknowledgeable, same predicate as desktop's SaleTab.
  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);
  const manualViolations = complianceViolations.filter((v) => !isHardBlocking(v));
  const unacknowledgedManual = manualViolations.filter(
    (v) => vehicle?.alerts?.find((a) => a.policy_id === v.policyId)?.status !== "Acknowledged",
  );

  const handleAcknowledgeAll = async () => {
    setAcknowledgingAll(true);
    try {
      await Promise.all(unacknowledgedManual.map((v) => acknowledgeViolation(vehicleId, v.policyId)));
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    } finally {
      setAcknowledgingAll(false);
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
          payment_status: "Paid",
          delivery_status: "Pending",
          delivery_location: "",
          notes: form.notes,
        },
        user?.email ?? t("auth.user"),
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
    <div>
      <TopBar title={t("mobileVehicle.recordSale")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {vehicleId && (loading || !vehicle) && (
          <div className="flex items-center justify-center py-10"><Spinner size={28} /></div>
        )}

        {vehicleId && !loading && vehicle && vehicle.sale && (
          <Card className="p-4">
            <h3 className="text-sm font-poppins font-semibold text-mobile-text">{t("mobileVehicle.saleCompleted")}</h3>
          </Card>
        )}

        {vehicleId && !loading && vehicle && !vehicle.sale && hardBlockingViolations.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-poppins font-semibold text-mobile-error">{t("vehicleDetail.saleBlockedTitle")}</h3>
            <p className="text-xs text-mobile-text-muted mt-0.5">
              {t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
            </p>
          </Card>
        )}

        {vehicleId && !loading && vehicle && !vehicle.sale && hardBlockingViolations.length === 0 && (
          <>
            {manualViolations.length > 0 && (
              <div className="rounded-xl bg-mobile-warning-bg p-3 text-xs text-mobile-warning space-y-2">
                <p className="font-medium flex items-start gap-1.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {t("mobileVehicle.nonBlockingIssues", { count: manualViolations.length, list: manualViolations.map((v) => v.name).join(", ") })}
                </p>
                {unacknowledgedManual.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={handleAcknowledgeAll} loading={acknowledgingAll}>{t("mobileVehicle.acknowledgeAndProceed")}</Button>
                ) : (
                  <p className="text-mobile-success">{t("status.Acknowledged")}</p>
                )}
              </div>
            )}

            <Card className="p-4 space-y-4">
              <PartyPickerField partyType="buyer" value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} />
              <Field label={t("mobileVehicle.salePrice")} required>
                <input className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="79000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("mobileVehicle.discount")}>
                  <input className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
                </Field>
                <Field label={t("mobileVehicle.buyerCharges")}>
                  <input className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" type="number" value={form.buyer_charges} onChange={(e) => setForm((f) => ({ ...f, buyer_charges: e.target.value }))} />
                </Field>
              </div>
              <Field label={t("mobileVehicle.paymentMethod")}>
                <select className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{trStatus(m)}</option>)}
                </select>
              </Field>
              <Field label={t("mobileVehicle.notes")} required={isBelowCost} hint={isBelowCost ? t("mobileVehicle.belowCostHint") : undefined}>
                <textarea className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>
              {isBelowCost && (
                <div className="flex items-start gap-2 rounded-xl bg-mobile-error-bg p-3 text-xs text-mobile-error">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t("mobileVehicle.belowCostWarning")}
                </div>
              )}
            </Card>

            <Button
              className="w-full"
              onClick={handleRecordSale}
              loading={submitting}
              disabled={hardBlockingViolations.length > 0 || unacknowledgedManual.length > 0}
            >
              <Check size={16} /> {t("mobileVehicle.completeSale")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
