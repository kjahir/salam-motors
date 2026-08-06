// Sale agreements: generate, stamp, and sign — on Protean e-Sign Pro.
//
// One POST route dispatched by an `action` field.
//
// ## Why this lives outside Supabase
// Protean requires calls to arrive from a known, dedicated IP address. Supabase Edge
// Functions egress from a shared pool with no stable address, so the Protean-facing code
// was carved out into this service, which runs inside a VPC behind a fixed IP. Nothing
// about the logic changed in the move: the caller is still authenticated by their Supabase
// JWT, reads still happen through a caller-scoped client so RLS applies, and the same
// dual-layer role check still gates every action.
//
// ## The shape of the vendor API decides the shape of this route
// e-Sign Pro's `/api/v1/masteresign` is a single call that takes the document, the eStamp,
// and every signer together, and returns one `documentId` that status, PDF retrieval,
// cancellation and webhooks are all keyed on (guide §4.3). There is therefore no separate
// "buy stamp paper" operation to expose: stamping is an option on sending.
//
//   prepare_sale_agreement — build the PDF from the sale, file it, return it. Never calls
//                            Protean, so it works before any credentials exist.
//   stamp_options          — the state list and article codes, for the stamping form.
//   initiate_esign         — masteresign, with stampData when the caller asks for a stamp.
//   esign_status           — re-poll document-status and write the result back.
//   cancel_esign           — cancel a document that is out for signature.
//
// Only owner/manager/sales_executive may act — this spends money and creates legally
// consequential documents. The one service-role use is storing the generated agreement;
// see protean/sale-document.ts for why that is not caller-scoped.

import { requireOrgStaff } from "../auth.ts";
import { ProteanClient } from "../protean/client.ts";
import { loadProteanConfig } from "../protean/config.ts";
import { jsonResponse, ProteanHttpError, toPublicError } from "../protean/http.ts";
import { toBase64 } from "../protean/agreement.ts";
import { prepareSaleAgreement } from "../protean/sale-document.ts";
import {
  buildMasterESignRequest,
  firstSigningUrl,
  type SignerInput,
  type StampInput,
} from "../protean/esign-request.ts";
import { requestStatusFromDocument } from "../protean/status-map.ts";
import { adminClient, callerClient } from "../supabase.ts";
import type { ServiceConfig } from "../config.ts";

const ALLOWED_ROLES = ["owner", "manager", "sales_executive"] as const;

type Action =
  | "prepare_sale_agreement"
  | "stamp_options"
  | "initiate_esign"
  | "esign_status"
  | "cancel_esign";

const ACTIONS: readonly Action[] = [
  "prepare_sale_agreement",
  "stamp_options",
  "initiate_esign",
  "esign_status",
  "cancel_esign",
];

export interface RequestBody {
  action?: Action;
  org_id?: string;
  sale_id?: string;
  request_id?: string;
  /** Buyer contact and identity, as edited on the sale screen. */
  signers?: SignerInput[];
  redirect_url?: string;
  feedback?: string;
  /** stamp_options only. */
  state_id?: number;
  /** initiate_esign only — omit for an unstamped signature. */
  stamp?: {
    state_id?: number;
    article_code?: string;
    stamp_amount?: number;
    paid_by?: "firstParty" | "secondParty";
    first_party_pin?: number;
    first_party_pan?: string;
    second_party_pin?: number;
    second_party_pan?: string;
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProteanHttpError(400, "INVALID_REQUEST", `${field} is required.`);
  }
  return value;
}

/**
 * Handles one eSign request.
 *
 * Throws `ProteanHttpError` for anything the caller should see; main.ts turns that into a
 * response, so every failure gets the same shape whichever action produced it.
 */
export async function handleESign(
  config: ServiceConfig,
  authorization: string,
  body: RequestBody,
): Promise<Response> {
  const action = body.action;
  if (!action || !ACTIONS.includes(action)) {
    throw new ProteanHttpError(400, "INVALID_ACTION", `action must be one of ${ACTIONS.join(", ")}.`);
  }
  const orgId = requireString(body.org_id, "org_id");

  const client = callerClient(config, authorization);
  const staff = await requireOrgStaff(client, orgId, ALLOWED_ROLES);
  const protean = new ProteanClient(loadProteanConfig());
  const admin = () => adminClient(config);

  // ---------------------------------------------------------------- preview
  if (action === "prepare_sale_agreement") {
    const saleId = requireString(body.sale_id, "sale_id");
    const agreement = await prepareSaleAgreement(client, admin(), {
      orgId,
      saleId,
      reference: saleId,
      dealerEmail: staff.email,
      signerOverrides: body.signers,
    });
    return jsonResponse({
      document: {
        path: agreement.path,
        documentId: agreement.documentId,
        label: agreement.documentLabel,
        vehicleId: agreement.vehicleId,
      },
      signers: agreement.signers,
      parties: agreement.parties,
    });
  }

  // --------------------------------------------------------- stamping form
  if (action === "stamp_options") {
    // Two round trips rather than one: article codes are per state, and the caller only
    // knows which state once the dealer has picked one from the first list.
    if (typeof body.state_id === "number") {
      const articles = await protean.articleCodesForEStamp(body.state_id);
      return jsonResponse({ articleCodes: articles.data?.articleCode ?? [] });
    }
    const states = await protean.stampStates();
    return jsonResponse({
      states: (states.data ?? []).filter((state) => state.stampType?.includes("e-Stamp")),
    });
  }

  // ------------------------------------------------------------- cancelling
  if (action === "cancel_esign") {
    const requestId = requireString(body.request_id, "request_id");
    const { data: existing } = await client
      .from("protean_document_requests")
      .select("id, protean_reference_id, status")
      .eq("id", requestId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!existing?.protean_reference_id) {
      throw new ProteanHttpError(404, "REQUEST_NOT_FOUND", "That signature request was not found.");
    }
    const feedback = (body.feedback ?? "Cancelled by the dealership.").slice(0, 250);
    await protean.cancelDocument(existing.protean_reference_id, feedback);
    const { data: updated } = await client
      .from("protean_document_requests")
      .update({
        status: "cancelled",
        error_message: feedback,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();
    return jsonResponse({ request: updated });
  }

  // ----------------------------------------------------------------- status
  if (action === "esign_status") {
    const requestId = requireString(body.request_id, "request_id");
    const { data: existing } = await client
      .from("protean_document_requests")
      .select("id, protean_reference_id, status, request_type")
      .eq("id", requestId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!existing) {
      throw new ProteanHttpError(404, "REQUEST_NOT_FOUND", "That signature request was not found.");
    }
    if (!existing.protean_reference_id) {
      throw new ProteanHttpError(409, "REQUEST_NOT_INITIATED", "This request never reached Protean.");
    }

    let document;
    try {
      const response = await protean.documentStatus(existing.protean_reference_id);
      document = response.data?.[0];
    } catch (error) {
      if (error instanceof ProteanHttpError) {
        await client.from("protean_document_requests").update({
          error_code: error.code,
          error_message: error.message,
          updated_at: new Date().toISOString(),
        }).eq("id", requestId);
      }
      throw error;
    }
    if (!document) {
      throw new ProteanHttpError(502, "PROTEAN_EMPTY_STATUS", "Protean returned no status for this document.");
    }

    const mapped = requestStatusFromDocument(document.status);
    // The signed PDF is fetched only on completion, and only then does document_url get
    // a value — a link to an unsigned draft would be worse than no link.
    let documentUrl: string | null = null;
    if (mapped === "completed") {
      try {
        const pdf = await protean.documentPdf(existing.protean_reference_id);
        const encoded = pdf.data?.[0]?.documentPdf;
        if (encoded) documentUrl = encoded;
      } catch (error) {
        console.error("protean-esign: signed PDF fetch failed", error);
      }
    }

    const { data: updated } = await client
      .from("protean_document_requests")
      .update({
        status: mapped,
        document_url: documentUrl,
        completed_at: mapped === "completed" ? new Date().toISOString() : null,
        response_payload: document,
        error_message: document.feedback ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();
    return jsonResponse({ request: updated, proteanStatus: document.status });
  }

  // --------------------------------------------------------------- sending
  const saleId = requireString(body.sale_id, "sale_id");
  const agreement = await prepareSaleAgreement(client, admin(), {
    orgId,
    saleId,
    reference: saleId,
    dealerEmail: staff.email,
    signerOverrides: body.signers,
  });

  const stampRequested = Boolean(body.stamp?.state_id && body.stamp?.article_code);
  const stamp: StampInput | null = stampRequested
    ? {
      stateId: Number(body.stamp?.state_id),
      articleCode: String(body.stamp?.article_code),
      stampAmount: Number(body.stamp?.stamp_amount ?? 0),
      considerationPrice: agreement.netPayable,
      paidBy: body.stamp?.paid_by ?? "firstParty",
      firstPartyName: agreement.parties.first,
      secondPartyName: agreement.parties.second,
      firstPartyPin: body.stamp?.first_party_pin ?? null,
      firstPartyPan: body.stamp?.first_party_pan ?? null,
      secondPartyPin: body.stamp?.second_party_pin ?? null,
      secondPartyPan: body.stamp?.second_party_pan ?? null,
    }
    : null;
  if (stamp && (!Number.isFinite(stamp.stampAmount) || stamp.stampAmount <= 0)) {
    throw new ProteanHttpError(400, "INVALID_REQUEST", "Enter the stamp duty amount.");
  }

  // Built before the row is written so a payload the guide would reject — an unusable
  // mobile number, a missing PAN on a stamped agreement — fails without leaving a
  // half-finished request behind.
  const esignRequest = buildMasterESignRequest({
    referenceId: saleId,
    documentName: agreement.documentLabel,
    pdfBase64: toBase64(agreement.pdf),
    signers: mergeSigners(agreement.signers, body.signers),
    successRedirectUrl: body.redirect_url,
    failedRedirectUrl: body.redirect_url,
    stamp,
    organizationRegType: protean.organizationRegType,
  });

  const { data: created, error: insertError } = await client
    .from("protean_document_requests")
    .insert({
      org_id: orgId,
      vehicle_id: agreement.vehicleId,
      sale_id: saleId,
      // Still 'esign' when stamped: with the single API there is no separate eStamp
      // request to track, and stamp_duty_amount records the stamping.
      request_type: "esign",
      status: "initiated",
      document_label: esignRequest.documentName,
      signer_details: { signers: esignRequest.recipientData },
      request_payload: {
        document_path: agreement.path,
        document_id: agreement.documentId,
        stamped: stampRequested,
        article_code: stamp?.articleCode ?? null,
      },
      stamp_duty_amount: stamp?.stampAmount ?? null,
      initiated_by: staff.userId,
    })
    .select()
    .single();
  if (insertError || !created) {
    throw new ProteanHttpError(500, "REQUEST_CREATE_FAILED", "Could not create the request record.");
  }

  try {
    const response = await protean.masterESign(esignRequest);
    const signUrl = firstSigningUrl(response.data?.redirectUrl);
    const { data: updated } = await client
      .from("protean_document_requests")
      .update({
        protean_reference_id: response.data?.documentId ?? null,
        // 5050 means it went to an approver rather than to the signers; either way
        // nothing is signed yet, so both land on `pending`.
        status: "pending",
        response_payload: response,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id)
      .select()
      .single();
    return jsonResponse({
      request: updated ?? created,
      signUrl,
      message: response.message,
      code: response.code,
    });
  } catch (error) {
    const publicError = toPublicError(error);
    await client.from("protean_document_requests").update({
      status: "failed",
      error_code: publicError.body.error.code,
      error_message: publicError.body.error.message,
      updated_at: new Date().toISOString(),
    }).eq("id", created.id);
    throw error;
  }
}

/**
 * Overlays what the dealer typed onto what the sale record already knows.
 *
 * The buyer's party row rarely carries a PAN or date of birth, and never carries them in
 * time for a first stamped agreement, so the sale screen collects them. Everything the
 * dealer left blank keeps its value from the record.
 */
function mergeSigners(
  derived: { name: string; mobile?: string; email?: string }[],
  supplied: SignerInput[] | undefined,
): SignerInput[] {
  return derived.map((signer, index) => {
    const override = supplied?.[index];
    return {
      name: override?.name?.trim() || signer.name,
      mobile: override?.mobile ?? signer.mobile ?? null,
      email: override?.email ?? signer.email ?? null,
      dob: override?.dob ?? null,
      legalConstitution: override?.legalConstitution ?? null,
      partyType: override?.partyType ?? null,
      relationshipToContract: override?.relationshipToContract ?? null,
      pan: override?.pan ?? null,
      ovdType: override?.ovdType ?? null,
      ovdNumber: override?.ovdNumber ?? null,
      customOvdType: override?.customOvdType ?? null,
    };
  });
}
