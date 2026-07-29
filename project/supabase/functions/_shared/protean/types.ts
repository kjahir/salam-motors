// ============================================================================
// PLACEHOLDER — every shape in this file is best-effort, NOT verified
// ============================================================================
// These interfaces describe a plausible Protean eGov REST surface (eSign,
// eStamp, and RC/insurance/challan lookups) based on the general shape of
// India eGov ASP-model APIs. This repo has no internet access to Protean's
// real API documentation and no live credentials to validate against, so
// field names, casing, nesting, and enum values below are educated guesses,
// not confirmed facts.
//
// Every exported interface here is a contract boundary: client.ts encodes
// requests and decodes responses against these shapes. When real docs
// arrive, update this file first (it's the single place field names live),
// then adjust client.ts's request-building/response-parsing to match —
// callers of ProteanClient (the edge functions) should not need to change,
// since they only see the method names and these types, not raw JSON.
// ============================================================================

export type ProteanRequestType = "esign" | "estamp";
export type ProteanRequestStatus =
  | "initiated"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface ESignSigner {
  name: string;
  /** E.164 mobile number Protean will send the OTP/sign link to. */
  mobile?: string;
  email?: string;
}

export interface InitiateESignRequest {
  /** Caller-side reference (e.g. our protean_document_requests.id) so Protean's callback can be matched back to our row. */
  referenceId: string;
  documentLabel: string;
  /** Base64-encoded PDF, or a URL Protean can fetch — TBD which the real API wants; base64 assumed as the safer default. */
  documentBase64?: string;
  documentUrl?: string;
  signers: ESignSigner[];
  /** Where Protean should redirect the signer's browser after signing. */
  redirectUrl?: string;
}

export interface InitiateESignResponse {
  /** Protean-side identifier for this signing request; stored as protean_reference_id. */
  referenceId: string;
  /** URL to redirect/open for the signer to complete eSign. */
  signUrl: string;
  status: ProteanRequestStatus;
  expiresAt?: string;
}

export interface ESignStatusResponse {
  referenceId: string;
  status: ProteanRequestStatus;
  /** Present once status === "completed". */
  signedDocumentUrl?: string;
  signedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface InitiateEStampRequest {
  referenceId: string;
  documentLabel: string;
  /** Stamp duty value in INR. */
  stampDutyAmount: number;
  /** State code the stamp duty applies to — India's stamp duty is state-specific. */
  stateCode: string;
  firstPartyName: string;
  secondPartyName: string;
  articleType?: string;
}

export interface InitiateEStampResponse {
  referenceId: string;
  status: ProteanRequestStatus;
  certificateUrl?: string;
  stampCertificateNumber?: string;
}

export type ProteanLookupType =
  | "vehicle"
  | "owner"
  | "insurance"
  | "challan";

export interface LookupRequest {
  registrationNumber: string;
}

export interface VehicleLookupResponse {
  registrationNumber: string;
  chassisNumber?: string;
  engineNumber?: string;
  makerModel?: string;
  fuelType?: string;
  registrationDate?: string;
  fitnessValidUpto?: string;
  rcStatus?: string;
}

export interface OwnerLookupResponse {
  registrationNumber: string;
  ownerName?: string;
  fatherOrHusbandName?: string;
  presentAddress?: string;
  permanentAddress?: string;
}

export interface InsuranceLookupResponse {
  registrationNumber: string;
  insurerName?: string;
  policyNumber?: string;
  policyValidUpto?: string;
  isActive?: boolean;
}

export interface ChallanLookupResponse {
  registrationNumber: string;
  challans: Array<{
    challanNumber: string;
    offenseDetails?: string;
    amount?: number;
    status?: "Pending" | "Paid" | "Disposed" | string;
    issuedAt?: string;
  }>;
}

export interface ProteanWebhookPayload {
  referenceId: string;
  requestType: ProteanRequestType;
  status: ProteanRequestStatus;
  documentUrl?: string;
  certificateUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  occurredAt?: string;
}
