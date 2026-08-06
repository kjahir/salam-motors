// Config loader for the Protean e-Sign Pro integration.
//
// Reads env once per invocation, trims, treats blank as unset, and never throws at import
// time so a misconfigured deployment fails per-request with a clear error rather than
// crashing on cold start.
//
// ## The credentials changed shape
// The first version of this integration was built without the vendor guide and assumed an
// ASP-model HMAC scheme: client id, API secret, ASP id. The real "RiSE with Protean" auth
// (guide §3) is a header pair plus login credentials repeated in every request body, and
// nothing is signed. `PROTEAN_CLIENT_ID`, `PROTEAN_API_SECRET` and `PROTEAN_ASP_ID` are
// therefore no longer read by anything — delete them from the project's secrets.

export type ProteanEnv = "sandbox" | "production";

/** Vendor-published hosts (guide §3). */
export const PROTEAN_HOSTS: Record<ProteanEnv, string> = {
  sandbox: "https://uat.risewithprotean.io",
  production: "https://api.risewithprotean.io",
};

export interface ProteanConfig {
  /** Defaults to the host matching `env`; an explicit base URL overrides it. */
  apiBaseUrl: string;
  /** Sent as the `apikey` header. */
  apiKey: string;
  /** Sent as `Authorization: Bearer <token>`. */
  bearerToken: string;
  /** Login email or mobile, repeated in every request body. */
  loginId: string;
  /** Login password, repeated in every request body. */
  loginPassword: string;
  /** Salt/key configured under Settings → eSign → Webhook; verifies inbound callbacks. */
  webhookSecret: string;
  /**
   * The dealer's Protean organization registration type, which decides which eStamp
   * fields are mandatory. A used-vehicle dealer selling to individuals is
   * NonLoan-Individual; it is org configuration rather than a per-sale choice, so it
   * lives here rather than in the request.
   */
  organizationRegType: string;
  env: ProteanEnv;
  timeoutMs: number;
}

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
  return (env("PROTEAN_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

/**
 * Accepts the token with or without the scheme word.
 *
 * The vendor's sample shows the whole header value — `Authorization: Bearer aLojj…` — so
 * copying "Bearer aLojj…" into the secret is the natural mistake. The client adds the
 * prefix itself, which would then send `Bearer Bearer aLojj…` and earn a 401 that looks
 * like a bad token rather than a doubled word.
 */
function bearerToken(): string {
  const raw = env("PROTEAN_BEARER_TOKEN") ?? "";
  return raw.replace(/^bearer\s+/i, "").trim();
}

export function loadProteanConfig(): ProteanConfig {
  const environment = configuredEnv();
  return {
    apiBaseUrl: (env("PROTEAN_API_BASE_URL") ?? PROTEAN_HOSTS[environment]).replace(
      /\/+$/,
      "",
    ),
    apiKey: env("PROTEAN_API_KEY") ?? "",
    bearerToken: bearerToken(),
    loginId: env("PROTEAN_LOGIN_ID") ?? "",
    loginPassword: env("PROTEAN_LOGIN_PASSWORD") ?? "",
    webhookSecret: env("PROTEAN_WEBHOOK_SECRET") ?? "",
    organizationRegType: env("PROTEAN_ORG_REG_TYPE") ?? "NonLoan-Individual",
    env: environment,
    timeoutMs: boundedInteger("PROTEAN_TIMEOUT_MS", 30_000, 3_000, 60_000),
  };
}

/**
 * The four credentials every call needs.
 *
 * Named by their environment-variable names rather than their config keys, because this
 * list is surfaced to the caller in a "not configured (missing: …)" message and the point
 * of that message is to say which secret to go and set.
 */
const REQUIRED: { key: keyof ProteanConfig; secret: string }[] = [
  { key: "apiBaseUrl", secret: "PROTEAN_API_BASE_URL" },
  { key: "apiKey", secret: "PROTEAN_API_KEY" },
  { key: "bearerToken", secret: "PROTEAN_BEARER_TOKEN" },
  { key: "loginId", secret: "PROTEAN_LOGIN_ID" },
  { key: "loginPassword", secret: "PROTEAN_LOGIN_PASSWORD" },
];

export function proteanConfigStatus(config: ProteanConfig): ProteanConfigStatus {
  const missing = REQUIRED.filter(({ key }) => !config[key]).map(({ secret }) => secret);
  return { configured: missing.length === 0, missing };
}

export function usableWebhookSecret(config: ProteanConfig): string | null {
  const normalized = config.webhookSecret.trim();
  if (!normalized) return null;
  // Enough entropy that HMAC verification is meaningful. 16 bytes, not 32 — this secret
  // only authenticates inbound webhook calls, not user sessions.
  if (new TextEncoder().encode(normalized).byteLength < 16) return null;
  return normalized;
}
