import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, ChevronRight } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { useEntitlements } from "@/lib/useEntitlements";
import { canWrite } from "@/lib/entitlements";
import { checkRegistrationUnique } from "@/lib/queries";
import { createVehicle } from "@/lib/vehicle";
import { VehicleDetailsForm } from "@/components/VehicleDetailsForm";
import { emptyVehicleForm, type VehicleFullFormData } from "@/lib/vehicleForm";
import type { UploadedFile } from "@/lib/uploadedFile";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface AddVehicleProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  /** Rendered inside Manage Vehicles, which owns the page heading. */
  embedded?: boolean;
  /** Lets the host page react to a successful onboard (e.g. select the new vehicle). */
  onCreated?: (vehicleId: string) => void;
}

export function AddVehicle({ onNavigate, embedded, onCreated }: AddVehicleProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<VehicleFullFormData>(emptyVehicleForm);
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [paymentProofs, setPaymentProofs] = useState<UploadedFile[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());
  const { toast } = useToast();
  const { user } = useAuth();
  const { entitlements } = useEntitlements();

  const update = <K extends keyof VehicleFullFormData>(key: K, value: VehicleFullFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Debounced registration uniqueness check
  useEffect(() => {
    if (!form.registration_number.trim()) {
      setRegAvailable(null);
      return;
    }
    setRegChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await checkRegistrationUnique(form.registration_number.trim());
        setRegAvailable(ok);
      } catch {
        setRegAvailable(null);
      } finally {
        setRegChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.registration_number]);

  const isValid = Boolean(
    form.manufacturer.trim() &&
    form.model.trim() &&
    form.registration_number.trim() &&
    form.manufacture_year &&
    form.seller_party_id &&
    form.purchase_price && Number(form.purchase_price) > 0,
  ) && regAvailable === true;

  const handleCreate = async () => {
    if (!isValid) {
      toast(t("vehicleForm.requiredMissing"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const v = await createVehicle(
        { ...form, payment_proof_paths: paymentProofs.map((p) => p.path) },
        user?.email ?? "Unknown",
      );
      setCreatedId(v.id);
      toast(t("vehicleForm.onboardSuccess", { stock: v.stock_number }), "success");
      onCreated?.(v.id);
    } catch (e) {
      toast(
        e instanceof Error
          ? t("vehicleForm.errorRollback", { message: e.message })
          : t("vehicleForm.createFailedRollback"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <div className={embedded ? "max-w-2xl mx-auto" : "p-6 max-w-2xl mx-auto"}>
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t("vehicleForm.vehicleOnboarded")}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t("vehicleForm.createdDescription")}
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => onNavigate("vehicle", { vehicleId: createdId })} className="btn-primary">
              {t("vehicleForm.viewVehicleDetails")} <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setForm(emptyVehicleForm());
                setCreatedId(null);
                setPaymentProofs([]);
                setUploadSessionId(crypto.randomUUID());
              }}
              className="btn-secondary"
            >
              {t("vehicleForm.onboardAnother")}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // The database rejects the insert outright when the subscription has
  // lapsed, so filling in the whole onboarding form would end in a failure
  // at submit. Say so up front instead.
  if (!canWrite(entitlements)) {
    return (
      <div className={embedded ? "space-y-5" : "p-6 max-w-2xl mx-auto space-y-5"}>
        {!embedded && <PageHeader title={t("vehicleForm.onboardTitle")} />}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">
            {t("billing.banner.read_only.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("billing.banner.read_only.body")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-5" : "p-6 max-w-3xl mx-auto space-y-5"}>
      {!embedded && <PageHeader title={t("vehicleForm.onboardTitle")} description={t("vehicleForm.description")} />}

      <VehicleDetailsForm
        form={form}
        update={update}
        regChecking={regChecking}
        regAvailable={regAvailable}
        paymentProofs={paymentProofs}
        onPaymentProofsChange={setPaymentProofs}
        uploadPathPrefix={`purchase-payments/${uploadSessionId}`}
        footer={
          <button onClick={handleCreate} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={16} /> : <Check size={16} />} {t("vehicleForm.createVehicle")}
          </button>
        }
      />
    </div>
  );
}
