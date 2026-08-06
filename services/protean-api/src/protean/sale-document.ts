// Turns a recorded sale into a stored, signable sale agreement.
//
// Sits between the sale tables and agreement.ts: reads the sale and everything it refers
// to through the caller's own client (so RLS decides what the caller may see), renders the
// PDF, and files it against the vehicle like any other document.
//
// ## Why the write half uses the service role
// Reads here are caller-scoped on purpose. The two writes — the storage object and the
// `vehicle_documents` row — are not, and that is deliberate rather than convenient:
//
//   `protean_document_requests` grants insert to owner/manager/sales_executive, because
//   initiating a signature is a sales action. `vehicle_documents` and the
//   `vehicle-documents` bucket grant writes to owner/manager/mechanic_inspector, because
//   uploading paperwork is an inspection-side action. A sales executive sits in the first
//   set and not the second, so a caller-scoped upload would fail for exactly the role this
//   feature is for.
//
// Widening the document-write policies to include sales staff would hand them every
// document on every vehicle, which is a much larger grant than "may file the agreement the
// server just generated for a sale they are allowed to make". So the write runs as the
// service role, narrowly: the caller's org membership and role are verified before this is
// called, the content is server-generated rather than caller-supplied, and every path and
// foreign key below is derived from the sale row rather than from the request body.

import { renderAgreementPdf, type SaleAgreementInput } from "./agreement.ts";
import { ProteanHttpError } from "./http.ts";
import type { SupabaseClientLike } from "../auth.ts";
import type { SignerInput } from "./esign-request.ts";

const BUCKET = "vehicle-documents";

export interface PreparedAgreement {
  /** Storage path inside the vehicle-documents bucket. */
  path: string;
  /** The `vehicle_documents` row this was filed as. */
  documentId: string;
  documentLabel: string;
  pdf: Uint8Array;
  vehicleId: string;
  /** Sale price + buyer charges - discount. The eStamp's consideration price. */
  netPayable: number;
  /** Buyer first: Protean sends the signing link to signers in order. */
  signers: { name: string; mobile?: string; email?: string }[];
  /** Both party names, in eStamp's first/second order (seller, then buyer). */
  parties: { first: string; second: string };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function vehicleDescription(vehicle: Record<string, unknown>): string {
  const parts = [
    vehicle.manufacture_year,
    text(vehicle.manufacturer) ?? text(vehicle.brand),
    text(vehicle.model),
    text(vehicle.variant),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (text(vehicle.registration_number) ?? "Vehicle");
}

/**
 * Everything the agreement needs, read as the caller.
 *
 * A caller who cannot see the sale gets the same "not found" a missing sale would give —
 * RLS is the boundary, and this must not become a way to confirm that a row exists.
 */
async function loadSaleContext(client: SupabaseClientLike, orgId: string, saleId: string) {
  const { data: sale } = await client
    .from("sales")
    .select(
      "id, vehicle_id, buyer_party_id, sale_date, sale_price, discount, buyer_charges, payment_status, delivery_status, delivery_location, notes",
    )
    .eq("id", saleId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!sale) {
    throw new ProteanHttpError(404, "SALE_NOT_FOUND", "That sale was not found.");
  }

  const { data: vehicle } = await client
    .from("vehicles")
    .select(
      "id, stock_number, registration_number, manufacturer, brand, model, variant, manufacture_year, odometer, chassis_number, engine_number",
    )
    .eq("id", sale.vehicle_id)
    .maybeSingle();
  if (!vehicle) {
    throw new ProteanHttpError(404, "VEHICLE_NOT_FOUND", "The vehicle for that sale was not found.");
  }

  const [buyerResult, paymentResult, organizationResult, settingsResult] = await Promise.all([
    sale.buyer_party_id
      ? client
        .from("parties")
        .select("full_name, mobile, email, address, city, state, postal_code")
        .eq("id", sale.buyer_party_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from("sale_payments")
      .select("payment_method")
      .eq("sale_id", saleId)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    client
      .from("app_settings")
      .select("whatsapp_business_number, website_url")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  return {
    sale,
    vehicle,
    buyer: buyerResult.data as Record<string, unknown> | null,
    payment: paymentResult.data as Record<string, unknown> | null,
    organization: organizationResult.data as Record<string, unknown> | null,
    settings: settingsResult.data as Record<string, unknown> | null,
  };
}

function buyerAddress(buyer: Record<string, unknown> | null): string | null {
  if (!buyer) return null;
  const parts = [buyer.address, buyer.city, buyer.state, buyer.postal_code]
    .map(text)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Builds the agreement PDF, stores it, and files it as a vehicle document.
 *
 * `signerOverrides` exists because the buyer's party record often has no mobile number,
 * and Protean needs somewhere to send the signing link — the UI collects it at send time
 * rather than making the dealer go and edit the party first.
 */
export async function prepareSaleAgreement(
  client: SupabaseClientLike,
  admin: SupabaseClientLike,
  options: {
    orgId: string;
    saleId: string;
    reference: string;
    dealerEmail?: string | null;
    /**
     * Contact details as edited on the sale screen. Typed as the request builder's signer
     * so the caller passes one list to both; only the contact fields matter here, the
     * identity ones are for the eStamp payload.
     */
    signerOverrides?: Partial<SignerInput>[];
  },
): Promise<PreparedAgreement> {
  const { sale, vehicle, buyer, payment, organization, settings } = await loadSaleContext(
    client,
    options.orgId,
    options.saleId,
  );

  const dealerName = text(organization?.name) ?? "This dealership";
  const buyerName = text(buyer?.full_name) ?? "Buyer";
  const netPayable = numeric(sale.sale_price) + numeric(sale.buyer_charges) -
    numeric(sale.discount);

  const input: SaleAgreementInput = {
    reference: options.reference,
    generatedAt: new Date().toISOString(),
    dealer: {
      name: dealerName,
      mobile: text(settings?.whatsapp_business_number),
      email: options.dealerEmail ?? null,
      // The app holds no registered address for the dealership — organizations has only a
      // name, and app_settings only contact handles. Left blank rather than filled with
      // the website, which is not an address.
      address: null,
    },
    buyer: {
      name: buyerName,
      mobile: text(buyer?.mobile),
      email: text(buyer?.email),
      address: buyerAddress(buyer),
    },
    vehicle: {
      description: vehicleDescription(vehicle),
      registrationNumber: text(vehicle.registration_number),
      stockNumber: text(vehicle.stock_number),
      chassisNumber: text(vehicle.chassis_number),
      engineNumber: text(vehicle.engine_number),
      odometer: typeof vehicle.odometer === "number" ? vehicle.odometer : null,
      manufactureYear: typeof vehicle.manufacture_year === "number" ? vehicle.manufacture_year : null,
    },
    sale: {
      saleDate: text(sale.sale_date) ?? new Date().toISOString(),
      salePrice: numeric(sale.sale_price),
      discount: numeric(sale.discount),
      buyerCharges: numeric(sale.buyer_charges),
      netPayable,
      paymentMethod: text(payment?.payment_method),
      paymentStatus: text(sale.payment_status),
      deliveryStatus: text(sale.delivery_status),
      deliveryLocation: text(sale.delivery_location),
      notes: text(sale.notes),
    },
  };

  const pdf = renderAgreementPdf(input);
  const documentLabel = `Sale agreement — ${
    text(vehicle.registration_number) ?? text(vehicle.stock_number) ?? dealerName
  }`;

  /*
   * One agreement per sale, until one of them has been signed.
   *
   * Regenerating is a normal thing to do — the dealer previews, spots a wrong delivery
   * location, fixes the sale, and generates again — and each of those should replace the
   * last rather than leave the vehicle carrying five near-identical "Sale agreement"
   * documents. So the path is keyed by the sale and the upload replaces in place.
   *
   * Once a signature has completed, that stops being true: the stored file is the exact
   * document the buyer was shown, and overwriting it would silently rewrite the past. From
   * then on a regeneration lands beside it under its own timestamped name.
   */
  const { data: signed } = await client
    .from("protean_document_requests")
    .select("id")
    .eq("sale_id", options.saleId)
    .eq("request_type", "esign")
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  const fileName = signed ? `${options.saleId}-${Date.now()}` : options.saleId;
  const path = `${options.orgId}/${vehicle.id}/sale-agreements/${fileName}.pdf`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    // Regenerating after the sale is corrected should replace the file rather than leave
    // two agreements on the vehicle, since the request row keeps the history either way.
    upsert: true,
  });
  if (uploadError) {
    console.error("prepareSaleAgreement: upload failed", uploadError);
    throw new ProteanHttpError(
      500,
      "AGREEMENT_UPLOAD_FAILED",
      "The agreement was generated but could not be stored.",
    );
  }

  // Filed as an ordinary vehicle document so it shows up in the Documents tab and counts
  // for the "Sale agreement" compliance rule, exactly as a manually uploaded one would.
  // Left unverified: a human still has to look at it before it counts as checked.
  //
  // Matched on the path, so a regeneration that replaced the file in place updates the
  // row it already has rather than filing a second one for the same document.
  const { data: existing } = await admin
    .from("vehicle_documents")
    .select("id")
    .eq("vehicle_id", vehicle.id)
    .eq("file_url", path)
    .is("deleted_at", null)
    .maybeSingle();

  const documentValues = {
    org_id: options.orgId,
    vehicle_id: vehicle.id,
    document_type: "Sale agreement",
    verification_status: "Uploaded",
    file_url: path,
    file_urls: [path],
    notes: `Generated from the sale record on ${new Date().toISOString().slice(0, 10)}.`,
  };
  const { data: document, error: documentError } = existing
    ? await admin
      .from("vehicle_documents")
      .update(documentValues)
      .eq("id", existing.id)
      .select("id")
      .single()
    : await admin
      .from("vehicle_documents")
      .insert(documentValues)
      .select("id")
      .single();
  if (documentError || !document) {
    console.error("prepareSaleAgreement: document row write failed", documentError);
    throw new ProteanHttpError(
      500,
      "AGREEMENT_RECORD_FAILED",
      "The agreement was stored but could not be filed against the vehicle.",
    );
  }

  const overrides = options.signerOverrides ?? [];
  const signers = [
    {
      name: text(overrides[0]?.name) ?? buyerName,
      mobile: text(overrides[0]?.mobile) ?? text(buyer?.mobile) ?? undefined,
      email: text(overrides[0]?.email) ?? text(buyer?.email) ?? undefined,
    },
    {
      name: text(overrides[1]?.name) ?? dealerName,
      mobile: text(overrides[1]?.mobile) ?? text(settings?.whatsapp_business_number) ?? undefined,
      email: text(overrides[1]?.email) ?? options.dealerEmail ?? undefined,
    },
  ].map((signer) => ({
    name: signer.name,
    ...(signer.mobile ? { mobile: signer.mobile } : {}),
    ...(signer.email ? { email: signer.email } : {}),
  }));

  return {
    path,
    documentId: document.id as string,
    documentLabel,
    pdf,
    vehicleId: vehicle.id as string,
    netPayable,
    signers,
    parties: { first: dealerName, second: buyerName },
  };
}
