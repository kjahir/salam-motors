// Razorpay signature verification.
//
// Two DIFFERENT signatures exist and they are not interchangeable:
//
//  1. Webhook signature - header `x-razorpay-signature`, computed as
//     HMAC-SHA256(raw_request_body, RAZORPAY_WEBHOOK_SECRET), hex.
//     Must be computed over the EXACT bytes received. Re-serializing the
//     parsed JSON (JSON.stringify(await req.json())) will not reproduce
//     Razorpay's byte order/spacing and the signature will not match, so
//     callers must pass the raw text.
//
//  2. Checkout handshake signature - returned to the browser after a
//     subscription is authorized, computed as
//     HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id,
//     RAZORPAY_KEY_SECRET), hex.
//     Note the operand ORDER is payment_id|subscription_id, which is the
//     reverse of the one-time-payment flow's order_id|payment_id - getting
//     this backwards silently rejects every genuine payment.
//
// Neither of these is authorization on its own; both only prove the
// message came from Razorpay.

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Length-independent constant-time-ish comparison. Compares every byte
 * regardless of mismatch position so a caller cannot learn the expected
 * signature one character at a time from response timing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Verifies an inbound webhook. `rawBody` MUST be the unparsed request text. */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | null,
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return timingSafeEqual(expected, signatureHeader.trim().toLowerCase());
}

/** Verifies the browser-side subscription authorization handshake. */
export async function verifySubscriptionPaymentSignature(
  params: {
    razorpayPaymentId: string;
    razorpaySubscriptionId: string;
    razorpaySignature: string;
  },
  keySecret: string | null,
): Promise<boolean> {
  if (!keySecret) return false;
  const expected = await hmacSha256Hex(
    keySecret,
    `${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`,
  );
  return timingSafeEqual(expected, params.razorpaySignature.trim().toLowerCase());
}
