import { supabase } from "./supabase";
import { formatINR } from "./format";
import type { Partner, VehicleWithRelations } from "./types";
import type { CostBreakdown, PartnerFunding } from "./calc";

export interface CompleteSaleInput {
  buyer_party_id: string;
  sale_price: number;
  discount: number;
  buyer_charges: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  delivery_location: string;
  notes: string;
}

/**
 * Records a sale — sale + sale_payment + vehicle status update + listing sync + status
 * history + auto-allocated profit-share (if none exist yet) + profit distributions +
 * audit log — as one rollback-protected sequence. Shared by desktop's Sale & Profit tab
 * and mobile's Sold status toggle so profit distribution always runs the same way,
 * regardless of which screen completes the sale.
 */
export async function completeSale(
  vehicle: VehicleWithRelations,
  cost: CostBreakdown,
  funding: PartnerFunding[],
  partners: Partner[],
  input: CompleteSaleInput,
  performedBy: string,
): Promise<void> {
  if (!input.buyer_party_id || !input.sale_price || input.sale_price <= 0) {
    throw new Error("Select buyer and enter sale price");
  }
  const openCriticalAlerts = (vehicle.alerts ?? []).filter((a) => a.status === "Open" && a.severity === "Critical");
  if (openCriticalAlerts.length > 0) {
    throw new Error(
      `This vehicle has ${openCriticalAlerts.length} open Critical alert${openCriticalAlerts.length > 1 ? "s" : ""} (${openCriticalAlerts.map((a) => a.title).join(", ")}). Resolve them before recording a sale.`,
    );
  }
  const netRevenue = input.sale_price + input.buyer_charges - input.discount;
  if (netRevenue < cost.totalVehicleCost && !input.notes.trim()) {
    throw new Error(
      "This sale is at a loss. Please provide a reason in the notes explaining why the vehicle is being sold below cost.",
    );
  }

  let saleId: string | null = null;
  let statusHistoryId: string | null = null;
  let vehicleUpdated = false;
  let listingUpdated = false;
  const previousListingStatus = vehicle.listing?.status ?? null;
  const distributionIds: string[] = [];
  const allocationIds: string[] = [];

  const rollback = async () => {
    try {
      for (const id of distributionIds) {
        await supabase.from("profit_distributions").delete().eq("id", id);
      }
      for (const id of allocationIds) {
        await supabase.from("vehicle_profit_share_allocations").delete().eq("id", id);
      }
      if (statusHistoryId) {
        await supabase.from("vehicle_status_history").delete().eq("id", statusHistoryId);
      }
      if (listingUpdated && vehicle.listing) {
        await supabase.from("listings").update({ status: previousListingStatus }).eq("id", vehicle.listing.id);
      }
      if (vehicleUpdated) {
        await supabase.from("vehicles").update({
          current_status: vehicle.current_status,
          sold_at: vehicle.sold_at ?? null,
        }).eq("id", vehicle.id);
      }
      if (saleId) {
        await supabase.from("sale_payments").delete().eq("sale_id", saleId);
        await supabase.from("sales").delete().eq("id", saleId);
      }
    } catch {
      // best-effort cleanup; the original error is what gets surfaced to the caller
    }
  };

  try {
    const grossProfit = netRevenue - cost.totalVehicleCost;
    const isDelivered = input.delivery_status === "Delivered";

    const { data: saleRec, error: saleErr } = await supabase.from("sales").insert({
      vehicle_id: vehicle.id,
      buyer_party_id: input.buyer_party_id,
      sale_date: new Date().toISOString(),
      sale_price: input.sale_price,
      discount: input.discount,
      buyer_charges: input.buyer_charges,
      payment_status: input.payment_status,
      delivery_status: input.delivery_status,
      delivered_at: isDelivered ? new Date().toISOString() : null,
      delivery_location: input.delivery_location || null,
      notes: input.notes || null,
      status: "Completed",
    }).select().single();
    if (saleErr) throw saleErr;
    saleId = saleRec.id;

    const { error: payErr } = await supabase.from("sale_payments").insert({
      sale_id: saleRec.id,
      amount: netRevenue,
      payment_method: input.payment_method,
      paid_at: new Date().toISOString(),
    });
    if (payErr) throw payErr;

    const { error: vehUpdErr } = await supabase.from("vehicles").update({
      current_status: "SOLD",
      sold_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", vehicle.id);
    if (vehUpdErr) throw vehUpdErr;
    vehicleUpdated = true;

    if (vehicle.listing) {
      const { error: listErr } = await supabase.from("listings").update({ status: "Sold" }).eq("id", vehicle.listing.id);
      if (listErr) throw listErr;
      listingUpdated = true;
    }

    const { data: historyRec, error: histErr } = await supabase.from("vehicle_status_history").insert({
      vehicle_id: vehicle.id,
      previous_status: vehicle.current_status,
      new_status: "SOLD",
      reason: `Sale completed at ${formatINR(input.sale_price)}`,
    }).select().single();
    if (histErr) throw histErr;
    statusHistoryId = historyRec.id;

    // Profit-share allocations: a vehicle only gets these set up explicitly in rare
    // cases, so if none exist yet, apply every partner's default profit-share % now,
    // at the point of sale, rather than leaving the profit unassigned to anyone.
    let allocations: { partner_id: string; percentage: number }[] = vehicle.profit_share_allocations ?? [];
    if (allocations.length === 0 && partners.length > 0) {
      for (const p of partners) {
        const { data: allocRec, error: allocErr } = await supabase.from("vehicle_profit_share_allocations").insert({
          vehicle_id: vehicle.id,
          partner_id: p.id,
          percentage: p.default_profit_share_pct,
        }).select().single();
        if (allocErr) throw allocErr;
        allocationIds.push(allocRec.id);
      }
      allocations = partners.map((p) => ({ partner_id: p.id, percentage: p.default_profit_share_pct }));
    }

    const isLoss = grossProfit < 0;
    const absProfit = Math.abs(grossProfit);

    for (const alloc of allocations) {
      const fund = funding.find((f) => f.partnerId === alloc.partner_id);
      const principalReturn = fund?.totalInvested ?? 0;
      const profitShare = isLoss ? 0 : (absProfit * alloc.percentage) / 100;
      const lossShare = isLoss ? (absProfit * alloc.percentage) / 100 : 0;
      const totalEntitlement = principalReturn + profitShare - lossShare;

      const { data: distRec, error: distErr } = await supabase.from("profit_distributions").insert({
        vehicle_id: vehicle.id,
        sale_id: saleRec.id,
        partner_id: alloc.partner_id,
        principal_return: principalReturn,
        profit_share: profitShare,
        loss_share: lossShare,
        total_entitlement: totalEntitlement,
        amount_paid: 0,
        balance_payable: totalEntitlement,
        status: "Calculated",
      }).select().single();
      if (distErr) throw distErr;
      distributionIds.push(distRec.id);
    }

    const { error: auditErr } = await supabase.from("audit_logs").insert({
      entity_type: "vehicle",
      entity_id: vehicle.id,
      action: "sold",
      performed_by: performedBy,
      reason: `Sale completed at ${formatINR(input.sale_price)}, profit ${formatINR(grossProfit)}`,
    });
    if (auditErr) throw auditErr;
  } catch (e) {
    await rollback();
    throw e;
  }
}
