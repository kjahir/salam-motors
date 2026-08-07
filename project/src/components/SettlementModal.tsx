import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
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
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
          </Field>
        </div>
        <Field label={t("financeModals.notes")}>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("financeModals.optionalNotes")} />
        </Field>
        <FileUploadGrid
          bucket="finance-proofs"
          pathPrefix={`settlements/${distribution.id}`}
          value={proofFiles}
          onChange={setProofFiles}
          label={t("financeModals.paymentProof")}
          required={proofRequired}
          hint={t("financeModals.proofHint")}
        />

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
