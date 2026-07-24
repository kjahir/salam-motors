import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { PAYMENT_METHODS } from "@/lib/constants";
import { checkRegistrationUnique } from "@/lib/queries";
import { createVehicle } from "@/lib/vehicle";
import { PartyPickerField } from "@/components/PartyPickerField";
import { VehicleFormFields, type VehicleCoreFormData } from "@/components/VehicleFormFields";
import type { PageKey } from "@/components/Layout";

interface AddVehicleProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

interface FormData extends VehicleCoreFormData {
  seller_party_id: string;
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
  notes: string;
}

const initialForm: FormData = {
  registration_number: "",
  category: "Motorcycle",
  manufacturer: "",
  brand: "",
  model: "",
  variant: "",
  fuel_type: "Petrol",
  colour: "",
  manufacture_year: String(new Date().getFullYear() - 2),
  registration_date: "",
  chassis_number: "",
  engine_number: "",
  odometer: "",
  owner_count: "1",
  registration_city: "",
  registration_state: "",
  current_location: "Central Yard",
  asking_price: "",
  minimum_price: "",
  seller_party_id: "",
  purchase_price: "",
  broker_commission: "0",
  other_fee: "0",
  payment_method: "UPI",
  payment_reference: "",
  handover_location: "",
  odometer_at_purchase: "",
  keys_received: true,
  documents_received: false,
  notes: "",
};

export function AddVehicle({ onNavigate }: AddVehicleProps) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(null);
  const [showMorePurchase, setShowMorePurchase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
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
      toast("Please complete all required fields before submitting", "error");
      return;
    }
    setSubmitting(true);
    try {
      const v = await createVehicle(form, user?.email ?? "Unknown");
      setCreatedId(v.id);
      toast(`${v.stock_number} onboarded successfully`, "success");
    } catch (e) {
      toast(
        e instanceof Error
          ? `${e.message} — the vehicle was not created and any partial changes were rolled back.`
          : "Failed to create vehicle. Any partial changes were rolled back.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Onboarded</h2>
          <p className="text-sm text-slate-500 mt-1">
            The vehicle has been created with its purchase and seller records.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => onNavigate("vehicle", { vehicleId: createdId })} className="btn-primary">
              View Vehicle Details <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setForm(initialForm);
                setCreatedId(null);
              }}
              className="btn-secondary"
            >
              Onboard Another
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title="Onboard Vehicle" description="Capture the essentials now — the rest can be filled in later" />

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Vehicle Identity</h3>
        <VehicleFormFields form={form} update={update} regChecking={regChecking} regAvailable={regAvailable} />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Seller</h3>
        <PartyPickerField partyType="seller" value={form.seller_party_id} onChange={(v) => update("seller_party_id", v)} />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Purchase</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Purchase Price (₹)" required>
            <input className="input" type="number" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} placeholder="62000" />
          </Field>
          <Field label="Broker Commission (₹)">
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
              <p className="text-sm font-medium text-slate-900">More purchase details</p>
              <p className="text-xs text-slate-500 mt-0.5">Optional — fill in now or add later from the vehicle's detail page</p>
            </div>
            <ChevronDown size={18} className={`text-slate-400 transition-transform shrink-0 ${showMorePurchase ? "rotate-180" : ""}`} />
          </button>
          {showMorePurchase && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Other Fees (₹)">
                <input className="input" type="number" value={form.other_fee} onChange={(e) => update("other_fee", e.target.value)} />
              </Field>
              <Field label="Payment Method">
                <Select value={form.payment_method} onChange={(v) => update("payment_method", v)} options={PAYMENT_METHODS} />
              </Field>
              <Field label="Payment Reference">
                <input className="input" value={form.payment_reference} onChange={(e) => update("payment_reference", e.target.value)} placeholder="UPI/XXXX" />
              </Field>
              <Field label="Handover Location">
                <input className="input" value={form.handover_location} onChange={(e) => update("handover_location", e.target.value)} placeholder="Chennai" />
              </Field>
              <Field label="Odometer at Purchase">
                <input className="input" type="number" value={form.odometer_at_purchase} onChange={(e) => update("odometer_at_purchase", e.target.value)} />
              </Field>
              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.keys_received} onChange={(e) => update("keys_received", e.target.checked)} className="rounded border-slate-300" />
                  Keys received
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.documents_received} onChange={(e) => update("documents_received", e.target.checked)} className="rounded border-slate-300" />
                  Documents received
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
          <button onClick={handleCreate} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={16} /> : <Check size={16} />} Create Vehicle
          </button>
        </div>
      </Card>
    </div>
  );
}
