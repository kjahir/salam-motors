import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, CheckCircle2, FileText, Images, Paperclip, TrendingUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner, Card, Field, Button, Tag } from "./ui/primitives";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { useAuth } from "@/lib/useAuth";
import type { UploadedFile } from "@/lib/uploadedFile";
import { computeCostBreakdown, computePartnerFunding, computeProfit } from "@/lib/calc";
import { formatINR, formatPercent } from "@/lib/format";
import { completeSale } from "@/lib/sale";
import { acknowledgeViolation, isHardBlocking, type ComplianceViolation } from "@/lib/compliance";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Partner, VehicleWithRelations } from "@/lib/types";
import { MobileSaleSigningPanel } from "./MobileSaleSigningPanel";
import { MobileSettlementModal } from "./MobileSettlementModal";
import { useEntitlements } from "@/lib/useEntitlements";
import { isFeatureAvailable } from "@/lib/entitlements";

// The one canonical mobile "sale page": Cost Sheet / Sale Projection / Record Sale before a
// sale exists, or Sale Completed / Profit Distribution after — reused by MobileSaleTab (the
// Vehicle Detail "Sale" tab, embedded, vehicle already loaded) and MobileAddSale (the
// full-screen page reached from Dashboard/Manage Vehicle, with its own vehicle search bar on
// top). Mirrors desktop's SaleTab (pages/VehicleDetail.tsx) so both platforms show the same
// content, just with mobile primitives and tokens.
export function MobileSaleContent({ vehicle, cost, funding, partners, profit, marginLow, marginHigh, complianceViolations, onChanged }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  profit: ReturnType<typeof computeProfit> | null;
  marginLow: number;
  marginHigh: number;
  complianceViolations: ComplianceViolation[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgingAll, setAcknowledgingAll] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  // Where the dealer is opening negotiation, as a margin % over total cost — same
  // negotiate-price tool as desktop's Sale tab.
  const [negotiateMarginPct, setNegotiateMarginPct] = useState(() => Math.round((marginLow + marginHigh) / 2));
  const { toast } = useToast();
  const { user } = useAuth();
  const { entitlements } = useEntitlements();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  const distributions = vehicle.profit_distributions ?? [];
  const settlingDistribution = settlingId ? distributions.find((d) => d.id === settlingId) : undefined;

  const minPrice = cost.totalVehicleCost * (1 + marginLow / 100);
  const maxPrice = cost.totalVehicleCost * (1 + marginHigh / 100);
  const negotiatedSellingPrice = cost.totalVehicleCost * (1 + negotiateMarginPct / 100);
  const negotiatedProfit = cost.totalVehicleCost * (negotiateMarginPct / 100);

  const isBelowCost = Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost;
  // Hard block: only auto_only violations stop the sale outright; manual-resolution
  // violations are dealer-acknowledgeable, same predicate as desktop's SaleTab.
  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);
  const manualViolations = complianceViolations.filter((v) => !isHardBlocking(v));
  const unacknowledgedManual = manualViolations.filter(
    (v) => vehicle.alerts?.find((a) => a.policy_id === v.policyId)?.status !== "Acknowledged",
  );

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

  const handleApplyPrice = () => {
    setForm((f) => ({ ...f, sale_price: String(Math.round(negotiatedSellingPrice)) }));
    toast(t("vehicleDetail.priceApplied"), "success");
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
          payment_proof_paths: proofFiles.map((f) => f.path),
        },
        user?.email ?? t("auth.user"),
        complianceViolations,
      );
      toast(t("mobileVehicle.saleRecorded"), "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileVehicle.saleFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (vehicle.sale) {
    const sale = vehicle.sale;
    return (
      <div className="space-y-3">
        {/* sale-section:saleCompleted */}
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-mobile-success" /> {t("mobileVehicle.saleCompleted")}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Spec label={t("mobileVehicle.buyer")} value={sale.buyer?.full_name} />
            <Spec label={t("mobileVehicle.salePrice")} value={formatINR(sale.sale_price)} />
            <Spec label={t("mobileVehicle.netRevenue")} value={formatINR(profit?.netSaleRevenue)} />
            <Spec label={t("mobileVehicle.profit")} value={formatINR(profit?.grossProfit)} />
            <Spec label={t("mobileVehicle.margin")} value={formatPercent(profit?.profitMarginPct)} />
            <Spec label={t("mobileVehicle.returnOnCost")} value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>

        {isFeatureAvailable(entitlements, "esign_estamp") && <MobileSaleSigningPanel sale={sale} />}

        {/* sale-section:profitDistribution */}
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-mobile-text-muted" /> {t("mobileVehicle.profitDistribution")}
          </h3>
          {distributions.length > 0 ? (
            <div className="space-y-2.5">
              {distributions.map((d) => (
                <div key={d.id} className="rounded-xl border border-mobile-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-mobile-text">{d.partner?.name}</span>
                    <Tag color={d.status === "Paid" ? "success" : d.status === "Calculated" ? "warning" : "neutral"}>{trStatus(d.status)}</Tag>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <Spec label={t("financePage.columns.principal")} value={formatINR(d.principal_return)} />
                    <Spec label={t("financePage.columns.profit")} value={formatINR(d.profit_share)} />
                    <Spec label={t("financePage.columns.total")} value={formatINR(d.total_entitlement)} />
                    <Spec label={t("financePage.columns.paid")} value={formatINR(d.amount_paid)} />
                  </div>
                  {d.status !== "Paid" && (
                    <Button size="sm" className="w-full mt-2.5" onClick={() => setSettlingId(d.id)}>
                      {t("financePage.settle")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mobile-text-muted text-center py-4">{t("mobileVehicle.noDistributions")}</p>
          )}
        </Card>

        {settlingDistribution && (
          <MobileSettlementModal
            distribution={{ ...settlingDistribution, partner: settlingDistribution.partner ?? null, vehicle, payments: settlingDistribution.payments ?? [] }}
            open={settlingId !== null}
            onClose={() => setSettlingId(null)}
            onSaved={onChanged}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* sale-section:costSheet */}
      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleDetail.costSheetTitle")}</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Spec label={t("vehicleDetail.purchaseCost")} value={formatINR(cost.purchaseCost)} />
          <Spec label={t("vehicleDetail.refurbishment")} value={formatINR(cost.refurbishmentCost)} />
          <Spec label={t("vehicleDetail.holdingCost")} value={formatINR(cost.holdingCost)} />
          <Spec label={t("vehicleDetail.logisticsCost")} value={formatINR(cost.logisticsCost)} />
          <Spec label={t("vehicleDetail.docsSelling")} value={formatINR(cost.documentationSellingCost)} />
          <Spec label={t("vehicleDetail.otherCost")} value={formatINR(cost.otherCost)} />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-mobile-border">
          <span className="text-sm font-semibold text-mobile-text">{t("vehicleDetail.totalVehicleCost")}</span>
          <span className="text-base font-poppins font-bold text-mobile-text">{formatINR(cost.totalVehicleCost)}</span>
        </div>
      </Card>

      {/* sale-section:saleProjection */}
      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleDetail.saleProjectionTitle")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Spec label={t("vehicleDetail.minimumSellingPrice")} value={formatINR(minPrice)} />
          <Spec label={t("vehicleDetail.maximumSellingPrice")} value={formatINR(maxPrice)} />
        </div>
        <div className="mt-4 pt-3 border-t border-mobile-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-mobile-text">{t("vehicleDetail.negotiatePrice")}</span>
            <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-sm font-bold text-orange-600 tabular-nums">{negotiateMarginPct}%</span>
          </div>
          <MobileNegotiateSlider value={negotiateMarginPct} onChange={setNegotiateMarginPct} bandLow={marginLow} bandHigh={marginHigh} />
          <p className="text-xs text-mobile-text-muted mt-1.5">{t("vehicleDetail.recommendedRange", { low: marginLow, high: marginHigh })}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mobile-primary/10 border border-mobile-primary/20 p-3">
            <div>
              <p className="text-xs font-medium text-mobile-primary">{t("vehicleDetail.sellingPrice")}</p>
              <p className="text-base font-poppins font-bold text-mobile-navy mt-0.5">{formatINR(negotiatedSellingPrice)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-mobile-primary">{t("vehicleDetail.profit")}</p>
              <p className="text-base font-poppins font-bold text-mobile-success mt-0.5">{formatINR(negotiatedProfit)}</p>
            </div>
            <Button size="sm" onClick={handleApplyPrice}>
              <Check size={14} /> {t("vehicleDetail.applyPrice")}
            </Button>
          </div>
        </div>
      </Card>

      {hardBlockingViolations.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-error">{t("vehicleDetail.saleBlockedTitle")}</h3>
          <p className="text-xs text-mobile-text-muted mt-0.5">
            {t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
          </p>
        </Card>
      ) : (
        <>
          {manualViolations.length > 0 && (
            <div className="rounded-xl bg-mobile-warning-bg p-3 text-xs text-mobile-warning space-y-2">
              <p className="font-medium flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {t("mobileVehicle.nonBlockingIssues", { count: manualViolations.length, list: manualViolations.map((v) => v.name).join(", ") })}
              </p>
              {unacknowledgedManual.length > 0 ? (
                <Button size="sm" variant="warning" onClick={handleAcknowledgeAll} loading={acknowledgingAll}>{t("mobileVehicle.acknowledgeAndProceed")}</Button>
              ) : (
                <p className="text-mobile-success">{t("status.Acknowledged")}</p>
              )}
            </div>
          )}

          {/* sale-section:recordSale */}
          <Card className="p-4 space-y-4">
            <PartyPickerField partyType="buyer" value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} />
            <Field label={t("mobileVehicle.salePrice")} required>
              <input className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="" />
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
            <PaymentProofField vehicleId={vehicle.id} value={proofFiles} onChange={setProofFiles} />
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
  );
}

/** Label/value pair for the Cost Sheet, Sale Projection and Profit Distribution cards —
 *  mobile counterpart of VehicleDetail.tsx's desktop `Spec` helper, same content, mobile tokens. */
function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-mobile-text-muted">{label}</p>
      <p className="text-sm font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

/** Mobile counterpart of desktop's NegotiateSlider (VehicleDetail.tsx) — same behaviour and
 *  colours (solid emerald recommended-range band, orange rectangle thumb), sized up for a
 *  touch target instead of a mouse cursor. */
function MobileNegotiateSlider({ value, onChange, bandLow, bandHigh, min = 0, max = 100 }: {
  value: number;
  onChange: (value: number) => void;
  bandLow: number;
  bandHigh: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="relative h-9 flex items-center">
      <div className="absolute inset-x-0 h-3 rounded-full bg-mobile-border" />
      <div
        className="absolute h-3 rounded-full bg-emerald-500"
        style={{ left: `${bandLow}%`, right: `${100 - bandHigh}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-orange-600 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-mobile-md [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:bg-orange-600 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-mobile-md [&::-moz-range-thumb]:border-solid"
      />
    </div>
  );
}

/**
 * Paperclip + a two-option menu for the buyer's payment evidence, rather than the full
 * FileUploadGrid: a sale takes one screenshot or receipt, not a photo shoot, and offering
 * "Take Photo" for a UPI confirmation that is already on the phone is noise. Files upload
 * immediately (like every other upload here) and are attached to sale_payments.proof_urls
 * when the sale is recorded — abandoning the screen leaves them orphaned in the bucket,
 * same as the purchase-payment proofs on MobileVehicleForm.
 */
function PaymentProofField({ vehicleId, value, onChange }: {
  vehicleId: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { uploading, cameraRef, libraryRef, fileRef, openCamera, openLibrary, openFile, handleCameraChange, handleLibraryChange, handleFileChange, removeAt } =
    useMultiFileUpload({ bucket: "finance-proofs", pathPrefix: `sale-payments/${vehicleId}`, value, onChange });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [menuOpen]);

  const pick = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  return (
    <Field label={t("mobileVehicle.paymentProof")}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={handleLibraryChange} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileChange} className="hidden" />

      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={uploading}
            aria-label={t("quickEntry.attach")}
            aria-expanded={menuOpen}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
              value.length > 0
                ? "border-mobile-success bg-mobile-success-bg text-mobile-success"
                : "border-mobile-border bg-mobile-card text-mobile-text-secondary"
            }`}
          >
            {uploading ? <Spinner size={16} /> : <Paperclip size={18} />}
          </button>
          <span className="text-xs text-mobile-text-muted">
            {value.length > 0 ? t("quickEntry.attachedCount", { count: value.length }) : t("mobileVehicle.paymentProofHint")}
          </span>
        </div>

        {menuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-mobile-border bg-white py-1 shadow-mobile-lg animate-fade-in">
            <button type="button" onClick={() => pick(openCamera)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <Camera size={16} className="text-mobile-text-secondary" /> {t("uploads.camera")}
            </button>
            <button
              type="button"
              onClick={() => pick(openLibrary)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg"
            >
              <Images size={16} className="text-mobile-text-secondary" /> {t("uploads.photoLibrary")}
            </button>
            <button
              type="button"
              onClick={() => pick(openFile)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg"
            >
              <FileText size={16} className="text-mobile-text-secondary" /> {t("uploads.chooseFile")}
            </button>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((file, index) => (
            <li key={file.path} className="flex items-center gap-2 rounded-xl bg-mobile-bg px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-mobile-text">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={t("uploads.remove", { name: file.name })}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mobile-text-muted active:bg-mobile-border"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
