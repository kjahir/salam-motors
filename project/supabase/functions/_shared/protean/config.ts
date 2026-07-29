// Config loader for the Protean eGov integration (eSign / eStamp / vehicle
// lookups). Mirrors the loading style of ../assistant/config.ts: read env
// vars once per invocation, trim, treat blank as unset, never throw at
// import time so a misconfigured deployment fails per-request with a clear
// error instead of crashing the whole function on cold start.
//
// IMPORTANT — placeholder credentials: as of this integration landing, the
// staging project (swgxitzcylokelhqlcfe) has these seven secrets set to
// placeholder values, NOT real Protean (formerly NSDL eGov) credentials.
// Every live call this client makes will fail against the real Protean API
// until an operator replaces them with real values via
// `supabase secrets set --project-ref swgxitzcylokelhqlcfe`. See
// client.ts for the full list of request/response shapes that additionally
// need verification against Protean's actual API docs before go-live.

export type ProteanEnv = "sandbox" | "production";

export interface ProteanConfig {
  /** Base URL for Protean's REST API, e.g. https://esign.proteantech.in or a sandbox host. */
  apiBaseUrl: string;
  /** Protean-issued client/application identifier. */
  clientId: string;
  /** API key used in request headers (exact header name TBD — see client.ts). */
  apiKey: string;
  /** Shared secret used to HMAC-sign requests (exact scheme TBD — see signing.ts). */
  apiSecret: string;
  /** ASP (Application Service Provider) ID — required by NSDL/Protean's eSign ASP model. */
  aspId: string;
  /** Shared secret used to verify inbound webhook signatures (see ../protean/webhook and protean-webhook/index.ts). */
  webhookSecret: string;
  env: ProteanEnv;
  /** Per-request timeout for outbound calls to Protean. */
  timeoutMs: number;
}

/** True once every credential needed to attempt a real API call is present (non-blank). */
export interface ProteanConfigStatus {
  configured: boolean;
  missing: string[];
}

function env(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(env(name));
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function configuredEnv(): ProteanEnv {
  const value = (env("PROTEAN_ENV") ?? "sandbox").toLowerCase();
  return value === "production" ? "production" : "sandbox";
}

/**
 * Loads whatever is currently in the environment, including blanks/
 * placeholders. Never throws — callers must check `proteanConfigStatus()`
 * (or catch the NOT_CONFIGURED error client.ts raises per-call) before
 * relying on any field being real.
 */
export function loadProteanConfig(): ProteanConfig {
  return {
    apiBaseUrl: (env("PROTEAN_API_BASE_URL") ?? "").replace(/\/+$/, ""),
    clientId: env("PROTEAN_CLIENT_ID") ?? "",
    apiKey: env("PROTEAN_API_KEY") ?? "",
    apiSecret: env("PROTEAN_API_SECRET") ?? "",
    aspId: env("PROTEAN_ASP_ID") ?? "",
    webhookSecret: env("PROTEAN_WEBHOOK_SECRET") ?? "",
    env: configuredEnv(),
    timeoutMs: boundedInteger("PROTEAN_TIMEOUT_MS", 20_000, 3_000, 60_000),
  };
}

const REQUIRED_FOR_API_CALLS: (keyof ProteanConfig)[] = [
  "apiBaseUrl",
  "clientId",
  "apiKey",
  "apiSecret",
  "aspId",
];

/**
 * Reports which required fields are still blank/placeholder-empty. Used by
 * client.ts to fail fast with a clear NOT_CONFIGURED error rather than
 * sending a request to Protean with empty credentials.
 */
export function proteanConfigStatus(config: ProteanConfig): ProteanConfigStatus {
  const missing = REQUIRED_FOR_API_CALLS.filter((key) => !config[key]);
  return { configured: missing.length === 0, missing };
}

export function usableWebhookSecret(config: ProteanConfig): string | null {
  const normalized = config.webhookSecret.trim();
  if (!normalized) return null;
  // Mirrors assistant/config.ts's usableActionTokenSecret: require enough
  // entropy that HMAC verification is meaningful. 16 bytes, not 32 — this
  // secret only authenticates inbound webhook calls, not user sessions.
  if (new TextEncoder().encode(normalized).byteLength < 16) return null;
  return normalized;
}
