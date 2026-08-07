import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { formatINR, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { PAYMENT_METHODS } from "@/lib/constants";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { isImageName, type UploadedFile } from "@/lib/uploadedFile";
import { fetchCompliancePolicies } from "@/lib/queries";
import { recordSettlementPayment } from "@/lib/settlement";
import type { Partner, ProfitDistribution, ProfitSettlementPayment, Vehicle } from "@/lib/types";

interface SettlementModalProps {
  distribution: ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function SettlementModal({ distribution, open, onClose, onSaved }: SettlementModalProps) {
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

  // Waterfall: principal is always paid back before profit. amount_paid is cumulative
  // across every past payment on this distribution and doesn't record how each one split
  // between the two, so this recomputes it from principal_return alone — equivalent to
  // assuming every past payment already followed the same principal-first rule, which is
  // exactly the rule being introduced here.
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
        // Only a hard-block ("auto_only") policy actually stops the dealer here — a manual
        // one still flags a missing-evidence violation (visible on the vehicle/at sale time)
        // without blocking this specific action, same as expense/investment evidence do.
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
    <Modal
      open={open}
      onClose={handleClose}
      title={t("financeModals.settleTitle", { partner: distribution.partner?.name ?? t("financeModals.partner") })}
      description={t("financeModals.settleDescription", { stock: distribution.vehicle?.stock_number ?? "", total: formatINR(distribution.total_entitlement), balance: formatINR(distribution.balance_payable) })}
      size="lg"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary">{t("financeModals.cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} {t("financeModals.recordPayment")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {distribution.principal_return > 0 && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 text-sm">
            <div>
              <p className="text-xs text-slate-500">{t("financeModals.principalRemaining")}</p>
              <p className="font-semibold text-slate-800">{formatINR(principalRemaining)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t("financeModals.profitRemaining")}</p>
              <p className="font-semibold text-slate-800">{formatINR(profitRemaining)}</p>
            </div>
            {payAmount > 0 && (
              <p className="col-span-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                {t("financeModals.paymentSplitPreview", { principal: formatINR(principalPortion), profit: formatINR(profitPortion) })}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("financeModals.amountToPay")} required hint={t("financeModals.balancePayable", { amount: formatINR(distribution.balance_payable) })}>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("financeModals.date")} required>
            <input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label={t("financeModals.paymentMethod")}>
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS.map((method) => ({ value: method, label: trStatus(method) }))} />
          </Field>
          <Field label={t("financeModals.reference")}>
            <div className="flex items-center gap-2">
              <input className="input flex-1" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
              {/* Below sm, the modal is hosted inside the mobile shell (Partners page's
                  reused desktop component) — a pin here replaces the wide three-button
                  FileUploadGrid, which doesn't fit that width. sm and up keeps the grid. */}
              <div className="sm:hidden">
                <CompactProofPin
                  distributionId={distribution.id}
                  value={proofFiles}
                  onChange={setProofFiles}
                  required={proofRequired}
                />
              </div>
            </div>
            {proofFiles.length > 0 && (
              <ul className="sm:hidden mt-2 space-y-1.5">
                {proofFiles.map((file, index) => (
                  <li key={file.path} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setProofFiles((files) => files.filter((_, i) => i !== index))}
                      aria-label={t("uploads.remove", { name: file.name })}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
        <Field label={t("financeModals.notes")}>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("financeModals.optionalNotes")} />
        </Field>
        <div className="hidden sm:block">
          <FileUploadGrid
            bucket="finance-proofs"
            pathPrefix={`settlements/${distribution.id}`}
            value={proofFiles}
            onChange={setProofFiles}
            label={t("financeModals.paymentProof")}
            required={proofRequired}
            hint={t("financeModals.proofHint")}
          />
        </div>

        {distribution.payments && distribution.payments.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800 mb-2"> {t("financeModals.paymentHistory")}</h4>
            <div className="space-y-2">
              {distribution.payments.map((pay) => {
                const paths = pay.proof_urls?.length ? pay.proof_urls : pay.proof_url ? [pay.proof_url] : [];
                return (
                  <div key={pay.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{formatINR(pay.amount)}</span>
                      <span className="text-xs text-slate-500 ml-2">{trStatus(pay.payment_method)} · {formatDate(pay.paid_at, { withTime: true })}</span>
                      {pay.reference && <span className="text-xs text-slate-400 font-mono ml-2">{pay.reference}</span>}
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
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
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
    </Modal>
  );
}

/**
 * Below sm, this modal is hosted inside the mobile shell (Partners is a "More" screen that
 * reuses the desktop page as-is) where FileUploadGrid's three-button row doesn't fit — this
 * swaps in a single pin icon that opens the same Camera/Photo Library/Choose File menu the
 * mobile-native screens already use, sitting inline next to Reference instead of its own
 * labelled field. sm and up never mounts this; the desktop FileUploadGrid below is unaffected.
 */
function CompactProofPin({ distributionId, value, onChange, required }: {
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
    <div ref={wrapRef} className="relative">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={handleLibraryChange} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileChange} className="hidden" />

      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={uploading}
        aria-label={t("quickEntry.attach")}
        aria-expanded={menuOpen}
        title={t("financeModals.paymentProof")}
        className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
          value.length > 0
            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : needsProof
              ? "border-red-300 text-red-600"
              : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
        }`}
      >
        {uploading ? <Spinner size={16} /> : <Paperclip size={16} />}
        {value.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
            {value.length}
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => pick(openCamera)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            <Camera size={16} className="text-slate-500" /> {t("uploads.camera")}
          </button>
          <button type="button" onClick={() => pick(openLibrary)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            <ImageIcon size={16} className="text-slate-500" /> {t("uploads.photoLibrary")}
          </button>
          <button type="button" onClick={() => pick(openFile)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            <FileText size={16} className="text-slate-500" /> {t("uploads.chooseFile")}
          </button>
        </div>
      )}
    </div>
  );
}
