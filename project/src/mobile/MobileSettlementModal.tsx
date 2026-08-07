import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, FileText, Images, Paperclip, X } from "lucide-react";
import { Sheet, Field, Input, Select, Button, Spinner } from "./ui/primitives";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { useToast } from "@/components/ui/useToast";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { formatINR, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isImageName, type UploadedFile } from "@/lib/uploadedFile";
import { fetchCompliancePolicies } from "@/lib/queries";
import { recordSettlementPayment } from "@/lib/settlement";
import type { Partner, ProfitDistribution, ProfitSettlementPayment, Vehicle } from "@/lib/types";

interface MobileSettlementModalProps {
  distribution: ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// Mobile counterpart of components/SettlementModal.tsx (a Sheet instead of a Modal, mobile
// primitives instead of desktop's), but the same recordSettlementPayment() call from
// lib/settlement.ts, so the principal-first waterfall and ledger rules stay in exact
// agreement across platforms.
export function MobileSettlementModal({ distribution, open, onClose, onSaved }: MobileSettlementModalProps) {
  const [amount, setAmount] = useState(String(distribution.balance_payable));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLightbox, setPaymentLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [proofRequired, setProofRequired] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  // Same waterfall assumption as the desktop modal: principal is always paid back before
  // profit, recomputed from principal_return since amount_paid doesn't record the split.
  const principalPaidSoFar = Math.min(distribution.amount_paid, distribution.principal_return);
  const principalRemaining = distribution.principal_return - principalPaidSoFar;
  const profitRemaining = distribution.balance_payable - principalRemaining;
  const payAmount = Number(amount) || 0;
  const principalPortion = Math.min(payAmount, principalRemaining);
  const profitPortion = payAmount - principalPortion;

  useEffect(() => {
    if (!open) return;
    fetchCompliancePolicies()
      .then((policies) => {
        setProofRequired(
          policies.some((p) =>
            p.is_active && p.rule_type === "evidence_required" && p.params.entity === "settlement" && p.resolution_mode === "auto_only",
          ),
        );
      })
      .catch(() => setProofRequired(false));
  }, [open]);

  const reset = () => {
    setAmount(String(distribution.balance_payable));
    setPaidAt(todayISO());
    setPaymentMethod("Bank transfer");
    setReference("");
    setNotes("");
    setProofFiles([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = Boolean(
    amount && Number(amount) > 0 && Number(amount) <= distribution.balance_payable
      && (!proofRequired || proofFiles.length > 0),
  );

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0 || Number(amount) > distribution.balance_payable) {
      toast(t("financeModals.settlementAmountInvalid"), "error");
      return;
    }
    if (proofRequired && proofFiles.length === 0) {
      toast(t("financeModals.settlementProofRequired"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordSettlementPayment(
        distribution,
        distribution.vehicle?.stock_number ?? "",
        {
          amount: payAmount,
          paidAt,
          paymentMethod,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          proofUrls: proofFiles.map((f) => f.path),
        },
        () => toast(t("financeModals.investmentReturnUpdateFailed"), "error"),
      );
      toast(result.fullyPaid ? t("financeModals.settlementCompleted") : t("financeModals.partialSettlementRecorded"), "success");
      onSaved();
      handleClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("financeModals.settlementFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t("financeModals.settleTitle", { partner: distribution.partner?.name ?? t("financeModals.partner") })}
      description={t("financeModals.settleDescription", { stock: distribution.vehicle?.stock_number ?? "", total: formatINR(distribution.total_entitlement), balance: formatINR(distribution.balance_payable) })}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={handleClose}>{t("financeModals.cancel")}</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !isValid} loading={submitting}>{t("financeModals.recordPayment")}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {distribution.principal_return > 0 && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-mobile-bg text-sm">
            <div>
              <p className="text-xs text-mobile-text-muted">{t("financeModals.principalRemaining")}</p>
              <p className="font-semibold text-mobile-text">{formatINR(principalRemaining)}</p>
            </div>
            <div>
              <p className="text-xs text-mobile-text-muted">{t("financeModals.profitRemaining")}</p>
              <p className="font-semibold text-mobile-text">{formatINR(profitRemaining)}</p>
            </div>
            {payAmount > 0 && (
              <p className="col-span-2 pt-2 border-t border-mobile-border text-xs text-mobile-text-muted">
                {t("financeModals.paymentSplitPreview", { principal: formatINR(principalPortion), profit: formatINR(profitPortion) })}
              </p>
            )}
          </div>
        )}
        <Field label={t("financeModals.amountToPay")} required hint={t("financeModals.balancePayable", { amount: formatINR(distribution.balance_payable) })}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t("financeModals.date")} required>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label={t("financeModals.paymentMethod")}>
          <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS.map((method) => ({ value: method, label: trStatus(method) }))} />
        </Field>
        <Field label={t("financeModals.reference")}>
          <div className="flex items-center gap-2">
            <Input className="flex-1" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
            <SettlementProofPin
              distributionId={distribution.id}
              value={proofFiles}
              onChange={setProofFiles}
              required={proofRequired}
            />
          </div>
          {proofFiles.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {proofFiles.map((file, index) => (
                <li key={file.path} className="flex items-center gap-2 rounded-xl bg-mobile-bg px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-mobile-text">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setProofFiles((files) => files.filter((_, i) => i !== index))}
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
        <Field label={t("financeModals.notes")}>
          <textarea className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("financeModals.optionalNotes")} />
        </Field>

        {distribution.payments && distribution.payments.length > 0 && (
          <div className="pt-4 border-t border-mobile-border">
            <h4 className="text-sm font-poppins font-semibold text-mobile-text mb-2">{t("financeModals.paymentHistory")}</h4>
            <div className="space-y-2">
              {distribution.payments.map((pay) => {
                const paths = pay.proof_urls?.length ? pay.proof_urls : pay.proof_url ? [pay.proof_url] : [];
                return (
                  <div key={pay.id} className="flex items-center justify-between p-2.5 rounded-xl bg-mobile-bg text-xs">
                    <div>
                      <span className="font-medium text-mobile-text">{formatINR(pay.amount)}</span>
                      <span className="text-mobile-text-muted ml-2">{trStatus(pay.payment_method)} · {formatDate(pay.paid_at, { withTime: true })}</span>
                      {pay.reference && <span className="text-mobile-text-muted font-mono ml-2">{pay.reference}</span>}
                    </div>
                    {paths.length > 0 && (
                      <button
                        onClick={() =>
                          setPaymentLightbox({
                            items: paths.map((path) => ({
                              name: path.split("/").pop() ?? path,
                              isImage: isImageName(path),
                              resolve: async () => {
                                const { data, error } = await supabase.storage.from("finance-proofs").createSignedUrl(path, 300);
                                if (error) throw error;
                                return data.signedUrl;
                              },
                            })),
                            index: 0,
                          })
                        }
                        className="text-mobile-primary font-medium shrink-0 ml-2"
                      >
                        {paths.length > 1 ? t("financePage.viewProofWithCount", { count: paths.length }) : t("financePage.viewProof")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {paymentLightbox && (
        <Lightbox
          items={paymentLightbox.items}
          index={paymentLightbox.index}
          onClose={() => setPaymentLightbox(null)}
          onIndexChange={(index) => setPaymentLightbox((s) => (s ? { ...s, index } : s))}
        />
      )}
    </Sheet>
  );
}

/**
 * The pin-icon attach control from MobileSaleContent.tsx's PaymentProofField, trimmed
 * further: no field label, no caption text, no thumbnail grid — just the icon (a small
 * badge for the attached count, a red border when required-but-empty) sitting inline next
 * to Reference, with the same tap-to-open Camera/Photo Library/Choose File menu. The caller
 * renders the attached-file list itself, below the whole Reference row.
 */
function SettlementProofPin({ distributionId, value, onChange, required }: {
  distributionId: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  required: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { uploading, cameraRef, libraryRef, fileRef, openCamera, openLibrary, openFile, handleCameraChange, handleLibraryChange, handleFileChange } =
    useMultiFileUpload({ bucket: "finance-proofs", pathPrefix: `settlements/${distributionId}`, value, onChange });

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

  const needsProof = required && value.length === 0;

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={handleLibraryChange} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileChange} className="hidden" />

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={uploading}
          aria-label={t("quickEntry.attach")}
          aria-expanded={menuOpen}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
            value.length > 0
              ? "border-mobile-success bg-mobile-success-bg text-mobile-success"
              : needsProof
                ? "border-mobile-error text-mobile-error"
                : "border-mobile-border bg-mobile-card text-mobile-text-secondary"
          }`}
        >
          {uploading ? <Spinner size={16} /> : <Paperclip size={18} />}
          {value.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-mobile-success px-1 text-[10px] font-semibold text-white">
              {value.length}
            </span>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-mobile-border bg-white py-1 shadow-mobile-lg animate-fade-in">
            <button type="button" onClick={() => pick(openCamera)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <Camera size={16} className="text-mobile-text-secondary" /> {t("uploads.camera")}
            </button>
            <button type="button" onClick={() => pick(openLibrary)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <Images size={16} className="text-mobile-text-secondary" /> {t("uploads.photoLibrary")}
            </button>
            <button type="button" onClick={() => pick(openFile)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <FileText size={16} className="text-mobile-text-secondary" /> {t("uploads.chooseFile")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
