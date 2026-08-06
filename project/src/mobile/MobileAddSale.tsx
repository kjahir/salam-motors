import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, FileText, Images, Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner, Card, Field, Button } from "./ui/primitives";
import { MobileVehicleSearch } from "./ui/MobileVehicleSearch";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { useAuth } from "@/lib/useAuth";
import type { UploadedFile } from "@/lib/uploadedFile";
import { computeCostBreakdown, computePartnerFunding, computeEstimatedProfitRange } from "@/lib/calc";
import { formatINR, formatINRRange } from "@/lib/format";
import { fetchVehicleFull, fetchPartners, fetchCompliancePolicies, fetchAppSettings } from "@/lib/queries";
import { completeSale } from "@/lib/sale";
import { evaluateVehicleCompliance, acknowledgeViolation, isHardBlocking } from "@/lib/compliance";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Partner, VehicleWithRelations, CompliancePolicy, AppSettings } from "@/lib/types";
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
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(Boolean(vehicleId));
  const [form, setForm] = useState({ buyer_party_id: "", sale_price: "", discount: "0", buyer_charges: "0", payment_method: "UPI", notes: "" });
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
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
    setProofFiles([]);
    Promise.all([fetchVehicleFull(vehicleId), fetchPartners(), fetchCompliancePolicies(), fetchAppSettings()]).then(([v, p, pol, st]) => {
      if (cancelled) return;
      setVehicle(v);
      setPartners(p);
      setPolicies(pol);
      setSettings(st);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(() => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []), [vehicle]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);
  const complianceViolations = useMemo(() => (vehicle ? evaluateVehicleCompliance(vehicle, policies) : []), [vehicle, policies]);
  const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
  const marginHigh = settings?.estimated_profit_margin_high_pct ?? 30;
  const estRange = useMemo(
    () => computeEstimatedProfitRange(cost.totalVehicleCost, marginLow, marginHigh),
    [cost, marginLow, marginHigh],
  );

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
          payment_proof_paths: proofFiles.map((f) => f.path),
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
        <MobileVehicleSearch value={vehicleId} onChange={(id) => setVehicleId(id)} label={t("mobileAdd.selectVehicle")} />

        {vehicleId && (loading || !vehicle) && (
          <div className="flex items-center justify-center py-10"><Spinner size={28} /></div>
        )}

        {vehicleId && !loading && vehicle && vehicle.sale && (
          <Card className="p-4">
            <h3 className="text-sm font-poppins font-semibold text-mobile-text">{t("mobileVehicle.saleCompleted")}</h3>
          </Card>
        )}

        {vehicleId && !loading && vehicle && !vehicle.sale && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleDetail.costSheetTitle")}</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <MobileSpec label={t("vehicleDetail.purchaseCost")} value={formatINR(cost.purchaseCost)} />
                <MobileSpec label={t("vehicleDetail.refurbishment")} value={formatINR(cost.refurbishmentCost)} />
                <MobileSpec label={t("vehicleDetail.holdingCost")} value={formatINR(cost.holdingCost)} />
                <MobileSpec label={t("vehicleDetail.logisticsCost")} value={formatINR(cost.logisticsCost)} />
                <MobileSpec label={t("vehicleDetail.docsSelling")} value={formatINR(cost.documentationSellingCost)} />
                <MobileSpec label={t("vehicleDetail.otherCost")} value={formatINR(cost.otherCost)} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-mobile-border">
                <span className="text-sm font-semibold text-mobile-text">{t("vehicleDetail.totalVehicleCost")}</span>
                <span className="text-base font-poppins font-bold text-mobile-text">{formatINR(cost.totalVehicleCost)}</span>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleDetail.saleProjectionTitle")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <MobileSpec label={t("vehicleDetail.askingPrice")} value={formatINR(vehicle.asking_price)} />
                <MobileSpec label={t("vehicleDetail.minimumPrice")} value={formatINR(vehicle.minimum_price)} />
              </div>
              <div className="mt-3 pt-3 border-t border-mobile-border">
                <p className="text-xs text-mobile-text-muted">{t("vehicleDetail.estimatedProfitRange")}</p>
                <p className="text-base font-poppins font-bold text-mobile-success mt-0.5">{formatINRRange(estRange.low, estRange.high)}</p>
                <p className="text-xs text-mobile-text-muted mt-1">{marginLow}%–{marginHigh}% {t("vehicleDetail.ofTotalCost")}</p>
              </div>
            </Card>
          </>
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
              <PaymentProofField vehicleId={vehicleId} value={proofFiles} onChange={setProofFiles} />
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

/** Label/value pair for the Cost Sheet and Sale Projection cards — mobile counterpart of
 *  VehicleDetail.tsx's desktop `Spec` helper, same content, mobile tokens. */
function MobileSpec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-mobile-text-muted">{label}</p>
      <p className="text-sm font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}
