// Service-level configuration, distinct from the Protean credentials in
// `protean/config.ts` — this is about how the service itself is hosted.
//
// Everything is read once at startup and validated loudly: unlike an edge function, which
// is redeployed per change and fails per request, this process is long-lived inside a VPC.
// A missing Supabase key should stop the container from reporting healthy, not surface as
// a confusing 500 on the first sale of the day.

export interface ServiceConfig {
  port: number;
  supabaseUrl: string;
  /** Used to build a caller-scoped client, so the caller's RLS still applies. */
  supabaseAnonKey: string;
  /**
   * Needed to store generated agreements and to apply webhook updates that arrive with no
   * user session. Holding this outside Supabase is the real cost of moving out here — see
   * the deployment notes in README.md.
   */
  supabaseServiceRoleKey: string;
  /**
   * Browser origins allowed to call this service. Empty means "any", which is only
   * appropriate behind a private network; set it for anything internet-facing.
   */
  allowedOrigins: string[];
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. This service cannot start without it — see README.md.`,
    );
  }
  return value;
}

export function loadServiceConfig(): ServiceConfig {
  const port = Number(Deno.env.get("PORT") ?? "8080");
  return {
    port: Number.isInteger(port) && port > 0 ? port : 8080,
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

/**
 * CORS headers for one request.
 *
 * The browser now calls this service directly rather than a Supabase function, so this is
 * the only thing standing between the API and any other site a dealer happens to have
 * open. An explicit allow-list echoes back only origins that are on it; with no list
 * configured it falls back to `*`, which is fine on a private network and not otherwise.
 */
export function corsHeaders(
  config: ServiceConfig,
  requestOrigin: string | null,
): Record<string, string> {
  const allowOrigin = config.allowedOrigins.length === 0
    ? "*"
    : requestOrigin && config.allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : config.allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    ...(config.allowedOrigins.length > 0 ? { "Vary": "Origin" } : {}),
  };
}
