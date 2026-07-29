// Shared Protean eGov client. Combines what were originally two separate
// feature requests — eSign/eStamp for sale documents, and vehicle/owner/
// insurance/challan lookups — behind one client, per product decision:
// both are "call Protean's REST API with signed requests and map the
// response", so they share config, auth/signing, transport, and error
// handling. Callers (the protean-esign / protean-lookup edge functions)
// only see the typed methods below.
//
// ============================================================================
// PLACEHOLDER — endpoint paths are best-effort, NOT verified against docs
// ============================================================================
// The exact REST paths (`/esign/v2/initiate`, etc.), HTTP verbs, and
// request/response envelopes below are educated guesses based on the
// general shape of India eGov ASP APIs, written without access to
// Protean's real integration guide. Request/response *field* shapes live
// in types.ts (see that file's header for the same caveat). Before
// pointing this at production traffic:
//   1. Get Protean's current API reference for eSign, eStamp, and the
//      vehicle/owner/insurance/challan lookup products.
//   2. Fix the ENDPOINTS map below to match real paths.
//   3. Fix signing.ts to match Protean's real auth/signing scheme.
//   4. Fix the request/response field names in types.ts.
//   5. Re-run client_test.ts's request-shape assertions against a real
//      sandbox call (or Protean-provided mock server) before trusting them.
// ============================================================================

import { loadProteanConfig, type ProteanConfig, proteanConfigStatus } from "./config.ts";
import { ProteanHttpError } from "./http.ts";
import { signRequest } from "./signing.ts";
import type {
  ChallanLookupResponse,
  ESignStatusResponse,
  InitiateESignRequest,
  InitiateESignResponse,
  InitiateEStampRequest,
  InitiateEStampResponse,
  InsuranceLookupResponse,
  OwnerLookupResponse,
  VehicleLookupResponse,
} from "./types.ts";

/** Best-effort placeholder paths — see module header. */
const ENDPOINTS = {
  esignInitiate: "/esign/v2/initiate",
  esignStatus: (referenceId: string) => `/esign/v2/status/${encodeURIComponent(referenceId)}`,
  estampInitiate: "/estamp/v2/initiate",
  lookupVehicle: "/vahan/v1/vehicle",
  lookupOwner: "/vahan/v1/owner",
  lookupInsurance: "/vahan/v1/insurance",
  lookupChallan: "/echallan/v1/challan",
} as const;

function requireConfigured(config: ProteanConfig): void {
  const status = proteanConfigStatus(config);
  if (!status.configured) {
    throw new ProteanHttpError(
      503,
      "PROTEAN_NOT_CONFIGURED",
      `Protean integration is not configured (missing: ${status.missing.join(", ")}). ` +
        "Set the PROTEAN_* secrets on this Supabase project before using this feature.",
    );
  }
}

async function proteanFetch<TResponse>(
  config: ProteanConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<TResponse> {
  requireConfigured(config);
  const bodyText = init.body !== undefined ? JSON.stringify(init.body) : "";
  const signedHeaders = await signRequest({
    clientId: config.clientId,
    aspId: config.aspId,
    apiSecret: config.apiSecret,
    bodyText,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        // Best-effort placeholder header name — see signing.ts.
        "Authorization": `Bearer ${config.apiKey}`,
        ...signedHeaders,
      },
      body: init.body !== undefined ? bodyText : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : `HTTP_${response.status}`;
      const errorMessage = typeof payload.message === "string" ? payload.message : "Protean request failed.";
      console.error("Protean API request failed", path, response.status, errorCode);
      if (response.status === 429) {
        throw new ProteanHttpError(429, "PROTEAN_RATE_LIMITED", "Protean is rate-limiting this account. Please retry shortly.", true);
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProteanHttpError(502, "PROTEAN_AUTH_FAILED", "Protean rejected this request's credentials or signature.", false);
      }
      throw new ProteanHttpError(502, "PROTEAN_UPSTREAM_FAILED", errorMessage || errorCode, response.status >= 500);
    }
    return payload as TResponse;
  } catch (error) {
    if (error instanceof ProteanHttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProteanHttpError(504, "PROTEAN_TIMEOUT", "Protean did not respond in time.", true);
    }
    console.error("Protean API request errored", path, error);
    throw new ProteanHttpError(502, "PROTEAN_UNAVAILABLE", "Protean is temporarily unavailable.", true);
  } finally {
    clearTimeout(timeout);
  }
}

export class ProteanClient {
  private readonly config: ProteanConfig;

  constructor(config: ProteanConfig = loadProteanConfig()) {
    this.config = config;
  }

  // -- eSign ------------------------------------------------------------

  async initiateESign(request: InitiateESignRequest): Promise<InitiateESignResponse> {
    return await proteanFetch<InitiateESignResponse>(this.config, ENDPOINTS.esignInitiate, {
      method: "POST",
      body: request,
    });
  }

  async getESignStatus(referenceId: string): Promise<ESignStatusResponse> {
    return await proteanFetch<ESignStatusResponse>(this.config, ENDPOINTS.esignStatus(referenceId), {
      method: "GET",
    });
  }

  // -- eStamp -------------------------------------------------------------

  async initiateEStamp(request: InitiateEStampRequest): Promise<InitiateEStampResponse> {
    return await proteanFetch<InitiateEStampResponse>(this.config, ENDPOINTS.estampInitiate, {
      method: "POST",
      body: request,
    });
  }

  // -- Lookups --------------------------------------------------------------

  async lookupVehicle(registrationNumber: string): Promise<VehicleLookupResponse> {
    return await proteanFetch<VehicleLookupResponse>(this.config, ENDPOINTS.lookupVehicle, {
      method: "POST",
      body: { registrationNumber },
    });
  }

  async lookupOwner(registrationNumber: string): Promise<OwnerLookupResponse> {
    return await proteanFetch<OwnerLookupResponse>(this.config, ENDPOINTS.lookupOwner, {
      method: "POST",
      body: { registrationNumber },
    });
  }

  async lookupInsurance(registrationNumber: string): Promise<InsuranceLookupResponse> {
    return await proteanFetch<InsuranceLookupResponse>(this.config, ENDPOINTS.lookupInsurance, {
      method: "POST",
      body: { registrationNumber },
    });
  }

  async lookupChallan(registrationNumber: string): Promise<ChallanLookupResponse> {
    return await proteanFetch<ChallanLookupResponse>(this.config, ENDPOINTS.lookupChallan, {
      method: "POST",
      body: { registrationNumber },
    });
  }
}
