// Inbound eSign Pro callbacks (guide §9.1).
//
// Protean's servers call this, not the browser, so there is no user session: the caller is
// authenticated purely by the HMAC-SHA256 signature in the `x-signature` header, checked
// against the salt configured under Settings → eSign → Webhook, and the row is then
// updated with the service role.
//
// ## Two details of the vendor contract that shape this file
// 1. eSign callbacks carry no referenceId (only eMandate ones do), so `documentId` is the
//    single link back to our row — it is stored as `protean_reference_id`.
// 2. `Signed` fires per recipient, not per document. On a two-signer agreement the first
//    Signed event arrives while the buyer still has not signed, so completion is decided
//    by every recipient in the payload being Signed, not by the event name alone.
//
// The callback URL registered with Protean must point at this service, not at Supabase.

import { loadProteanConfig, usableWebhookSecret } from "../protean/config.ts";
import { jsonResponse } from "../protean/http.ts";
import {
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "../protean/signing.ts";
import {
  allRecipientsSigned,
  failureReason,
  requestStatusFromWebhook,
} from "../protean/status-map.ts";
import type { ProteanWebhookPayload } from "../protean/types.ts";
import { adminClient } from "../supabase.ts";
import type { ServiceConfig } from "../config.ts";

export async function handleWebhook(
  config: ServiceConfig,
  request: Request,
): Promise<Response> {
  const webhookSecret = usableWebhookSecret(loadProteanConfig());
  if (!webhookSecret) {
    console.error("webhook: PROTEAN_WEBHOOK_SECRET is unset or too short; rejecting all calls");
    return jsonResponse(
      { error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook verification is not configured." } },
      503,
    );
  }

  const rawBody = await request.text();
  const verified = await verifyWebhookSignature({
    secret: webhookSecret,
    rawBody,
    signatureHeader: request.headers.get(WEBHOOK_SIGNATURE_HEADER),
  });
  if (!verified) {
    console.error("webhook: signature verification failed");
    return jsonResponse(
      { error: { code: "INVALID_SIGNATURE", message: "Signature verification failed." } },
      401,
    );
  }

  let payload: ProteanWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ProteanWebhookPayload;
  } catch {
    return jsonResponse(
      { error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." } },
      400,
    );
  }
  if (!payload.documentId || !payload.webhookEventType) {
    return jsonResponse(
      { error: { code: "INVALID_PAYLOAD", message: "documentId and webhookEventType are required." } },
      400,
    );
  }

  const recipients = payload.recipientData ?? payload.recipentlistData;
  let status = requestStatusFromWebhook(payload.webhookEventType);
  // A per-recipient Signed event is not the document being done — hold at pending until
  // everyone has signed, or the dealer sees "signed" on a half-signed agreement.
  if (status === "completed" && !allRecipientsSigned(recipients)) status = "pending";

  const problem = payload.rejectedRecipientData ?? payload.failedRecipientData;
  const reason = failureReason(payload.webhookEventType, problem);

  const admin = adminClient(config);
  const { data: updated, error } = await admin
    .from("protean_document_requests")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      error_message: reason,
      response_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("protean_reference_id", payload.documentId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("webhook: failed to update request", error);
    return jsonResponse(
      { error: { code: "WEBHOOK_UPDATE_FAILED", message: "Could not apply the webhook update." } },
      500,
    );
  }
  if (!updated) {
    // Not our error — Protean called back about a document we do not recognize.
    // Acknowledge with 200 so it stops retrying, but log loudly: it most likely means a
    // documentId was not stored when the document was created.
    console.error("webhook: no matching request for documentId", payload.documentId);
  }

  return jsonResponse({ ok: true });
}
