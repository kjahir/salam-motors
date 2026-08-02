import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { fetchVehicles } from "@/lib/queries";
import { PAYMENT_METHODS, INVESTMENT_STATUSES } from "@/lib/constants";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import type { UploadedFile } from "@/lib/uploadedFile";
import { syncVehicleAlerts } from "@/lib/compliance";
import { vehicleLabel } from "@/lib/vehicleLabel";
import type { Partner, Vehicle } from "@/lib/types";

interface AddInvestmentModalProps {
  partner: Partner;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AddInvestmentModal({ partner, open, onClose, onSaved }: AddInvestmentModalProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [amount, setAmount] = useState("");
  const [investmentDate, setInvestmentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [purpose, setPurpose] = useState(() => t("financeModals.capitalContribution"));
  const [status, setStatus] = useState("Received");
  const [notes, setNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

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
    setPurpose(t("financeModals.capitalContribution"));
    setStatus("Received");
    setNotes("");
    setProofFiles([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = Boolean(amount && Number(amount) > 0 && investmentDate);

  const handleSubmit = async () => {
    if (!isValid) {
      toast(t("financeModals.validAmountDate"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const proofUrls = proofFiles.map((f) => f.path);
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
        proof_url: proofUrls[0] ?? null,
        proof_urls: proofUrls,
      });
      if (error) throw error;
      toast(t("financeModals.investmentRecorded"), "success");
      if (vehicleId) syncVehicleAlerts(vehicleId).catch(() => {});
      onSaved();
      handleClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("financeModals.investmentFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("financeModals.addInvestmentTitle", { partner: partner.name })}
      size="lg"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary">{t("financeModals.cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} {t("financeModals.recordInvestment")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("financeModals.amount")} required>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="" />
          </Field>
          <Field label={t("financeModals.date")} required>
            <input className="input" type="date" value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} />
          </Field>
          <Field label={t("financeModals.vehicleOptional")} hint={t("financeModals.vehicleHint")}>
            <Select
              value={vehicleId}
              onChange={setVehicleId}
              placeholder={t("financeModals.vehiclePlaceholder")}
              options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
            />
          </Field>
          <Field label={t("financeModals.status")}>
            <Select value={status} onChange={setStatus} options={INVESTMENT_STATUSES.map((s) => ({ value: s, label: trStatus(s) }))} />
          </Field>
          <Field label={t("financeModals.paymentMethod")}>
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS.map((method) => ({ value: method, label: trStatus(method) }))} />
          </Field>
          <Field label={t("financeModals.reference")}>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI/XXXX" />
          </Field>
        </div>
        <Field label={t("financeModals.purpose")}>
          <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("financeModals.capitalContribution")} />
        </Field>
        <Field label={t("financeModals.notes")}>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("financeModals.optionalNotes")} />
        </Field>
        <FileUploadGrid
          bucket="finance-proofs"
          pathPrefix={`investments/${partner.id}`}
          value={proofFiles}
          onChange={setProofFiles}
          label={t("financeModals.paymentProof")}
          hint={t("financeModals.proofHint")}
        />
      </div>
    </Modal>
  );
}
