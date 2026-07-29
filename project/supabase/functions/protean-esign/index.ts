// eSign / eStamp for vehicle sale documents (Task 7), on top of the shared
// Protean client (_shared/protean/client.ts). One POST route, dispatched by
// an `action` field, following the same "one route, action-dispatched"
// shape as assistant-turn/index.ts.
//
// Auth: caller-scoped Supabase client (forwarded Authorization header, RLS
// stays in force for every table read/write here) + an explicit
// `requireOrgStaff` check, same dual-layer pattern invite-team-member/
// index.ts uses (function-level role check backed by RLS as the real
// boundary). Only owner/manager/sales_executive may initiate — this spends
// money (stamp duty) and creates legally consequential documents.
//
// Status updates: `esign_status` re-polls Protean and writes the result
// back. Full completion may also arrive asynchronously via
// protean-webhook/index.ts (service-role, no user session) if Protean's
// real product uses a webhook callback rather than pure polling — both
// paths update the same row, keyed by protean_reference_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireOrgStaff } from "../_shared/protean/auth.ts";
import { ProteanClient } from "../_shared/protean/client.ts";
import { loadProteanConfig } from "../_shared/protean/config.ts";
import {
  jsonResponse,
  PROTEAN_CORS_HEADERS,
  ProteanHttpError,
  toPublicError,
} from "../_shared/protean/http.ts";

const ALLOWED_ROLES = ["owner", "manager", "sales_executive"] as const;

interface RequestBody {
  action?: "initiate_esign" | "esign_status" | "initiate_estamp";
  org_id?: string;
  vehicle_id?: string;
  sale_id?: string;
  document_label?: string;
  signers?: { name: string; mobile?: string; email?: string }[];
  redirect_url?: string;
  // estamp-only
  stamp_duty_amount?: number;
  state_code?: string;
  first_party_name?: string;
  second_party_name?: string;
  article_type?: string;
  // esign_status
  request_id?: string;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProteanHttpError(400, "INVALID_REQUEST", `${field} is required.`);
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: PROTEAN_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported.", retryable: false } },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      throw new ProteanHttpError(503, "FUNCTION_NOT_CONFIGURED", "This function is not configured.");
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new ProteanHttpError(401, "AUTH_REQUIRED", "Sign in to use this feature.");
    }

    const body = await req.json() as RequestBody;
    const action = body.action;
    if (action !== "initiate_esign" && action !== "esign_status" && action !== "initiate_estamp") {
      throw new ProteanHttpError(400, "INVALID_ACTION", "action must be one of initiate_esign, esign_status, initiate_estamp.");
    }
    const orgId = requireString(body.org_id, "org_id");

    // Caller-scoped client: RLS stays in force on every table touch below.
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const staff = await requireOrgStaff(client, orgId, ALLOWED_ROLES);
    const proteanClient = new ProteanClient(loadProteanConfig());

    if (action === "esign_status") {
      const requestId = requireString(body.request_id, "request_id");
      const { data: existing, error: fetchError } = await client
        .from("protean_document_requests")
        .select("id, org_id, protean_reference_id, status, request_type")
        .eq("id", requestId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (fetchError || !existing) {
        throw new ProteanHttpError(404, "REQUEST_NOT_FOUND", "That eSign request was not found.");
      }
      if (existing.request_type !== "esign") {
        throw new ProteanHttpError(400, "INVALID_REQUEST", "That request is not an eSign request.");
      }
      if (!existing.protean_reference_id) {
        throw new ProteanHttpError(409, "REQUEST_NOT_INITIATED", "This request has no Protean reference yet.");
      }

      let statusResponse;
      try {
        statusResponse = await proteanClient.getESignStatus(existing.protean_reference_id);
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

      const { data: updated, error: updateError } = await client
        .from("protean_document_requests")
        .update({
          status: statusResponse.status,
          document_url: statusResponse.signedDocumentUrl ?? null,
          completed_at: statusResponse.status === "completed" ? (statusResponse.signedAt ?? new Date().toISOString()) : null,
          response_payload: statusResponse,
          error_code: statusResponse.errorCode ?? null,
          error_message: statusResponse.errorMessage ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();
      if (updateError) {
        throw new ProteanHttpError(500, "STATUS_UPDATE_FAILED", "Could not save the updated eSign status.");
      }
      return jsonResponse({ request: updated });
    }

    // initiate_esign / initiate_estamp
    const documentLabel = requireString(body.document_label, "document_label");
    const requestType = action === "initiate_esign" ? "esign" : "estamp";

    const { data: created, error: insertError } = await client
      .from("protean_document_requests")
      .insert({
        org_id: orgId,
        vehicle_id: body.vehicle_id ?? null,
        sale_id: body.sale_id ?? null,
        request_type: requestType,
        status: "initiated",
        document_label: documentLabel,
        signer_details: action === "initiate_esign" ? { signers: body.signers ?? [] } : {},
        stamp_duty_amount: action === "initiate_estamp" ? (body.stamp_duty_amount ?? null) : null,
        initiated_by: staff.userId,
      })
      .select()
      .single();
    if (insertError || !created) {
      throw new ProteanHttpError(500, "REQUEST_CREATE_FAILED", "Could not create the request record.");
    }

    try {
      if (action === "initiate_esign") {
        const signers = Array.isArray(body.signers) ? body.signers : [];
        if (signers.length === 0) {
          throw new ProteanHttpError(400, "INVALID_REQUEST", "At least one signer is required.");
        }
        const response = await proteanClient.initiateESign({
          referenceId: created.id,
          documentLabel,
          signers,
          redirectUrl: body.redirect_url,
        });
        const { data: updated } = await client
          .from("protean_document_requests")
          .update({
            protean_reference_id: response.referenceId,
            status: response.status,
            response_payload: response,
            updated_at: new Date().toISOString(),
          })
          .eq("id", created.id)
          .select()
          .single();
        return jsonResponse({ request: updated ?? created, signUrl: response.signUrl });
      }

      // initiate_estamp
      const stampDutyAmount = body.stamp_duty_amount;
      const stateCode = requireString(body.state_code, "state_code");
      const firstPartyName = requireString(body.first_party_name, "first_party_name");
      const secondPartyName = requireString(body.second_party_name, "second_party_name");
      if (typeof stampDutyAmount !== "number" || stampDutyAmount < 0) {
        throw new ProteanHttpError(400, "INVALID_REQUEST", "stamp_duty_amount must be a non-negative number.");
      }
      const response = await proteanClient.initiateEStamp({
        referenceId: created.id,
        documentLabel,
        stampDutyAmount,
        stateCode,
        firstPartyName,
        secondPartyName,
        articleType: body.article_type,
      });
      const { data: updated } = await client
        .from("protean_document_requests")
        .update({
          protean_reference_id: response.referenceId,
          status: response.status,
          document_url: response.certificateUrl ?? null,
          response_payload: response,
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.id)
        .select()
        .single();
      return jsonResponse({ request: updated ?? created });
    } catch (error) {
      // Best-effort: record the failure on the row we already created so it
      // doesn't sit silently stuck at "initiated" with no Protean reference.
      const publicError = toPublicError(error);
      await client.from("protean_document_requests").update({
        status: "failed",
        error_code: publicError.body.error.code,
        error_message: publicError.body.error.message,
        updated_at: new Date().toISOString(),
      }).eq("id", created.id);
      throw error;
    }
  } catch (error) {
    const { status, body: errorBody } = toPublicError(error);
    return jsonResponse(errorBody, status);
  }
});
