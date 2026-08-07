// Razorpay subscription webhook receiver - the ONLY thing in this system
// that may change an org's billing access.
//
// DEPLOYMENT: must be deployed with `--no-verify-jwt`. Razorpay is not a
// Supabase user and sends no JWT; authenticity comes entirely from the
// `x-razorpay-signature` HMAC over the raw body. This is exactly why the
// signature check below fails CLOSED when RAZORPAY_WEBHOOK_SECRET is
// unset - an unauthenticated public endpoint that trusted its body could
// be used by anyone to mark any org as paid.
//
// Idempotency: Razorpay retries on any non-2xx response, and at-least-once
// delivery means duplicates are normal, not exceptional. `billing_events`
// has UNIQUE(razorpay_event_id); a duplicate insert is detected and the
// handler returns 200 without re-applying the state change, so a redelivered
// `subscription.charged` cannot extend a billing period twice.
//
// Response policy: 200 for anything successfully recorded (including
// events we intentionally ignore), 400 for a bad/unsigned request. We
// return 200 rather than 500 once an event is safely persisted, because
// making Razorpay retry an event we already have adds no value.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canVerifyWebhooks, loadRazorpayConfig } from "../_shared/razorpay/config.ts";
import { verifyWebhookSignature } from "../_shared/razorpay/signature.ts";
import { isHandledEvent, mapRazorpayStatus } from "../_shared/razorpay/status-map.ts";

// Days of full access after a failed renewal, while Razorpay retries the
// mandate. Settled with the user: a failed UPI mandate should not read as
// a lockout. The twin of this constant is the 14-day trial length, which
// lives in start_org_trial() in the billing migration.
const GRACE_PERIOD_DAYS = 7;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Razorpay sends epoch SECONDS; Postgres wants an ISO timestamp. */
function epochToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const config = loadRazorpayConfig();

  // Read the RAW text. Parsing and re-serializing would not reproduce
  // Razorpay's exact bytes and every signature would fail to match.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!canVerifyWebhooks(config)) {
    // Fail closed. Never process an unverifiable billing event.
    console.error("billing-webhook: RAZORPAY_WEBHOOK_SECRET is not set; rejecting webhook");
    return json({ error: "Webhook verification is not configured" }, 503);
  }

  const verified = await verifyWebhookSignature(rawBody, signature, config.webhookSecret);
  if (!verified) {
    console.error("billing-webhook: signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: {
    event?: string;
    payload?: {
      subscription?: { entity?: Record<string, unknown> };
      payment?: { entity?: Record<string, unknown> };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Malformed JSON body" }, 400);
  }

  const eventType = event.event ?? "unknown";
  // Razorpay's own event id header is the idempotency key. Fall back to a
  // deterministic composite only if the header is absent, so a retry of
  // the same event still collides rather than being applied twice.
  const subscriptionEntity = event.payload?.subscription?.entity ?? {};
  const paymentEntity = event.payload?.payment?.entity ?? {};
  const razorpaySubscriptionId = (subscriptionEntity.id as string | undefined) ?? null;
  const razorpayPaymentId = (paymentEntity.id as string | undefined) ?? null;
  const eventId =
    req.headers.get("x-razorpay-event-id") ??
    `${eventType}:${razorpaySubscriptionId ?? "none"}:${razorpayPaymentId ?? "none"}`;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve the org from OUR record of the subscription id, never from the
  // `notes.org_id` in the payload. Notes are set by us at creation time and
  // are convenient for humans reconciling in the Razorpay dashboard, but
  // resolving access off a value carried in the request body would make the
  // signature the only thing standing between an attacker and any org.
  let orgId: string | null = null;
  let existing: { org_id: string; status: string; billing_cycle: string | null } | null = null;
  if (razorpaySubscriptionId) {
    const { data } = await admin
      .from("org_subscriptions")
      .select("org_id, status, billing_cycle")
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .maybeSingle();
    if (data) {
      existing = data;
      orgId = data.org_id;
    }
  }

  const amountPaise = typeof paymentEntity.amount === "number" ? paymentEntity.amount : null;

  // Persist FIRST, act second. If the state update below fails, the event
  // is still on record with an unprocessed marker rather than lost.
  const { error: insertErr } = await admin.from("billing_events").insert({
    razorpay_event_id: eventId,
    event_type: eventType,
    org_id: orgId,
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_payment_id: razorpayPaymentId,
    amount_paise: amountPaise,
    payload: event,
  });

  if (insertErr) {
    // 23505 = unique_violation on razorpay_event_id: this exact event has
    // already been recorded and applied. Acknowledge and stop - re-applying
    // is precisely what idempotency is meant to prevent.
    if ((insertErr as { code?: string }).code === "23505") {
      return json({ ok: true, duplicate: true, event: eventType });
    }
    console.error("billing-webhook: failed to record event", insertErr);
    return json({ error: "Could not record event" }, 500);
  }

  if (!isHandledEvent(eventType)) {
    await admin
      .from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("razorpay_event_id", eventId);
    return json({ ok: true, ignored: true, event: eventType });
  }

  if (!existing || !orgId) {
    // Signature was valid but the subscription is unknown to us - e.g. a
    // subscription created directly in the Razorpay dashboard. Recorded,
    // not applied, and flagged so it is visible rather than silent.
    await admin
      .from("billing_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: "No org_subscriptions row matches this razorpay_subscription_id",
      })
      .eq("razorpay_event_id", eventId);
    return json({ ok: true, unmatched: true, event: eventType });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const mappedStatus = mapRazorpayStatus(subscriptionEntity.status as string | undefined);

  const update: Record<string, unknown> = { updated_at: nowIso };

  // Period boundaries come from Razorpay's own view of the subscription,
  // never computed locally - Razorpay is the authority on what has been
  // paid for and until when.
  const currentStart = epochToIso(subscriptionEntity.current_start as number | undefined);
  const currentEnd = epochToIso(subscriptionEntity.current_end as number | undefined);
  if (currentStart) update.current_period_start = currentStart;
  if (currentEnd) update.current_period_end = currentEnd;

  if (mappedStatus) {
    update.status = mappedStatus;
  }

  switch (eventType) {
    case "subscription.charged": {
      // Money actually arrived. This is the only event that clears a
      // grace window and puts an org back to full paid access.
      update.status = "active";
      update.grace_ends_at = null;
      update.last_payment_error = null;
      update.last_payment_at = nowIso;
      // A successful charge after a cancellation request would be a
      // contradiction; trust the payment and clear the intent only if
      // Razorpay itself no longer reports a pending cancellation.
      if (subscriptionEntity.status === "active") {
        update.cancel_at_period_end = false;
      }
      break;
    }
    case "subscription.activated":
    case "subscription.resumed": {
      update.status = "active";
      update.grace_ends_at = null;
      break;
    }
    case "subscription.pending":
    case "subscription.paused": {
      // Renewal failed / suspended: open the grace window, but only if one
      // is not already running. Re-arming it on every retry notification
      // would let a non-paying org stay at full access indefinitely.
      update.status = "past_due";
      update.last_payment_error =
        (paymentEntity.error_description as string | undefined) ??
        "Razorpay could not collect the renewal payment.";
      if (existing.status !== "past_due") {
        update.grace_ends_at = new Date(
          now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();
      }
      break;
    }
    case "subscription.halted":
    case "subscription.completed": {
      // Razorpay has stopped retrying. Grace is over.
      update.status = "lapsed";
      update.grace_ends_at = null;
      break;
    }
    case "subscription.cancelled": {
      update.status = "cancelled";
      update.cancelled_at = nowIso;
      update.cancel_at_period_end = true;
      break;
    }
    case "subscription.updated": {
      // Status/period fields already applied above; nothing extra.
      break;
    }
  }

  const { error: updateErr } = await admin
    .from("org_subscriptions")
    .update(update)
    .eq("org_id", orgId);

  await admin
    .from("billing_events")
    .update({
      processed_at: nowIso,
      processing_error: updateErr ? `Failed to apply: ${updateErr.message}` : null,
      org_id: orgId,
    })
    .eq("razorpay_event_id", eventId);

  if (updateErr) {
    console.error("billing-webhook: failed to apply subscription update", updateErr);
    return json({ error: "Recorded but could not apply" }, 500);
  }

  return json({ ok: true, event: eventType, org_id: orgId, status: update.status ?? existing.status });
});
