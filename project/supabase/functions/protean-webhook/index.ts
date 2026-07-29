// Inbound webhook receiver for asynchronous eSign/eStamp completion
// callbacks from Protean's servers. No user session exists on this call
// path (Protean calls this, not our frontend), so unlike protean-esign and
// protean-lookup this uses the service-role client and authenticates the
// caller purely via HMAC signature (PROTEAN_WEBHOOK_SECRET), the same way
// most webhook receivers (Stripe, Razorpay, etc.) work.
//
// ============================================================================
// PLACEHOLDER — payload shape and signature header are NOT verified
// ============================================================================
// Whether Protean's real product calls back via webhook at all (vs. the
// caller always polling getESignStatus) is unconfirmed. This function is
// built defensively so that if it does, wiring it up is a matter of
// pointing Protean's dashboard at this URL and fixing the header name /
// payload shape below — not building new plumbing. See
// _shared/protean/signing.ts's verifyWebhookSignature() header comment for
// the same caveat on the signing scheme.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadProteanConfig, usableWebhookSecret } from "../_shared/protean/config.ts";
import { jsonResponse, PROTEAN_CORS_HEADERS } from "../_shared/protean/http.ts";
import { verifyWebhookSignature } from "../_shared/protean/signing.ts";
import type { ProteanWebhookPayload } from "../_shared/protean/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: PROTEAN_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported." } }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("protean-webhook: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured");
    return jsonResponse({ error: { code: "FUNCTION_NOT_CONFIGURED", message: "This function is not configured." } }, 503);
  }

  const config = loadProteanConfig();
  const webhookSecret = usableWebhookSecret(config);
  if (!webhookSecret) {
    console.error("protean-webhook: PROTEAN_WEBHOOK_SECRET is not set or too short; rejecting all webhook calls");
    return jsonResponse({ error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook verification is not configured." } }, 503);
  }

  const rawBody = await req.text();
  // Best-effort placeholder header name — see signing.ts / module header.
  const signatureHeader = req.headers.get("X-Protean-Signature");
  const verified = await verifyWebhookSignature({ secret: webhookSecret, rawBody, signatureHeader });
  if (!verified) {
    console.error("protean-webhook: signature verification failed");
    return jsonResponse({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed." } }, 401);
  }

  let payload: ProteanWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ProteanWebhookPayload;
  } catch {
    return jsonResponse({ error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." } }, 400);
  }
  if (!payload.referenceId || !payload.status) {
    return jsonResponse({ error: { code: "INVALID_PAYLOAD", message: "referenceId and status are required." } }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: updated, error } = await admin
    .from("protean_document_requests")
    .update({
      status: payload.status,
      document_url: payload.documentUrl ?? payload.certificateUrl ?? null,
      completed_at: (payload.status === "completed") ? (payload.occurredAt ?? new Date().toISOString()) : null,
      error_code: payload.errorCode ?? null,
      error_message: payload.errorMessage ?? null,
      response_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("protean_reference_id", payload.referenceId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("protean-webhook: failed to update request", error);
    return jsonResponse({ error: { code: "WEBHOOK_UPDATE_FAILED", message: "Could not apply the webhook update." } }, 500);
  }
  if (!updated) {
    // Not our error — Protean called back about a reference we don't
    // recognize. Acknowledge with 200 so Protean doesn't retry forever,
    // but log loudly since it likely means a reference-id mismatch bug.
    console.error("protean-webhook: no matching request for referenceId", payload.referenceId);
  }

  return jsonResponse({ ok: true });
});
