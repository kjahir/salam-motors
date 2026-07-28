import type { ActionTokenPayload } from "./types.ts";
import { stableJson } from "./validation.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - normalized.length % 4) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function sha256Hex(value: unknown): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(stableJson(value))),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function safetyIdentifier(
  userId: string,
  salt: string,
): Promise<string> {
  return `sm_${(await sha256Hex({ salt, userId })).slice(0, 40)}`;
}

export async function signActionToken(
  payload: ActionTokenPayload,
  secret: string,
): Promise<string> {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${bytesToBase64Url(await hmac(secret, encoded))}`;
}

export async function verifyActionToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<ActionTokenPayload> {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Malformed action token");
  if (
    !timingSafeEqual(
      await hmac(secret, encoded),
      base64UrlToBytes(signature),
    )
  ) {
    throw new Error("Invalid action token signature");
  }

  let payload: ActionTokenPayload;
  try {
    payload = JSON.parse(
      decoder.decode(base64UrlToBytes(encoded)),
    ) as ActionTokenPayload;
  } catch {
    throw new Error("Malformed action token payload");
  }
  if (
    payload.version !== 1 || !payload.proposalId ||
    !payload.conversationId || !payload.orgId || !payload.userId ||
    !payload.actionType || !payload.argumentHash ||
    !payload.confirmationToken || !payload.expiresAt
  ) {
    throw new Error("Incomplete action token");
  }
  if (Date.parse(payload.expiresAt) <= now.getTime()) {
    throw new Error("Action token has expired");
  }
  return payload;
}

