import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Select, Spinner } from "./primitives";
import { fetchVehicles } from "@/lib/queries";
import { vehicleLabel } from "@/lib/vehicleLabel";
import type { Vehicle } from "@/lib/types";

// Shared vehicle-picker dropdown used at the top of every full-screen "act on a vehicle"
// mobile page (Update Vehicle, Add Expense/Document/Inspection, Make Sales, View Vehicle),
// replacing the old pre-navigation picker Sheet — each page now owns its own selection.
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
        <div className="flex items-center gap-2 rounded-xl border border-mobile-border bg-white px-3.5 py-2.5">
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
        <p className="text-xs text-mobile-text-muted mt-1">{t("mobileAdd.noVehicles")}</p>
      )}
    </Field>
  );
}
