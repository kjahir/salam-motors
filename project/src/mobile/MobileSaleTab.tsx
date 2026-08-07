import { computeCostBreakdown, computePartnerFunding, computeProfit } from "@/lib/calc";
import type { ComplianceViolation } from "@/lib/compliance";
import type { Partner, VehicleWithRelations } from "@/lib/types";
import { MobileSaleContent } from "./MobileSaleContent";

// Vehicle Detail's own "Sale" tab: renders the same canonical sale page as the full-screen
// MobileAddSale (Cost Sheet/Sale Projection/Record Sale, or Sale Completed/Profit
// Distribution once sold), just embedded in place — no navigating away, matching desktop's
// Sale & Profit tab (VehicleDetail.tsx's SaleTab).
export function MobileSaleTab({ vehicle, cost, funding, partners, profit, marginLow, marginHigh, complianceViolations, onChanged }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  profit: ReturnType<typeof computeProfit> | null;
  marginLow: number;
  marginHigh: number;
  complianceViolations: ComplianceViolation[];
  onChanged: () => void;
}) {
  return (
    <div className="pt-3">
      <MobileSaleContent
        vehicle={vehicle}
        cost={cost}
        funding={funding}
        partners={partners}
        profit={profit}
        marginLow={marginLow}
        marginHigh={marginHigh}
        complianceViolations={complianceViolations}
        onChanged={onChanged}
      />
    </div>
  );
}
