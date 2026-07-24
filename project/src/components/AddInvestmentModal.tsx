import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { fetchVehicles } from "@/lib/queries";
import { PAYMENT_METHODS, INVESTMENT_STATUSES } from "@/lib/constants";
import { ScreenshotUpload, type UploadedProof } from "@/components/ScreenshotUpload";
import type { Partner, Vehicle } from "@/lib/types";

interface AddInvestmentModalProps {
  partner: Partner;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AddInvestmentModal({ partner, open, onClose, onSaved }: AddInvestmentModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [amount, setAmount] = useState("");
  const [investmentDate, setInvestmentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [purpose, setPurpose] = useState("Capital contribution");
  const [status, setStatus] = useState("Received");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<UploadedProof | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    fetchVehicles().then(setVehicles).catch(() => { /* ignore */ });
  }, [open]);

  const reset = () => {
    setVehicleId("");
    setAmount("");
    setInvestmentDate(todayISO());
    setPaymentMethod("Bank transfer");
    setReference("");
    setPurpose("Capital contribution");
    setStatus("Received");
    setNotes("");
    setProof(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = Boolean(amount && Number(amount) > 0 && investmentDate);

  const handleSubmit = async () => {
    if (!isValid) {
      toast("Enter a valid amount and date", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("investments").insert({
        partner_id: partner.id,
        vehicle_id: vehicleId || null,
        amount: Number(amount),
        investment_date: new Date(investmentDate).toISOString(),
        purpose: purpose.trim() || null,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        status,
        notes: notes.trim() || null,
        proof_url: proof?.path ?? null,
      });
      if (error) throw error;
      toast("Investment recorded", "success");
      onSaved();
      handleClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to record investment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Add Investment — ${partner.name}`}
      size="lg"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} Record Investment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount (₹)" required>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
          </Field>
          <Field label="Date" required>
            <input className="input" type="date" value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} />
          </Field>
          <Field label="Vehicle (optional)" hint="Leave blank for general business capital">
            <Select
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="General — not vehicle-specific"
              options={vehicles.map((v) => ({ value: v.id, label: `${v.stock_number} · ${v.manufacturer} ${v.model}` }))}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={setStatus} options={INVESTMENT_STATUSES} />
          </Field>
          <Field label="Payment Method">
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} />
          </Field>
          <Field label="Reference">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
          </Field>
        </div>
        <Field label="Purpose">
          <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Capital contribution" />
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </Field>
        <ScreenshotUpload
          bucket="finance-proofs"
          pathPrefix={`investments/${partner.id}`}
          value={proof}
          onChange={setProof}
        />
      </div>
    </Modal>
  );
}
