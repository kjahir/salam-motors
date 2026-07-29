// Vehicle / owner / insurance / challan lookups (Task 8), on top of the
// shared Protean client. Keyed by registration number, org-scoped, and
// logged to protean_lookup_requests, which doubles as a short cache: a
// completed lookup of the same type for the same registration number
// within PROTEAN_LOOKUP_CACHE_TTL_MINUTES is returned without spending a
// fresh Protean API call, unless force_refresh is set.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireOrgStaff } from "../_shared/protean/auth.ts";
import { ProteanClient } from "../_shared/protean/client.ts";
import { loadProteanConfig } from "../_shared/protean/config.ts";
import {
  jsonResponse,
  PROTEAN_CORS_HEADERS,
  ProteanHttpError,
  toPublicError,
} from "../_shared/protean/http.ts";

const ALLOWED_ROLES = ["owner", "manager", "sales_executive", "accountant"] as const;
const LOOKUP_TYPES = ["vehicle", "owner", "insurance", "challan"] as const;
type LookupType = (typeof LOOKUP_TYPES)[number];

function cacheTtlMinutes(): number {
  const value = Number(Deno.env.get("PROTEAN_LOOKUP_CACHE_TTL_MINUTES"));
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.min(1440, value);
}

interface RequestBody {
  org_id?: string;
  vehicle_id?: string;
  lookup_type?: LookupType;
  registration_number?: string;
  force_refresh?: boolean;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProteanHttpError(400, "INVALID_REQUEST", `${field} is required.`);
  }
  return value.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: PROTEAN_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported.", retryable: false } },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      throw new ProteanHttpError(503, "FUNCTION_NOT_CONFIGURED", "This function is not configured.");
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new ProteanHttpError(401, "AUTH_REQUIRED", "Sign in to use this feature.");
    }

    const body = await req.json() as RequestBody;
    const orgId = requireString(body.org_id, "org_id");
    const registrationNumber = requireString(body.registration_number, "registration_number").toUpperCase();
    if (!body.lookup_type || !LOOKUP_TYPES.includes(body.lookup_type)) {
      throw new ProteanHttpError(400, "INVALID_REQUEST", `lookup_type must be one of ${LOOKUP_TYPES.join(", ")}.`);
    }
    const lookupType = body.lookup_type;

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const staff = await requireOrgStaff(client, orgId, ALLOWED_ROLES);

    if (!body.force_refresh) {
      const cutoff = new Date(Date.now() - cacheTtlMinutes() * 60_000).toISOString();
      const { data: cached } = await client
        .from("protean_lookup_requests")
        .select("*")
        .eq("org_id", orgId)
        .eq("lookup_type", lookupType)
        .eq("registration_number", registrationNumber)
        .eq("status", "completed")
        .gte("requested_at", cutoff)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) {
        return jsonResponse({ result: cached, cached: true });
      }
    }

    const proteanClient = new ProteanClient(loadProteanConfig());
    let responsePayload: Record<string, unknown>;
    try {
      switch (lookupType) {
        case "vehicle":
          responsePayload = await proteanClient.lookupVehicle(registrationNumber) as unknown as Record<string, unknown>;
          break;
        case "owner":
          responsePayload = await proteanClient.lookupOwner(registrationNumber) as unknown as Record<string, unknown>;
          break;
        case "insurance":
          responsePayload = await proteanClient.lookupInsurance(registrationNumber) as unknown as Record<string, unknown>;
          break;
        case "challan":
          responsePayload = await proteanClient.lookupChallan(registrationNumber) as unknown as Record<string, unknown>;
          break;
      }
    } catch (error) {
      const publicError = toPublicError(error);
      await client.from("protean_lookup_requests").insert({
        org_id: orgId,
        vehicle_id: body.vehicle_id ?? null,
        lookup_type: lookupType,
        registration_number: registrationNumber,
        status: "failed",
        error_code: publicError.body.error.code,
        error_message: publicError.body.error.message,
        requested_by: staff.userId,
      });
      throw error;
    }

    const { data: saved, error: insertError } = await client
      .from("protean_lookup_requests")
      .insert({
        org_id: orgId,
        vehicle_id: body.vehicle_id ?? null,
        lookup_type: lookupType,
        registration_number: registrationNumber,
        status: "completed",
        response_payload: responsePayload,
        requested_by: staff.userId,
      })
      .select()
      .single();
    if (insertError || !saved) {
      // The lookup itself succeeded; failing to persist the log row
      // shouldn't hide a successful result from the caller.
      console.error("protean-lookup: failed to persist lookup result", insertError);
      return jsonResponse({ result: { response_payload: responsePayload }, cached: false });
    }

    return jsonResponse({ result: saved, cached: false });
  } catch (error) {
    const { status, body: errorBody } = toPublicError(error);
    return jsonResponse(errorBody, status);
  }
});
