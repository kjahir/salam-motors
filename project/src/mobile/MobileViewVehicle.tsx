import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import type { MobileNavigate } from "./MobileApp";

// Full-screen "View Vehicle" entry point: pick a vehicle from the dropdown, which then
// takes you straight to the existing vehicle detail page (the same overall page shown
// when tapping an inventory item) — this page itself only exists to offer that picker
// when there's no vehicle already in context, so it forwards immediately if there is.
export function MobileViewVehicle({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");

  useEffect(() => {
    if (initialVehicleId) onNavigate("vehicle", { vehicleId: initialVehicleId });
  }, [initialVehicleId, onNavigate]);

  const handleSelect = (id: string) => {
    setVehicleId(id);
    if (id) onNavigate("vehicle", { vehicleId: id });
  };

  if (initialVehicleId) return null;

  return (
    <div>
      <TopBar title={t("mobileViewVehicle.title")} onBack={onBack} />
      <div className="p-4 space-y-4">
        <VehicleSelectField value={vehicleId} onChange={handleSelect} />
      </div>
    </div>
  );
}
