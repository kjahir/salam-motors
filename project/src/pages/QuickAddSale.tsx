import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { VehicleDetail } from "@/pages/VehicleDetail";
import type { PageKey, NavigateParams } from "@/components/Layout";

// Desktop counterpart to ManageVehicles / QuickAddExpense / QuickViewVehicle: the vehicle
// picker stays at the top, and the generic sale form renders below it. That form is
// VehicleDetail's own Sale & Profit tab — the one canonical Record Sale design, also
// reached from the Dashboard's Sell Vehicle button and from the vehicle page itself —
// embedded here with initialTab="sale" so picking a vehicle drops straight into it.
export function QuickAddSale({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");

  return (
    <div className="pb-6">
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <PageHeader title={t("dashboard.sellVehicle")} icon={<ShoppingCart size={20} />} />
        <Card className="p-6">
          <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
        </Card>
        {!vehicleId && (
          <Card className="mt-5 p-6">
            <EmptyState icon={<ShoppingCart size={20} />} title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleSale")} />
          </Card>
        )}
      </div>

      {vehicleId && (
        <VehicleDetail
          key={vehicleId}
          vehicleId={vehicleId}
          onNavigate={onNavigate}
          onBack={() => setVehicleId("")}
          initialTab="sale"
          embedded
        />
      )}
    </div>
  );
}
