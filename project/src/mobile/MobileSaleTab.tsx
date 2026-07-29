import { useEffect, useRef, useState } from "react";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, Sheet, Button, Field } from "./ui/primitives";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatPercent } from "@/lib/format";
import { computeCostBreakdown, computeProfit, computePartnerFunding } from "@/lib/calc";
import { completeSale } from "@/lib/sale";
import { acknowledgeViolation, isHardBlocking, type ComplianceViolation } from "@/lib/compliance";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { VehicleWithRelations, Partner } from "@/lib/types";

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-mobile-text-muted uppercase">{label}</p>
      <p className="text-xs font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

// Extracted verbatim (no logic changes) from MobileVehicleDetail.tsx's former
// OverviewTab, which used to embed sale-recording inline. Now its own tab so the
// mobile "+" -> Sales autoAdd target has somewhere to land.
export function MobileSaleTab({ vehicle, cost, profit, funding, partners, complianceViolations, onChanged, autoAdd, onAutoAddConsumed }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  complianceViolations: ComplianceViolation[];
  onChanged: () => void;
  autoAdd?: boolean;
  onAutoAddConsumed?: () => void;
}) {
  const [showSale, setShowSale] = useState(false);
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgingAll, setAcknowledgingAll] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  const isBelowCost = Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost;
  // Hard block: only auto_only violations stop the sale outright; manual-resolution
  // violations are dealer-acknowledgeable, same predicate as desktop's SaleTab.
  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);
  const manualViolations = complianceViolations.filter((v) => !isHardBlocking(v));
  const unacknowledgedManual = manualViolations.filter(
    (v) => vehicle.alerts?.find((a) => a.policy_id === v.policyId)?.status !== "Acknowledged",
  );

  const autoAddFired = useRef(false);
  useEffect(() => {
    if (!autoAdd || autoAddFired.current) return;
    if (vehicle.sale || hardBlockingViolations.length > 0) return;
    autoAddFired.current = true;
    setShowSale(true);
    onAutoAddConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdd, vehicle.sale, hardBlockingViolations.length]);

  const handleAcknowledgeAll = async () => {
    setAcknowledgingAll(true);
    try {
      await Promise.all(unacknowledgedManual.map((v) => acknowledgeViolation(vehicle.id, v.policyId)));
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    } finally {
      setAcknowledgingAll(false);
    }
  };

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
        user?.email ?? t("auth.user"),
        complianceViolations,
      );
      toast(t("mobileVehicle.saleRecorded"), "success");
      setShowSale(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileVehicle.saleFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pt-3">
      {vehicle.sale ? (
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.saleCompleted")}</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Spec label={t("mobileVehicle.buyer")} value={vehicle.sale.buyer?.full_name} />
            <Spec label={t("mobileVehicle.salePrice")} value={formatINR(vehicle.sale.sale_price)} />
            <Spec label={t("mobileVehicle.netRevenue")} value={formatINR(profit?.netSaleRevenue)} />
            <Spec label={t("mobileVehicle.profit")} value={formatINR(profit?.grossProfit)} />
            <Spec label={t("mobileVehicle.margin")} value={formatPercent(profit?.profitMarginPct)} />
            <Spec label={t("mobileVehicle.returnOnCost")} value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>
      ) : hardBlockingViolations.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-error"> {t("vehicleDetail.saleBlockedTitle")}</h3>
          <p className="text-xs text-mobile-text-muted mt-0.5">
            {t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-poppins font-semibold text-mobile-text"> {t("mobileVehicle.notSold")}</h3>
              <p className="text-xs text-mobile-text-muted mt-0.5"> {t("mobileVehicle.recordSaleHint")}</p>
            </div>
            <Button size="sm" onClick={() => setShowSale(true)}><ShoppingCart size={14} /> {t("mobileVehicle.recordSale")}</Button>
          </div>
        </Card>
      )}

      <Sheet
        open={showSale}
        onClose={() => setShowSale(false)}
        title={t("mobileVehicle.recordSale")}
        description={t("mobileVehicle.sheetDescription", { stock: vehicle.stock_number, cost: formatINR(cost.totalVehicleCost) })}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSale(false)}> {t("mobileVehicle.cancel")}</Button>
            <Button className="flex-1" onClick={handleRecordSale} loading={submitting} disabled={hardBlockingViolations.length > 0 || unacknowledgedManual.length > 0}> {t("mobileVehicle.completeSale")}</Button>
          </div>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Sheet>
    </div>
  );
}
