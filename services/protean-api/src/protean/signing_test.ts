import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from "./signing.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SECRET = "webhook-salt-key-1234567890";

/** The vendor's own verification recipe (guide §9.3), used here to produce a signature. */
async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("the header name matches the vendor's sample code", () => {
  assert(WEBHOOK_SIGNATURE_HEADER === "x-signature", WEBHOOK_SIGNATURE_HEADER);
});

Deno.test("a signature over the exact bytes verifies", async () => {
  const rawBody = JSON.stringify({ documentId: "doc-1", webhookEventType: "Signed" });
  const signatureHeader = await sign(SECRET, rawBody);
  assert(
    await verifyWebhookSignature({ secret: SECRET, rawBody, signatureHeader }),
    "a byte-exact signature should verify",
  );
});

Deno.test("a signature over the re-serialized body verifies too", async () => {
  // The vendor's Node sample hashes JSON.stringify(req.body) — the parsed-and-reprinted
  // form, not the wire bytes. A sender that pretty-prints its JSON produces a hash that
  // matches the compact re-serialization and nothing else.
  const compact = JSON.stringify({ documentId: "doc-1", webhookEventType: "Signed" });
  const pretty = JSON.stringify({ documentId: "doc-1", webhookEventType: "Signed" }, null, 2);
  const signatureHeader = await sign(SECRET, compact);
  assert(
    await verifyWebhookSignature({ secret: SECRET, rawBody: pretty, signatureHeader }),
    "a signature over the compact form should verify a pretty-printed body",
  );
});

Deno.test("a tampered body, wrong secret, or missing header is rejected", async () => {
  const rawBody = JSON.stringify({ documentId: "doc-1", webhookEventType: "Signed" });
  const signatureHeader = await sign(SECRET, rawBody);

  assert(
    !await verifyWebhookSignature({
      secret: SECRET,
      rawBody: JSON.stringify({ documentId: "doc-2", webhookEventType: "Signed" }),
      signatureHeader,
    }),
    "a different document id must not verify",
  );
  assert(
    !await verifyWebhookSignature({ secret: "another-secret-1234567", rawBody, signatureHeader }),
    "the wrong secret must not verify",
  );
  assert(
    !await verifyWebhookSignature({ secret: SECRET, rawBody, signatureHeader: null }),
    "a missing header must not verify",
  );
  assert(
    !await verifyWebhookSignature({ secret: SECRET, rawBody, signatureHeader: "deadbeef" }),
    "a short junk signature must not verify",
  );
});

Deno.test("signature comparison is case-insensitive on the hex, not on the hash", async () => {
  const rawBody = JSON.stringify({ documentId: "doc-1" });
  const signatureHeader = (await sign(SECRET, rawBody)).toUpperCase();
  assert(
    await verifyWebhookSignature({ secret: SECRET, rawBody, signatureHeader }),
    "upper-case hex from the sender should still verify",
  );
});
