import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { fetchVehicles } from "@/lib/queries";
import { vehicleLabel } from "@/lib/vehicleLabel";
import type { Vehicle } from "@/lib/types";

// Desktop counterpart to src/mobile/ui/VehicleSelectField.tsx — same shared vehicle-picker
// dropdown, used at the top of every desktop "act on a vehicle" quick page (Update
// Vehicle, Add Expense/Document/Inspection, Make Sales, View Vehicle).
export function VehicleSelectField({ value, onChange }: { value: string; onChange: (vehicleId: string) => void }) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVehicles().then((v) => {
      if (!cancelled) setVehicles(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Field label={t("mobileAdd.selectVehicle")} required>
      {vehicles === null ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2">
          <Spinner size={16} />
        </div>
      ) : (
        <Select
          value={value}
          onChange={onChange}
          placeholder={t("mobileAdd.chooseVehicle")}
          options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
        />
      )}
      {vehicles !== null && vehicles.length === 0 && (
        <p className="text-xs text-slate-500 mt-1">{t("mobileAdd.noVehicles")}</p>
      )}
    </Field>
  );
}
