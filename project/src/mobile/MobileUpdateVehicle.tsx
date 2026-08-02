import { useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Button, EmptyState } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { MobileVehicleForm } from "./MobileVehicleForm";
import type { MobileNavigate } from "./MobileApp";

// Mobile counterpart of src/pages/ManageVehicles.tsx: pick a vehicle and its whole record
// opens in the same form onboarding uses, ready to edit; "New" leads to that form in create
// mode. Replaces the old field-by-field builder, which could only patch one column at a
// time and did not match what the desktop now does.
export function MobileUpdateVehicle({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");

  return (
    <div>
      <TopBar title={t("manageVehicles.title")} onBack={onBack} />
      <div className="p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
          </div>
          <Button variant="secondary" onClick={() => onNavigate("add-vehicle")} className="shrink-0" disabled={!!vehicleId}>
            <Plus size={16} /> {t("manageVehicles.addNew")}
          </Button>
          <Button variant="secondary" onClick={() => onNavigate("add-sale")} className="shrink-0" disabled={!vehicleId}>
            <ShoppingCart size={16}  /> {t("manageVehicles.addSale")}
          </Button>
          
        </div>

        {!vehicleId && (
          <Card className="p-5">
            <EmptyState title={t("manageVehicles.emptyTitle")} description={t("manageVehicles.emptyDescription")} />
          </Card>
        )}
      </div>

      {vehicleId && (
        <MobileVehicleForm
          key={vehicleId}
          mode="edit"
          vehicleId={vehicleId}
          embedded
          onNavigate={onNavigate}
          onBack={onBack}
        />
      )}
    </div>
  );
}
