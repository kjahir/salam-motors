// Vehicle / owner / insurance / challan lookups, keyed by registration number.
//
// Org-scoped and logged to `protean_lookup_requests`, which doubles as a short cache: a
// completed lookup of the same type for the same registration number within
// PROTEAN_LOOKUP_CACHE_TTL_MINUTES is returned without spending a fresh API call, unless
// force_refresh is set.
//
// These lookups are a *different* Protean product from e-Sign Pro and are not covered by
// the vendor guide this repo has — see protean/lookup-client.ts, where that is spelled out.
// They moved here with the rest only because they hit the same vendor from the same
// dedicated IP.

import { requireOrgStaff } from "../auth.ts";
import { ProteanLookupClient } from "../protean/lookup-client.ts";
import { loadProteanConfig } from "../protean/config.ts";
import { jsonResponse, ProteanHttpError, toPublicError } from "../protean/http.ts";
import { callerClient } from "../supabase.ts";
import type { ServiceConfig } from "../config.ts";

const ALLOWED_ROLES = ["owner", "manager", "sales_executive", "accountant"] as const;
const LOOKUP_TYPES = ["vehicle", "owner", "insurance", "challan"] as const;
type LookupType = (typeof LOOKUP_TYPES)[number];

function cacheTtlMinutes(): number {
  const value = Number(Deno.env.get("PROTEAN_LOOKUP_CACHE_TTL_MINUTES"));
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.min(1440, value);
}

export interface LookupRequestBody {
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

export async function handleLookup(
  config: ServiceConfig,
  authorization: string,
  body: LookupRequestBody,
): Promise<Response> {
  const orgId = requireString(body.org_id, "org_id");
  const registrationNumber = requireString(body.registration_number, "registration_number")
    .toUpperCase();
  if (!body.lookup_type || !LOOKUP_TYPES.includes(body.lookup_type)) {
    throw new ProteanHttpError(
      400,
      "INVALID_REQUEST",
      `lookup_type must be one of ${LOOKUP_TYPES.join(", ")}.`,
    );
  }
  const lookupType = body.lookup_type;

  const client = callerClient(config, authorization);
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
    if (cached) return jsonResponse({ result: cached, cached: true });
  }

  const lookupClient = new ProteanLookupClient(loadProteanConfig());
  let responsePayload: Record<string, unknown>;
  try {
    switch (lookupType) {
      case "vehicle":
        responsePayload = await lookupClient.lookupVehicle(registrationNumber) as Record<string, unknown>;
        break;
      case "owner":
        responsePayload = await lookupClient.lookupOwner(registrationNumber) as Record<string, unknown>;
        break;
      case "insurance":
        responsePayload = await lookupClient.lookupInsurance(registrationNumber) as Record<string, unknown>;
        break;
      case "challan":
        responsePayload = await lookupClient.lookupChallan(registrationNumber) as Record<string, unknown>;
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
    // The lookup itself succeeded; failing to persist the log row shouldn't hide a
    // successful result from the caller.
    console.error("lookup: failed to persist result", insertError);
    return jsonResponse({ result: { response_payload: responsePayload }, cached: false });
  }

  return jsonResponse({ result: saved, cached: false });
}
