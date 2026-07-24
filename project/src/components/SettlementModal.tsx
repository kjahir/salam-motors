import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { formatINR, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ScreenshotUpload, type UploadedProof } from "@/components/ScreenshotUpload";
import { viewProof } from "@/lib/proofStorage";
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
  const [proof, setProof] = useState<UploadedProof | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setAmount(String(distribution.balance_payable));
    setPaidAt(todayISO());
    setPaymentMethod("Bank transfer");
    setReference("");
    setNotes("");
    setProof(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = Boolean(amount && Number(amount) > 0 && Number(amount) <= distribution.balance_payable);

  const handleSubmit = async () => {
    if (!isValid) {
      toast("Enter an amount between ₹1 and the balance payable", "error");
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
      const { data: paymentRec, error: payErr } = await supabase.from("profit_settlement_payments").insert({
        distribution_id: distribution.id,
        amount: payAmount,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        proof_url: proof?.path ?? null,
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

      toast(newBalance <= 0 ? "Settlement completed" : "Partial settlement recorded", "success");
      onSaved();
      handleClose();
    } catch (e) {
      await rollback();
      toast(e instanceof Error ? e.message : "Failed to record settlement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Settle Profit — ${distribution.partner?.name ?? "Partner"}`}
      description={`${distribution.vehicle?.stock_number ?? ""} · Total entitlement ${formatINR(distribution.total_entitlement)} · Balance ${formatINR(distribution.balance_payable)}`}
      size="lg"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} Record Payment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount to Pay (₹)" required hint={`Balance payable: ${formatINR(distribution.balance_payable)}`}>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" required>
            <input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label="Payment Method">
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} />
          </Field>
          <Field label="Reference">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </Field>
        <ScreenshotUpload
          bucket="finance-proofs"
          pathPrefix={`settlements/${distribution.id}`}
          value={proof}
          onChange={setProof}
        />

        {distribution.payments && distribution.payments.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Payment History</h4>
            <div className="space-y-2">
              {distribution.payments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{formatINR(pay.amount)}</span>
                    <span className="text-xs text-slate-500 ml-2">{pay.payment_method} · {formatDate(pay.paid_at, { withTime: true })}</span>
                    {pay.reference && <span className="text-xs text-slate-400 font-mono ml-2">{pay.reference}</span>}
                  </div>
                  {pay.proof_url && (
                    <button onClick={() => viewProof("finance-proofs", pay.proof_url!)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                      View Proof
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
