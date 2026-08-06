// Inbound webhook signature verification (guide §9.3).
//
// Outbound request signing used to live here too. It no longer exists: e-Sign Pro
// authenticates with an `apikey` header, a bearer token, and login credentials in the
// body, and signs nothing. The HMAC canonical-string scheme this module used to implement
// was an educated guess made without the vendor guide, and has been deleted rather than
// left around to be called by mistake.
//
// What remains is the one place HMAC is genuinely used: verifying that an inbound callback
// really came from Protean. The vendor's reference implementation is
//
//     const expected = CryptoJS.HmacSHA256(JSON.stringify(req.body), SALT_KEY).toString(hex)
//     expected === req.headers['x-signature']
//
// — that is, the hash covers the *re-serialized* parsed body, not the bytes on the wire.
// For compact JSON the two are identical; for anything with whitespace they are not. We
// check the raw bytes first and fall back to a re-serialization, so a byte-exact sender
// and a pretty-printing one both verify, and neither is accepted without a valid hash.

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return toHex(signature);
}

/** Protean sends the hash in this header (guide §9.3). */
export const WEBHOOK_SIGNATURE_HEADER = "x-signature";

export async function verifyWebhookSignature(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<boolean> {
  if (!params.signatureHeader) return false;
  const provided = params.signatureHeader.trim().toLowerCase();

  const overRaw = await hmacSha256Hex(params.secret, params.rawBody);
  if (timingSafeEqual(overRaw, provided)) return true;

  // Re-serialize and try again, matching the vendor's JSON.stringify(req.body) sample.
  try {
    const reserialized = JSON.stringify(JSON.parse(params.rawBody));
    if (reserialized === params.rawBody) return false;
    const overParsed = await hmacSha256Hex(params.secret, reserialized);
    return timingSafeEqual(overParsed, provided);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
