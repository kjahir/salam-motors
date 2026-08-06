import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, Button } from "./ui/primitives";
import { formatINR, formatPercent } from "@/lib/format";
import { computeProfit } from "@/lib/calc";
import { isHardBlocking, type ComplianceViolation } from "@/lib/compliance";
import type { VehicleWithRelations } from "@/lib/types";
import { MobileSaleSigningPanel } from "./MobileSaleSigningPanel";
import type { MobileNavigate } from "./MobileApp";
import { useEntitlements } from "@/lib/useEntitlements";
import { isFeatureAvailable } from "@/lib/entitlements";

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-mobile-text-muted uppercase">{label}</p>
      <p className="text-xs font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

// Status/summary card only — recording the actual sale is now its own full-screen page
// (MobileAddSale.tsx), which owns the compliance acknowledge-and-proceed logic verbatim
// (moved from this file's former inline Sheet, not rewritten). This tab just shows where
// the vehicle stands and hands off via onNavigate.
export function MobileSaleTab({ vehicle, profit, complianceViolations, onNavigate }: {
  vehicle: VehicleWithRelations;
  profit: ReturnType<typeof computeProfit> | null;
  complianceViolations: ComplianceViolation[];
  onNavigate: MobileNavigate;
}) {
  const { t } = useTranslation();
  const { entitlements } = useEntitlements();

  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);

  return (
    <div className="space-y-3 pt-3">
      {vehicle.sale ? (
        <>
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.saleCompleted")}</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Spec label={t("mobileVehicle.buyer")} value={vehicle.sale.buyer?.full_name} />
            <Spec label={t("mobileVehicle.salePrice")} value={formatINR(vehicle.sale.sale_price)} />
            <Spec label={t("mobileVehicle.netRevenue")} value={formatINR(profit?.netSaleRevenue)} />
            <Spec label={t("mobileVehicle.profit")} value={formatINR(profit?.grossProfit)} />
            <Spec label={t("mobileVehicle.margin")} value={formatPercent(profit?.profitMarginPct)} />
            <Spec label={t("mobileVehicle.returnOnCost")} value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>
        {isFeatureAvailable(entitlements, "esign_estamp") && <MobileSaleSigningPanel sale={vehicle.sale} />}
        </>
      ) : hardBlockingViolations.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-poppins font-semibold text-mobile-error"> {t("vehicleDetail.saleBlockedTitle")}</h3>
          <p className="text-xs text-mobile-text-muted mt-0.5">
            {t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-poppins font-semibold text-mobile-text"> {t("mobileVehicle.notSold")}</h3>
              <p className="text-xs text-mobile-text-muted mt-0.5"> {t("mobileVehicle.recordSaleHint")}</p>
            </div>
            <Button size="sm" onClick={() => onNavigate("add-sale", { vehicleId: vehicle.id })}><ShoppingCart size={14} /> {t("mobileVehicle.recordSale")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
