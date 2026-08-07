import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike } from "lucide-react";
import { PageHeader } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { VehicleDetail } from "@/pages/VehicleDetail";
import type { PageKey, NavigateParams } from "@/components/Layout";

// Desktop counterpart to src/mobile/MobileViewVehicle.tsx: the vehicle picker stays at the
// top of the page and the full vehicle record renders below it, so switching vehicles never
// leaves the page. The record itself is VehicleDetail — the exact same view reached by
// clicking an inventory row — embedded so it drops its own back link.
export function QuickViewVehicle({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");

  return (
    <div className="pb-6">
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <PageHeader title={t("mobileViewVehicle.title")} icon={<Bike size={20} />} />
        <Card className="p-6">
          <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
        </Card>
        {!vehicleId && (
          <Card className="mt-5 p-6">
            <EmptyState icon={<Bike size={20} />} title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleView")} />
          </Card>
        )}
      </div>

      {vehicleId && (
        <VehicleDetail
          key={vehicleId}
          vehicleId={vehicleId}
          onNavigate={onNavigate}
          onBack={() => setVehicleId("")}
          embedded
        />
      )}
    </div>
  );
}
