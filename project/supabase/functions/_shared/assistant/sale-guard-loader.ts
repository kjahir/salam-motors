/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase client results are narrowed before use. */
// deno-lint-ignore-file no-explicit-any
import type { ParsedProposal } from "./actions.ts";
import type { SupabaseClientLike } from "./types.ts";
import {
  asRecord,
  requiredNumber,
  requiredString,
} from "./validation.ts";
import { withAuthoritativeSaleGuards } from "./sale-guards.ts";

/**
 * Reads guard values through the caller-JWT client. The model supplies neither
 * the vehicle version nor cost/profit expectations used by the command RPC.
 */
export async function addAuthoritativeSaleGuards(
  client: SupabaseClientLike,
  orgId: string,
  proposal: ParsedProposal,
  locale: string,
): Promise<ParsedProposal> {
  const argumentsValue = asRecord(proposal.arguments);
  const vehicleId = requiredString(argumentsValue, "vehicle_id", 64);
  const [vehicleResult, financialResult] = await Promise.all([
    client.from("vehicles").select("id, updated_at")
      .eq("id", vehicleId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    client.from("vehicle_financial_summary")
      .select("vehicle_id, total_vehicle_cost")
      .eq("vehicle_id", vehicleId)
      .maybeSingle(),
  ]);

  if (vehicleResult.error || financialResult.error) {
    throw new Error("The current vehicle sale preview could not be read");
  }
  if (!vehicleResult.data || !financialResult.data) {
    throw new Error("The vehicle or its financial summary is unavailable");
  }

  const vehicle = asRecord(vehicleResult.data);
  const financial = asRecord(financialResult.data);
  return withAuthoritativeSaleGuards(proposal, {
    vehicleUpdatedAt: requiredString(vehicle, "updated_at", 80),
    totalVehicleCost: requiredNumber(
      financial,
      "total_vehicle_cost",
      0,
      999_999_999,
    ),
  }, locale);
}

