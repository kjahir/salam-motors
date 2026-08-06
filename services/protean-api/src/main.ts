// Protean API — the dealership's only outbound path to Protean e-Sign Pro.
//
// Runs inside the VPC behind a dedicated egress IP, because Protean whitelists the address
// its callers arrive from and Supabase Edge Functions egress from a shared pool with no
// stable address. That constraint is the whole reason this process exists; everything else
// about it is unchanged from when these were edge functions.
//
// ## Routes
//   GET  /health            — liveness for the load balancer. No auth, no dependencies.
//   POST /esign             — action-dispatched: prepare, stamp options, send, status, cancel.
//   POST /lookup            — vehicle/owner/insurance/challan lookups.
//   POST /webhook/protean   — inbound eSign Pro callbacks, HMAC-verified.
//
// ## Trust boundary
// `/esign` and `/lookup` are called by the browser and carry the user's Supabase access
// token, which is verified on every request and used to build a caller-scoped database
// client — so row-level security still decides what each caller can read, exactly as it
// did inside Supabase. `/webhook/protean` has no user session and is authenticated by its
// HMAC signature instead.

import { corsHeaders, loadServiceConfig, type ServiceConfig } from "./config.ts";
import { ProteanHttpError, toPublicError } from "./protean/http.ts";
import { handleESign, type RequestBody as ESignBody } from "./routes/esign.ts";
import { handleLookup, type LookupRequestBody } from "./routes/lookup.ts";
import { handleWebhook } from "./routes/webhook.ts";

const config = loadServiceConfig();

function withCors(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

function errorResponse(error: unknown, headers: Record<string, string>): Response {
  const { status, body } = toPublicError(error);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** The caller's Supabase access token. Absent means "not signed in", not "not allowed". */
function authorizationHeader(request: Request): string {
  const header = request.headers.get("Authorization");
  if (!header) {
    throw new ProteanHttpError(401, "AUTH_REQUIRED", "Sign in to use this feature.");
  }
  return header;
}

async function route(request: Request, cors: Record<string, string>): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (pathname === "/health") {
    // Deliberately dependency-free: this answers "is the process up", and a health check
    // that fails when Protean is down would take the whole service out of rotation for an
    // outage it cannot fix.
    return Response.json({ ok: true, service: "protean-api" }, { headers: cors });
  }

  if (request.method !== "POST") {
    throw new ProteanHttpError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
  }

  if (pathname === "/webhook/protean") {
    // Reads its own body: the signature covers the raw bytes, so it must not be parsed
    // and re-serialized on the way in.
    return await handleWebhook(config, request);
  }

  const authorization = authorizationHeader(request);
  const body = await request.json().catch(() => {
    throw new ProteanHttpError(400, "INVALID_JSON", "The request body must contain valid JSON.");
  });

  if (pathname === "/esign") return await handleESign(config, authorization, body as ESignBody);
  if (pathname === "/lookup") {
    return await handleLookup(config, authorization, body as LookupRequestBody);
  }

  throw new ProteanHttpError(404, "NOT_FOUND", `No route for ${pathname}.`);
}

export function createHandler(serviceConfig: ServiceConfig = config) {
  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(serviceConfig, request.headers.get("Origin"));
    try {
      return withCors(await route(request, cors), cors);
    } catch (error) {
      return errorResponse(error, cors);
    }
  };
}

if (import.meta.main) {
  console.log(`protean-api listening on :${config.port}`);
  Deno.serve({ port: config.port, hostname: "0.0.0.0" }, createHandler());
}
