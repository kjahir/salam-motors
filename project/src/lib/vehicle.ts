import { supabase } from "./supabase";
import { generateSlug } from "./calc";
import { nextStockNumber } from "./queries";
import { syncVehicleAlerts } from "./compliance";
import { normalizeRegistration, normalizeUpperCase } from "./vehicleForm";
import type { Vehicle } from "./types";

export interface CreateVehicleInput {
  registration_number: string;
  category: string;
  manufacturer: string;
  brand: string;
  model: string;
  variant: string;
  fuel_type: string;
  colour: string;
  manufacture_year: string;
  registration_date: string;
  chassis_number: string;
  engine_number: string;
  odometer: string;
  owner_count: string;
  registration_city: string;
  registration_state: string;
  current_location: string;
  asking_price: string;
  minimum_price: string;
  notes: string;
  seller_party_id: string;
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  payment_proof_paths: string[];
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
}

/**
 * Creates a vehicle with its purchase, purchase payment, optional listing, and audit log
 * in one rollback-protected sequence. Shared by the desktop Add Vehicle form and the
 * mobile Add/Edit form so both surfaces stay consistent with the real schema.
 */
export async function createVehicle(input: CreateVehicleInput, performedBy: string): Promise<Vehicle> {
  if (!input.seller_party_id) throw new Error("No seller selected");

  let vehicleId: string | null = null;
  let statusHistoryId: string | null = null;
  let purchaseId: string | null = null;
  let purchasePaymentId: string | null = null;
  let listingId: string | null = null;

  const rollback = async () => {
    try {
      if (listingId) await supabase.from("listings").delete().eq("id", listingId);
      if (purchasePaymentId) await supabase.from("purchase_payments").delete().eq("id", purchasePaymentId);
      if (purchaseId) await supabase.from("purchases").delete().eq("id", purchaseId);
      if (statusHistoryId) await supabase.from("vehicle_status_history").delete().eq("id", statusHistoryId);
      if (vehicleId) await supabase.from("vehicles").delete().eq("id", vehicleId);
    } catch {
      // best-effort cleanup; the original error is what gets surfaced to the caller
    }
  };

  try {
    const stockNumber = await nextStockNumber();
    const year = Number(input.manufacture_year) || null;
    const askingPrice = Number(input.asking_price) || 0;
    const minimumPrice = Number(input.minimum_price) || null;

    const { data: vehicle, error: vehErr } = await supabase
      .from("vehicles")
      .insert({
        stock_number: stockNumber,
        registration_number: normalizeRegistration(input.registration_number.trim()),
        category: input.category,
        manufacturer: normalizeUpperCase(input.manufacturer),
        brand: input.brand || normalizeUpperCase(input.manufacturer),
        model: normalizeUpperCase(input.model),
        variant: input.variant || null,
        fuel_type: input.fuel_type,
        colour: input.colour || null,
        manufacture_year: year,
        registration_date: input.registration_date || null,
        chassis_number: input.chassis_number || null,
        engine_number: input.engine_number || null,
        odometer: input.odometer ? Number(input.odometer) : null,
        owner_count: Number(input.owner_count) || 1,
        registration_city: input.registration_city || null,
        registration_state: input.registration_state || null,
        current_location: input.current_location || null,
        current_status: "PURCHASED",
        asking_price: askingPrice || null,
        minimum_price: minimumPrice,
        notes: input.notes || null,
      })
      .select()
      .single();
    if (vehErr) throw vehErr;
    const v = vehicle as Vehicle;
    vehicleId = v.id;

    const { data: history, error: histErr } = await supabase.from("vehicle_status_history").insert({
      vehicle_id: v.id,
      previous_status: "DRAFT",
      new_status: "PURCHASED",
      reason: "Vehicle onboarded",
    }).select().single();
    if (histErr) throw histErr;
    statusHistoryId = history.id;

    const { data: purchase, error: purErr } = await supabase
      .from("purchases")
      .insert({
        vehicle_id: v.id,
        seller_party_id: input.seller_party_id,
        purchase_date: new Date().toISOString(),
        agreed_price: Number(input.purchase_price),
        broker_commission: Number(input.broker_commission) || 0,
        other_fee: Number(input.other_fee) || 0,
        payment_status: "Paid",
        handover_location: input.handover_location || null,
        odometer_at_purchase: input.odometer_at_purchase ? Number(input.odometer_at_purchase) : null,
        keys_received: input.keys_received,
        documents_received: input.documents_received,
        notes: input.notes || null,
      })
      .select()
      .single();
    if (purErr) throw purErr;
    purchaseId = purchase.id;

    const { data: purchasePayment, error: payErr } = await supabase.from("purchase_payments").insert({
      purchase_id: purchase.id,
      amount: Number(input.purchase_price) + Number(input.broker_commission || 0) + Number(input.other_fee || 0),
      payment_method: input.payment_method,
      reference: input.payment_reference || null,
      proof_urls: input.payment_proof_paths.length ? input.payment_proof_paths : null,
      paid_at: new Date().toISOString(),
    }).select().single();
    if (payErr) throw payErr;
    purchasePaymentId = purchasePayment.id;

    if (askingPrice > 0) {
      const slugBase = `${input.manufacturer}-${input.model}-${input.manufacture_year}-${input.registration_number}`.toLowerCase();
      const { data: listing, error: listErr } = await supabase.from("listings").insert({
        vehicle_id: v.id,
        asking_price: askingPrice,
        minimum_price: minimumPrice,
        status: "Draft",
        description: `${input.manufacture_year} ${input.manufacturer} ${input.model}. ${input.odometer} km.`,
        public_slug: generateSlug(slugBase) + "-" + v.id.slice(0, 6),
      }).select().single();
      if (listErr) throw listErr;
      listingId = listing.id;
    }

    const { error: auditErr } = await supabase.from("audit_logs").insert({
      entity_type: "vehicle",
      entity_id: v.id,
      action: "created",
      performed_by: performedBy,
      reason: `Onboarded ${stockNumber}: ${input.manufacturer} ${input.model}`,
    });
    if (auditErr) throw auditErr;

    syncVehicleAlerts(v.id).catch(() => {});

    return v;
  } catch (e) {
    await rollback();
    throw e;
  }
}
