import { useState } from "react";
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
  const { toast } = useToast();
  const { t } = useTranslation();

  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

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

  const isValid = Boolean(amount && Number(amount) > 0 && Number(amount) <= distribution.balance_payable);

  const handleSubmit = async () => {
    if (!isValid) {
      toast(t("financeModals.settlementAmountInvalid"), "error");
      return;
    }
    setSubmitting(true);
    const payAmount = Number(amount);
    let paymentId: string | null = null;
    const rollback = async () => {
      try {
        if (paymentId) await supabase.from("profit_settlement_payments").delete().eq("id", paymentId);
      } catch {
        // best-effort cleanup; the original error is what gets surfaced to the user
      }
    };
    try {
      const proofUrls = proofFiles.map((f) => f.path);
      const { data: paymentRec, error: payErr } = await supabase.from("profit_settlement_payments").insert({
        distribution_id: distribution.id,
        amount: payAmount,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        proof_url: proofUrls[0] ?? null,
        proof_urls: proofUrls,
        paid_at: new Date(paidAt).toISOString(),
      }).select().single();
      if (payErr) throw payErr;
      paymentId = paymentRec.id;

      const newAmountPaid = distribution.amount_paid + payAmount;
      const newBalance = Math.max(0, distribution.total_entitlement - newAmountPaid);
      const { error: updErr } = await supabase.from("profit_distributions").update({
        amount_paid: newAmountPaid,
        balance_payable: newBalance,
        status: newBalance <= 0 ? "Paid" : "Partially paid",
      }).eq("id", distribution.id);
      if (updErr) throw updErr;

      toast(newBalance <= 0 ? t("financeModals.settlementCompleted") : t("financeModals.partialSettlementRecorded"), "success");
      onSaved();
      handleClose();
    } catch (e) {
      await rollback();
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
