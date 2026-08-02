import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Field, Select } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { PartyPickerField } from "@/components/PartyPickerField";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { VehicleFormFields } from "@/components/VehicleFormFields";
import type { VehicleFullFormData } from "@/lib/vehicleForm";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { UploadedFile } from "@/lib/uploadedFile";

interface VehicleDetailsFormProps {
  form: VehicleFullFormData;
  update: <K extends keyof VehicleFullFormData>(key: K, value: VehicleFullFormData[K]) => void;
  regChecking: boolean;
  regAvailable: boolean | null;
  paymentProofs: UploadedFile[];
  onPaymentProofsChange: (files: UploadedFile[]) => void;
  uploadPathPrefix: string;
  /** Submit button(s), rendered in the purchase card's footer. */
  footer: ReactNode;
}

// The single definition of "the vehicle form": used by the Add Vehicle screen and by
// Manage Vehicles' edit mode, so editing a vehicle shows exactly the fields onboarding
// captured. Identity fields come from VehicleFormFields, which mobile shares too.
export function VehicleDetailsForm({
  form,
  update,
  regChecking,
  regAvailable,
  paymentProofs,
  onPaymentProofsChange,
  uploadPathPrefix,
  footer,
}: VehicleDetailsFormProps) {
  const { t } = useTranslation();
  const [showMorePurchase, setShowMorePurchase] = useState(false);

  return (
    <>
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleForm.vehicleIdentity")}</h3>
        <VehicleFormFields form={form} update={update} regChecking={regChecking} regAvailable={regAvailable} />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleForm.seller")}</h3>
        <PartyPickerField partyType="seller" value={form.seller_party_id} onChange={(v) => update("seller_party_id", v)} />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleForm.purchase")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("vehicleForm.purchasePrice")} required>
            <input className="input" type="number" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} placeholder="" />
          </Field>
          <Field label={t("vehicleForm.brokerCommission")}>
            <input className="input" type="number" value={form.broker_commission} onChange={(e) => update("broker_commission", e.target.value)} />
          </Field>
        </div>

        <div className="border border-slate-200 rounded-lg mt-4">
          <button
            type="button"
            onClick={() => setShowMorePurchase((o) => !o)}
            className="flex items-center justify-between w-full p-4 text-left"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{t("vehicleForm.morePurchaseDetails")}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t("vehicleForm.optionalDetails")}</p>
            </div>
            <ChevronDown size={18} className={`text-slate-400 transition-transform shrink-0 ${showMorePurchase ? "rotate-180" : ""}`} />
          </button>
          {showMorePurchase && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("vehicleForm.otherFees")}>
                <input className="input" type="number" value={form.other_fee} onChange={(e) => update("other_fee", e.target.value)} />
              </Field>
              <Field label={t("vehicleForm.paymentMethod")}>
                <Select value={form.payment_method} onChange={(v) => update("payment_method", v)} options={PAYMENT_METHODS} />
              </Field>
              <Field label={t("vehicleForm.paymentReference")}>
                <input className="input" value={form.payment_reference} onChange={(e) => update("payment_reference", e.target.value)} placeholder="UPI/XXXX" />
              </Field>
              <div className="sm:col-span-2">
                <FileUploadGrid
                  bucket="finance-proofs"
                  pathPrefix={uploadPathPrefix}
                  value={paymentProofs}
                  onChange={onPaymentProofsChange}
                  label={t("vehicleForm.paymentProof")}
                  hint={t("vehicleForm.paymentProofHint")}
                />
              </div>
              <Field label={t("vehicleForm.handoverLocation")}>
                <input className="input" value={form.handover_location} onChange={(e) => update("handover_location", e.target.value)} placeholder="" />
              </Field>
              <Field label={t("vehicleForm.odometerAtPurchase")}>
                <input className="input" type="number" value={form.odometer_at_purchase} onChange={(e) => update("odometer_at_purchase", e.target.value)} />
              </Field>
              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.keys_received} onChange={(e) => update("keys_received", e.target.checked)} className="rounded border-slate-300" />
                  {t("vehicleForm.keysReceived")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.documents_received} onChange={(e) => update("documents_received", e.target.checked)} className="rounded border-slate-300" />
                  {t("vehicleForm.documentsReceived")}
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">{footer}</div>
      </Card>
    </>
  );
}
