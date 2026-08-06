import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { formatINR } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { fetchCompliancePolicies } from "@/lib/queries";
import { recordSettlementPayment } from "@/lib/settlement";
import { vehicleRef } from "@/lib/vehicleLabel";
import type { UploadedFile } from "@/lib/uploadedFile";
import type { Partner, ProfitDistribution, Vehicle } from "@/lib/types";

type Row = ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null };

interface MultiSettlementModalProps {
  /** Every row must share the same partner_id — the caller (the Settlement table's checkbox
   *  selection) is what enforces that, this modal just trusts it. */
  distributions: Row[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function MultiSettlementModal({ distributions, open, onClose, onSaved }: MultiSettlementModalProps) {
  const { t } = useTranslation();
  const [paidAt, setPaidAt] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [proofRequired, setProofRequired] = useState(false);
  const { toast } = useToast();

  const trStatus = (value: string) => t("status." + value, { defaultValue: value });
  const partner = distributions[0]?.partner ?? null;
  const total = distributions.reduce((s, d) => s + d.balance_payable, 0);

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

  const isValid = distributions.length > 0 && (!proofRequired || proofFiles.length > 0);

  const handleSubmit = async () => {
    if (proofRequired && proofFiles.length === 0) {
      toast(t("financeModals.settlementProofRequired"), "error");
      return;
    }
    setSubmitting(true);
    const proofUrls = proofFiles.map((f) => f.path);
    const succeeded: string[] = [];
    const failed: { stock: string; message: string }[] = [];
    for (const dist of distributions) {
      const stock = dist.vehicle?.stock_number ?? "";
      const label = vehicleRef(dist.vehicle);
      const otherLabels = distributions.filter((d) => d.id !== dist.id).map((d) => vehicleRef(d.vehicle));
      try {
        await recordSettlementPayment(
          dist,
          stock,
          {
            amount: dist.balance_payable,
            paidAt,
            paymentMethod,
            reference: reference.trim() || null,
            notes: [
              notes.trim() || null,
              otherLabels.length > 0
                ? t("financeModals.combinedSettlementNote", { vehicles: otherLabels.join(", ") })
                : null,
            ].filter(Boolean).join(" — ") || null,
            proofUrls,
          },
          () => toast(t("financeModals.investmentReturnUpdateFailed"), "error"),
        );
        succeeded.push(label);
      } catch (e) {
        failed.push({ stock: label, message: e instanceof Error ? e.message : t("financeModals.settlementFailed") });
      }
    }
    setSubmitting(false);

    if (failed.length === 0) {
      toast(t("financeModals.combinedSettlementCompleted", { count: succeeded.length }), "success");
      onSaved();
      handleClose();
    } else if (succeeded.length === 0) {
      toast(t("financeModals.settlementFailed"), "error");
    } else {
      // Partial success: surface exactly what happened rather than pretending it's all-or-
      // nothing — the succeeded ones are genuinely settled and shouldn't be hidden as failed.
      toast(
        t("financeModals.combinedSettlementPartial", {
          succeeded: succeeded.length,
          failed: failed.length,
          vehicles: failed.map((f) => f.stock).join(", "),
        }),
        "error",
      );
      onSaved();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("financeModals.combinedSettleTitle", { partner: partner?.name ?? t("financeModals.partner"), count: distributions.length })}
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
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("financePage.columns.vehicle")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("partnersPage.balancePayable")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distributions.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2 text-slate-700">{d.vehicle ? vehicleRef(d.vehicle) : "—"}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{formatINR(d.balance_payable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr className="font-semibold">
                <td className="px-3 py-2">{t("partnersPage.total")}</td>
                <td className="px-3 py-2 text-right">{formatINR(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("financeModals.amountToPay")} hint={t("financeModals.combinedAmountHint")}>
            <input className="input bg-slate-50 text-slate-500" type="text" value={formatINR(total)} disabled readOnly />
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
          pathPrefix={`settlements/combined/${distributions.map((d) => d.id).join("-")}`}
          value={proofFiles}
          onChange={setProofFiles}
          label={t("financeModals.paymentProof")}
          required={proofRequired}
          hint={t("financeModals.combinedProofHint")}
        />
      </div>
    </Modal>
  );
}
