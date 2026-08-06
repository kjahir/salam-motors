// ============================================================================
// UNVERIFIED — Vahan / eChallan lookups are a different Protean product
// ============================================================================
// The vendor guide this repo has (docs/1777688745925.pdf, "Protean e-Sign Pro - APIs"
// v1.8) covers eSign, eStamp, digital stamping, eMandate and the eSign verifier. It says
// nothing about vehicle, owner, insurance or challan lookups — those belong to a separate
// Protean product with its own documentation that we do not have.
//
// So while client.ts is now written against a real specification, everything here remains
// what it always was: an educated guess at endpoint paths and response shapes. It is split
// into its own file precisely so that distinction is visible — a reader of client.ts
// should not have to wonder which half is verified.
//
// Auth reuses the RiSE credentials, on the assumption that one Protean account fronts both
// products. That assumption is also unverified. When the lookup product's guide arrives,
// this file is the only thing that needs to change.
// ============================================================================

import { loadProteanConfig, type ProteanConfig, proteanConfigStatus } from "./config.ts";
import { ProteanHttpError } from "./http.ts";

/** Best-effort placeholder paths — see module header. */
const ENDPOINTS = {
  vehicle: "/api/v1/vahan/vehicle",
  owner: "/api/v1/vahan/owner",
  insurance: "/api/v1/vahan/insurance",
  challan: "/api/v1/echallan/challan",
} as const;

export type ProteanLookupType = keyof typeof ENDPOINTS;

export interface VehicleLookupResponse {
  registrationNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
  makerModel?: string;
  fuelType?: string;
  registrationDate?: string;
  fitnessValidUpto?: string;
  rcStatus?: string;
}

export interface OwnerLookupResponse {
  registrationNumber?: string;
  ownerName?: string;
  fatherOrHusbandName?: string;
  presentAddress?: string;
  permanentAddress?: string;
}

export interface InsuranceLookupResponse {
  registrationNumber?: string;
  insurerName?: string;
  policyNumber?: string;
  policyValidUpto?: string;
  isActive?: boolean;
}

export interface ChallanLookupResponse {
  registrationNumber?: string;
  challans?: {
    challanNumber?: string;
    offenseDetails?: string;
    amount?: number;
    status?: string;
    issuedAt?: string;
  }[];
}

async function lookupPost<TResponse>(
  config: ProteanConfig,
  path: string,
  registrationNumber: string,
): Promise<TResponse> {
  const status = proteanConfigStatus(config);
  if (!status.configured) {
    throw new ProteanHttpError(
      503,
      "PROTEAN_NOT_CONFIGURED",
      `Protean is not connected yet (missing: ${status.missing.join(", ")}).`,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": config.apiKey,
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({
        emailOrMobile: config.loginId,
        password: config.loginPassword,
        registrationNumber,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload.message === "string" ? payload.message : "Lookup failed.";
      console.error("Protean lookup failed", path, response.status, message);
      throw new ProteanHttpError(502, "PROTEAN_LOOKUP_FAILED", message, response.status >= 500);
    }
    return payload as TResponse;
  } catch (error) {
    if (error instanceof ProteanHttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProteanHttpError(504, "PROTEAN_TIMEOUT", "Protean did not respond in time.", true);
    }
    console.error("Protean lookup errored", path, error);
    throw new ProteanHttpError(502, "PROTEAN_UNREACHABLE", "Could not reach Protean.", true);
  } finally {
    clearTimeout(timeout);
  }
}

export class ProteanLookupClient {
  private readonly config: ProteanConfig;

  constructor(config: ProteanConfig = loadProteanConfig()) {
    this.config = config;
  }

  lookupVehicle(registrationNumber: string): Promise<VehicleLookupResponse> {
    return lookupPost<VehicleLookupResponse>(this.config, ENDPOINTS.vehicle, registrationNumber);
  }

  lookupOwner(registrationNumber: string): Promise<OwnerLookupResponse> {
    return lookupPost<OwnerLookupResponse>(this.config, ENDPOINTS.owner, registrationNumber);
  }

  lookupInsurance(registrationNumber: string): Promise<InsuranceLookupResponse> {
    return lookupPost<InsuranceLookupResponse>(this.config, ENDPOINTS.insurance, registrationNumber);
  }

  lookupChallan(registrationNumber: string): Promise<ChallanLookupResponse> {
    return lookupPost<ChallanLookupResponse>(this.config, ENDPOINTS.challan, registrationNumber);
  }
}
