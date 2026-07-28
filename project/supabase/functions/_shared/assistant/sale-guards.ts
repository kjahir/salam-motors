import type { ParsedProposal } from "./actions.ts";
import { asRecord, requiredNumber } from "./validation.ts";

export interface AuthoritativeSaleSnapshot {
  vehicleUpdatedAt: string;
  totalVehicleCost: number;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Injects sale concurrency and financial guards from caller-authorized data.
 * These fields deliberately do not exist in the model tool schema.
 */
export function withAuthoritativeSaleGuards(
  proposal: ParsedProposal,
  snapshot: AuthoritativeSaleSnapshot,
): ParsedProposal {
  const argumentsValue = asRecord(proposal.arguments);
  const sale = asRecord(argumentsValue.sale);
  const vehicleUpdatedAt = snapshot.vehicleUpdatedAt.trim();
  const totalVehicleCost = Number(snapshot.totalVehicleCost);
  if (!vehicleUpdatedAt || !Number.isFinite(Date.parse(vehicleUpdatedAt))) {
    throw new Error("The vehicle concurrency snapshot is invalid");
  }
  if (!Number.isFinite(totalVehicleCost) || totalVehicleCost < 0) {
    throw new Error("The vehicle cost snapshot is invalid");
  }

  const salePrice = requiredNumber(sale, "sale_price", 0.01, 999_999_999);
  const buyerCharges = requiredNumber(
    sale,
    "buyer_charges",
    0,
    999_999_999,
  );
  const discount = requiredNumber(sale, "discount", 0, 999_999_999);
  const expectedGrossProfit = Number(
    (salePrice + buyerCharges - discount - totalVehicleCost).toFixed(2),
  );

  return {
    ...proposal,
    arguments: {
      ...argumentsValue,
      sale: {
        ...sale,
        expected_vehicle_updated_at: vehicleUpdatedAt,
        expected_total_vehicle_cost: totalVehicleCost,
        expected_gross_profit: expectedGrossProfit,
      },
    },
    changes: [
      ...proposal.changes,
      {
        label: "Expected gross profit",
        to: money(expectedGrossProfit),
      },
    ],
  };
}

