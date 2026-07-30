import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import type { PageKey, NavigateParams } from "@/components/Layout";

// Desktop counterpart to src/mobile/MobileViewVehicle.tsx: pick a vehicle from the
// dropdown, which takes you straight to the existing vehicle detail page (the same
// overall page shown when clicking an inventory row).
export function QuickViewVehicle({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");

  const handleSelect = (id: string) => {
    setVehicleId(id);
    if (id) onNavigate("vehicle", { vehicleId: id });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileViewVehicle.title")} />
      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={handleSelect} />
      </Card>
    </div>
  );
}
