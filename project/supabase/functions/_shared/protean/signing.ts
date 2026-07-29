// ============================================================================
// PLACEHOLDER — request signing scheme not yet verified against real docs
// ============================================================================
// NSDL/Protean's eGov API family (eSign ASP integration, eStamp, and the
// Vahan/Sarathi-adjacent lookup APIs) has historically used a mix of:
//   (a) an HMAC-SHA256 signature over a canonical string
//       (client_id + timestamp + nonce + request body hash), sent as a
//       request header, and
//   (b) a short-lived bearer token obtained from a separate /auth/token
//       endpoint using client_id/client_secret, then attached as
//       `Authorization: Bearer <token>`.
// Which of these (or some third scheme) the account's actual Protean
// product surface expects is NOT confirmed — this repo has no access to
// Protean's current API docs and no real credentials to test against.
//
// This module implements scheme (a), the HMAC canonical-string pattern,
// because it's the more common shape for ASP-model eGov integrations and
// degrades safely (a wrong signature just gets a 401 from Protean, it
// doesn't silently corrupt data). client.ts calls `signRequest()` once per
// outbound call and attaches the result as an `X-Protean-Signature` header
// alongside `X-Protean-Timestamp` / `X-Protean-Nonce`.
//
// BEFORE GOING LIVE: replace this module's canonical-string format and
// header names with whatever Protean's actual integration guide specifies
// once real API docs/keys are available. Nothing downstream depends on the
// exact header names beyond client.ts, so this is a contained, one-file change.
// ============================================================================

export interface SignedRequestHeaders {
  "X-Protean-Client-Id": string;
  "X-Protean-Asp-Id": string;
  "X-Protean-Timestamp": string;
  "X-Protean-Nonce": string;
  "X-Protean-Signature": string;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
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

/**
 * Best-effort placeholder canonical string:
 *   `${clientId}.${aspId}.${timestamp}.${nonce}.${bodyText}`
 * signed with HMAC-SHA256 using apiSecret. See module header — verify
 * against real Protean docs before relying on this for production traffic.
 */
export async function signRequest(params: {
  clientId: string;
  aspId: string;
  apiSecret: string;
  bodyText: string;
  timestamp?: string;
  nonce?: string;
}): Promise<SignedRequestHeaders> {
  const timestamp = params.timestamp ?? new Date().toISOString();
  const nonce = params.nonce ?? crypto.randomUUID();
  const canonical =
    `${params.clientId}.${params.aspId}.${timestamp}.${nonce}.${params.bodyText}`;
  const signature = await hmacSha256Hex(params.apiSecret, canonical);
  return {
    "X-Protean-Client-Id": params.clientId,
    "X-Protean-Asp-Id": params.aspId,
    "X-Protean-Timestamp": timestamp,
    "X-Protean-Nonce": nonce,
    "X-Protean-Signature": signature,
  };
}

/**
 * Verifies an inbound webhook signature. Placeholder scheme mirrors
 * signRequest(): HMAC-SHA256 of the raw request body using
 * PROTEAN_WEBHOOK_SECRET, compared against an `X-Protean-Signature` header.
 * Real Protean webhook signing (header name, canonical string, encoding)
 * needs verification once docs are available — see protean-webhook/index.ts.
 *
 * Uses a constant-time comparison to avoid a timing side-channel on the
 * signature check.
 */
export async function verifyWebhookSignature(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<boolean> {
  if (!params.signatureHeader) return false;
  const expected = await hmacSha256Hex(params.secret, params.rawBody);
  return timingSafeEqual(expected, params.signatureHeader.trim().toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
