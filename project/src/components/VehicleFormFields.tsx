import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertTriangle, ChevronDown } from "lucide-react";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { VEHICLE_CATEGORIES, FUEL_TYPES } from "@/lib/constants";
import { normalizeRegistration } from "@/lib/vehicleForm";

export interface VehicleCoreFormData {
  category: string;
  fuel_type: string;
  manufacturer: string;
  model: string;
  registration_number: string;
  colour: string;
  manufacture_year: string;
  variant: string;
  brand: string;
  registration_date: string;
  chassis_number: string;
  engine_number: string;
  odometer: string;
  owner_count: string;
  registration_city: string;
  registration_state: string;
  current_location: string;
  asking_price: string;
  minimum_price: string;
}

interface VehicleFormFieldsProps {
  form: VehicleCoreFormData;
  update: (key: keyof VehicleCoreFormData, value: string) => void;
  regChecking: boolean;
  regAvailable: boolean | null;
  defaultShowMore?: boolean;
}

export function VehicleFormFields({ form, update, regChecking, regAvailable, defaultShowMore = false }: VehicleFormFieldsProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(defaultShowMore);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("vehicleForm.category")} required>
          <Select value={form.category} onChange={(v) => update("category", v)} options={VEHICLE_CATEGORIES} />
        </Field>
        <Field label={t("vehicleForm.fuelType")} required>
          <Select value={form.fuel_type} onChange={(v) => update("fuel_type", v)} options={FUEL_TYPES} />
        </Field>
        <Field label={t("vehicleForm.manufacturer")} required>
          <input className="input" value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} placeholder="e.g. Honda" />
        </Field>
        <Field label={t("vehicleForm.model")} required>
          <input className="input" value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="e.g. Activa 6G" />
        </Field>
        <Field label={t("vehicleForm.registrationNumber")} required hint={t("vehicleForm.registrationHint")} className="sm:col-span-2">
          <div className="relative">
            <input
              className={`input pr-10 ${regAvailable === false ? "border-red-400 focus:border-red-500" : regAvailable === true ? "border-emerald-400 focus:border-emerald-500" : ""}`}
              value={form.registration_number}
              onChange={(e) => update("registration_number", normalizeRegistration(e.target.value))}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="TN 22 AB 1234"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {regChecking ? (
                <Spinner size={14} />
              ) : regAvailable === true ? (
                <Check size={16} className="text-emerald-500" />
              ) : regAvailable === false ? (
                <AlertTriangle size={16} className="text-red-500" />
              ) : null}
            </div>
          </div>
          {regAvailable === false && <p className="text-xs text-red-600 mt-1">{t("vehicleForm.registrationInUse")}</p>}
          {regAvailable === true && <p className="text-xs text-emerald-600 mt-1">{t("vehicleForm.registrationAvailable")}</p>}
        </Field>
        <Field label={t("vehicleForm.colour")}>
          <input className="input" value={form.colour} onChange={(e) => update("colour", e.target.value)} placeholder="Black" />
        </Field>
        <Field label={t("vehicleForm.yearOfManufacture")} required>
          <input className="input" type="number" value={form.manufacture_year} onChange={(e) => update("manufacture_year", e.target.value)} />
        </Field>
      </div>

      <CollapsibleSection
        title={t("vehicleForm.moreDetails")}
        description={t("vehicleForm.optionalDetails")}
        open={showMore}
        onToggle={() => setShowMore((o) => !o)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("vehicleForm.variant")}>
            <input className="input" value={form.variant} onChange={(e) => update("variant", e.target.value)} placeholder="e.g. Std" />
          </Field>
          <Field label={t("vehicleForm.brand")}>
            <input className="input" value={form.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Same as manufacturer usually" />
          </Field>
          <Field label={t("vehicleForm.registrationDate")}>
            <input className="input" type="date" value={form.registration_date} onChange={(e) => update("registration_date", e.target.value)} />
          </Field>
          <Field label={t("vehicleForm.chassisNumber")}>
            <input className="input" value={form.chassis_number} onChange={(e) => update("chassis_number", e.target.value)} placeholder="MBLJEA60GNDJ01234" />
          </Field>
          <Field label={t("vehicleForm.engineNumber")}>
            <input className="input" value={form.engine_number} onChange={(e) => update("engine_number", e.target.value)} />
          </Field>
          <Field label={t("vehicleForm.odometer")}>
            <input className="input" type="number" value={form.odometer} onChange={(e) => update("odometer", e.target.value)} placeholder="18500" />
          </Field>
          <Field label={t("vehicleForm.previousOwners")}>
            <input className="input" type="number" value={form.owner_count} onChange={(e) => update("owner_count", e.target.value)} />
          </Field>
          <Field label={t("vehicleForm.registrationCity")}>
            <input className="input" value={form.registration_city} onChange={(e) => update("registration_city", e.target.value)} placeholder="Chennai" />
          </Field>
          <Field label={t("vehicleForm.registrationState")}>
            <input className="input" value={form.registration_state} onChange={(e) => update("registration_state", e.target.value)} placeholder="Tamil Nadu" />
          </Field>
          <Field label={t("vehicleForm.currentLocation")}>
            <input className="input" value={form.current_location} onChange={(e) => update("current_location", e.target.value)} placeholder="Central Yard" />
          </Field>
          <Field label={t("vehicleForm.askingPrice")}>
            <input className="input" type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} placeholder="79000" />
          </Field>
          <Field label={t("vehicleForm.minimumPrice")}>
            <input className="input" type="number" value={form.minimum_price} onChange={(e) => update("minimum_price", e.target.value)} placeholder="70000" />
          </Field>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({ title, description, open, onToggle, children }: { title: string; description?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  );
}
