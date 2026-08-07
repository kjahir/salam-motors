import {
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
} from "./signature.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const WEBHOOK_SECRET = "whsec_test";
const BODY =
  '{"entity":"event","event":"subscription.charged","payload":{"subscription":{"entity":{"id":"sub_ABC123","status":"active"}}}}';

// A well-formed but WRONG signature: 64 hex chars that are not the HMAC of
// anything. Used only in the tests that assert rejection, so that a
// rejection cannot be explained away by a malformed input. The tests that
// assert acceptance derive the real signature at runtime instead (see the
// round-trip test) rather than hardcoding a digest.
const WRONG_SIGNATURE = "0".repeat(64);

Deno.test("verifyWebhookSignature rejects a missing signature header", async () => {
  const ok = await verifyWebhookSignature(BODY, null, WEBHOOK_SECRET);
  assert(!ok, "absent signature header must not verify");
});

Deno.test("verifyWebhookSignature fails closed when no webhook secret is configured", async () => {
  // The important case: an unconfigured environment must NOT accept
  // unsigned billing events, or anyone who can reach the URL could mark
  // any org as paid.
  const ok = await verifyWebhookSignature(BODY, WRONG_SIGNATURE, null);
  assert(!ok, "missing webhook secret must reject, never accept");
});

Deno.test("verifyWebhookSignature rejects a tampered body", async () => {
  const tampered = BODY.replace("sub_ABC123", "sub_ATTACKER");
  const ok = await verifyWebhookSignature(tampered, WRONG_SIGNATURE, WEBHOOK_SECRET);
  assert(!ok, "body tampering must invalidate the signature");
});

Deno.test("verifyWebhookSignature round-trips a signature it can reproduce", async () => {
  // Derive the expected signature the same way Razorpay would, then check
  // the verifier accepts it and rejects a one-character mutation.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(BODY));
  const signature = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  assert(
    await verifyWebhookSignature(BODY, signature, WEBHOOK_SECRET),
    "a correctly computed signature must verify",
  );
  assert(
    await verifyWebhookSignature(BODY, signature.toUpperCase(), WEBHOOK_SECRET),
    "hex case from the header must not matter",
  );

  const flipped = (signature[0] === "a" ? "b" : "a") + signature.slice(1);
  assert(
    !(await verifyWebhookSignature(BODY, flipped, WEBHOOK_SECRET)),
    "a single flipped hex character must invalidate",
  );
});

Deno.test("verifySubscriptionPaymentSignature uses payment_id|subscription_id order", async () => {
  const keySecret = "rzp_secret_test";
  const razorpayPaymentId = "pay_123";
  const razorpaySubscriptionId = "sub_456";

  async function hmac(message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const correct = await hmac(`${razorpayPaymentId}|${razorpaySubscriptionId}`);
  const reversed = await hmac(`${razorpaySubscriptionId}|${razorpayPaymentId}`);

  assert(
    await verifySubscriptionPaymentSignature(
      { razorpayPaymentId, razorpaySubscriptionId, razorpaySignature: correct },
      keySecret,
    ),
    "payment_id|subscription_id must verify",
  );

  // Guards the specific documented footgun: the one-time-payment flow
  // signs order_id|payment_id, and copying that order here would reject
  // every genuine subscription payment.
  assert(
    !(await verifySubscriptionPaymentSignature(
      { razorpayPaymentId, razorpaySubscriptionId, razorpaySignature: reversed },
      keySecret,
    )),
    "reversed operand order must NOT verify",
  );
});

Deno.test("verifySubscriptionPaymentSignature fails closed without a key secret", async () => {
  const ok = await verifySubscriptionPaymentSignature(
    { razorpayPaymentId: "pay_1", razorpaySubscriptionId: "sub_1", razorpaySignature: "anything" },
    null,
  );
  assert(!ok, "missing key secret must reject");
});
