import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner } from "./ui/primitives";
import { MobileVehicleSearch } from "./ui/MobileVehicleSearch";
import { fetchVehicleFull, fetchPartners, fetchCompliancePolicies, fetchAppSettings } from "@/lib/queries";
import { evaluateVehicleCompliance } from "@/lib/compliance";
import { computeCostBreakdown, computePartnerFunding, computeProfit } from "@/lib/calc";
import type { Partner, VehicleWithRelations, CompliancePolicy, AppSettings } from "@/lib/types";
import { MobileSaleContent } from "./MobileSaleContent";

// Full-screen "Record Sale" page for the entry points with no vehicle already in context
// (Dashboard's Sell Vehicle action, Manage Vehicle's Add Sale button): a vehicle search bar
// on top, and the one canonical sale page (MobileSaleContent) underneath it. Reached via
// onNavigate("add-sale", …).
export function MobileAddSale({ vehicleId: initialVehicleId, onBack }: {
  vehicleId?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(Boolean(vehicleId));

  const reload = async () => {
    if (!vehicleId) return;
    const v = await fetchVehicleFull(vehicleId);
    setVehicle(v);
  };

  useEffect(() => {
    if (!vehicleId) {
      setVehicle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchVehicleFull(vehicleId), fetchPartners(), fetchCompliancePolicies(), fetchAppSettings()]).then(([v, p, pol, st]) => {
      if (cancelled) return;
      setVehicle(v);
      setPartners(p);
      setPolicies(pol);
      setSettings(st);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(() => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []), [vehicle]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);
  const profit = useMemo(() => computeProfit(vehicle?.sale, cost), [vehicle, cost]);
  const complianceViolations = useMemo(() => (vehicle ? evaluateVehicleCompliance(vehicle, policies) : []), [vehicle, policies]);
  const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
  const marginHigh = settings?.estimated_profit_margin_high_pct ?? 50;

  return (
    <div>
      <TopBar title={t("mobileVehicle.recordSale")} onBack={onBack} />
      <div className="p-4 space-y-3 pb-28">
        <MobileVehicleSearch value={vehicleId} onChange={(id) => setVehicleId(id)} label={t("mobileAdd.selectVehicle")} />

        {vehicleId && (loading || !vehicle) && (
          <div className="flex items-center justify-center py-10"><Spinner size={28} /></div>
        )}

        {vehicleId && !loading && vehicle && (
          <MobileSaleContent
            key={vehicleId}
            vehicle={vehicle}
            cost={cost}
            funding={funding}
            partners={partners}
            profit={profit}
            marginLow={marginLow}
            marginHigh={marginHigh}
            complianceViolations={complianceViolations}
            onChanged={reload}
          />
        )}
      </div>
    </div>
  );
}
