import { signRequest, verifyWebhookSignature } from "./signing.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("signRequest produces a deterministic signature for identical inputs (fixed timestamp/nonce)", async () => {
  const params = {
    clientId: "client-1",
    aspId: "asp-1",
    apiSecret: "secret-1",
    bodyText: '{"a":1}',
    timestamp: "2026-07-29T00:00:00.000Z",
    nonce: "fixed-nonce",
  };
  const first = await signRequest(params);
  const second = await signRequest(params);
  assert(first["X-Protean-Signature"] === second["X-Protean-Signature"], "same inputs must yield same signature");
  assert(/^[0-9a-f]{64}$/.test(first["X-Protean-Signature"]), "expected a 64-char lowercase hex SHA-256 digest");
});

Deno.test("signRequest changes the signature when the body changes", async () => {
  const shared = {
    clientId: "client-1",
    aspId: "asp-1",
    apiSecret: "secret-1",
    timestamp: "2026-07-29T00:00:00.000Z",
    nonce: "fixed-nonce",
  };
  const a = await signRequest({ ...shared, bodyText: '{"a":1}' });
  const b = await signRequest({ ...shared, bodyText: '{"a":2}' });
  assert(a["X-Protean-Signature"] !== b["X-Protean-Signature"], "different bodies must yield different signatures");
});

Deno.test("signRequest generates a fresh timestamp/nonce when not supplied", async () => {
  const headers = await signRequest({
    clientId: "client-1",
    aspId: "asp-1",
    apiSecret: "secret-1",
    bodyText: "{}",
  });
  assert(headers["X-Protean-Timestamp"].length > 0, "expected a generated timestamp");
  assert(headers["X-Protean-Nonce"].length > 0, "expected a generated nonce");
});

Deno.test("verifyWebhookSignature accepts a signature produced by the same HMAC scheme", async () => {
  const secret = "webhook-secret-value";
  const rawBody = '{"referenceId":"ref-1","status":"completed"}';
  // Derive the expected signature the same way signRequest's canonical
  // string would for a single-field HMAC (secret over rawBody directly),
  // matching verifyWebhookSignature's implementation.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const signatureHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const ok = await verifyWebhookSignature({ secret, rawBody, signatureHeader: signatureHex });
  assert(ok === true, "expected matching signature to verify");
});

Deno.test("verifyWebhookSignature rejects a tampered body or missing header", async () => {
  const secret = "webhook-secret-value";
  const rejectedTampered = await verifyWebhookSignature({
    secret,
    rawBody: '{"referenceId":"ref-1","status":"completed"}',
    signatureHeader: "0".repeat(64),
  });
  assert(rejectedTampered === false, "expected wrong signature to fail verification");

  const rejectedMissing = await verifyWebhookSignature({
    secret,
    rawBody: "{}",
    signatureHeader: null,
  });
  assert(rejectedMissing === false, "expected missing header to fail verification");
});
