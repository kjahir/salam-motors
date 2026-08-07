// ============================================================================
// Protean e-Sign Pro — Single API. Verified against the vendor guide.
// ============================================================================
// Source: "Protean e-Sign Pro - APIs", v1.8, 30 April 2026 (docs/1777688745925.pdf).
// Every shape below is transcribed from that document; the earlier version of this file
// was a set of educated guesses written without it, and none of it survived.
//
// The single most important structural fact: eStamping is NOT a separate call. One
// `/api/v1/masteresign` request carries the document, the stamp, and the signers, and
// returns one documentId that everything afterwards is keyed on.
// ============================================================================

/** Document lifecycle states (guide §4.1). Transcribed verbatim — matched as strings. */
export type ProteanDocumentStatus =
  | "Draft"
  | "Awaiting Approval"
  | "Rejected Approval"
  | "Procurement In Progress"
  | "Procurement Failed"
  | "Payment Pending"
  | "Payment Failed"
  | "Payment Expired"
  | "Awaiting Signing"
  | "Signing Expired"
  | "Verification Failed"
  | "Customer Rejected"
  | "Awaiting Edit Approval"
  | "Rejected Edit Approval"
  | "Awaiting Cancel Approval"
  | "Rejected Cancel Approval"
  | "Cancelled"
  | "eStamp Cancelled"
  | "Signed"
  | "Signed & Purged"
  | "Payment Blocked"
  | "Verification Blocked";

/** Per-recipient states (guide §4.2). */
export type ProteanRecipientStatus =
  | "Pending"
  | "Payment Awaited"
  | "Payment Expired"
  | "Payment Failed"
  | "Payment Failed & Expired"
  | "Awaited"
  | "Expired"
  | "Rejected"
  | "Verification Failed"
  | "Verification Failed & Expired"
  | "Cancelled"
  | "Signing Skipped"
  | "Signed"
  | "Payment Blocked"
  | "Payment Blocked & Expired"
  | "Verification Blocked"
  | "Verification Blocked & Expired";

/** Our own lifecycle, which `protean_document_requests.status` is constrained to. */
export type RequestStatus =
  | "initiated"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

/** documentType is a closed list (guide §4.4.1.1). A vehicle sale is a purchase agreement. */
export const DOCUMENT_TYPES = [
  "NDA",
  "Business Agreement",
  "Employment Agreement",
  "Loan Agreement",
  "Purchase Agreement",
  "MoU",
  "Vendor Agreement",
  "Consulting Agreement",
] as const;
export type ProteanDocumentType = typeof DOCUMENT_TYPES[number];

export type SignType = "Aadhaar" | "Virtual Sign" | "DSC";
export type AadhaarSubSignType = "OTP" | "Iris" | "Biometric" | "Face";

/**
 * A signer (guide §4.4.1.3).
 *
 * `mobileNumber` is an integer of exactly 10 digits starting 6–9 — no country code, no
 * spaces — and `emailId` must be lowercase. The eStamp-only fields at the bottom become
 * mandatory the moment `isStampDutyRequired` is true.
 */
export interface ProteanRecipient {
  firstName: string;
  middleName?: string;
  lastName?: string;
  mobileNumber?: number;
  emailId?: string;
  selectedSignType: SignType;
  subSignType?: AadhaarSubSignType[] | string[];
  /** 1–10, and only allowed when the document is sequential. */
  signOrder?: number;
  enableSms?: boolean;
  enableEmail?: boolean;
  enableWhatsapp?: boolean;
  // --- required once an eStamp is attached ---
  /** YYYY-MM-DD; the signer must be 18–100 years old. */
  recipientDob?: string;
  recipientLegalConstitution?: string;
  recipientPartyType?: string;
  recipientRelationshipToContract?: string;
  /** PAN or OVD, never both (guide §4.4.1.3, rows 32–35). */
  recipientPan?: string;
  recipientOvdType?: "Passport" | "Driving License" | "Voter ID" | "Others";
  recipientCustomOvdType?: string;
  recipientOvdNumber?: string;
}

/** One article line of an eStamp (guide §4.4.1.5.1). */
export interface StampArticle {
  articleCode: string;
  stampAmount: number;
}

/** eStamp party details (guide §4.4.1.5.2). */
export interface EStampDetails {
  firstPartyName?: string;
  firstPartyPin?: number;
  firstPartyPanNo?: string;
  secondPartyName: string;
  secondPartyPin?: number;
  secondPartyPanNo?: string;
}

export type OrganizationRegType =
  | "Loan-Individual"
  | "Loan-NonIndividual"
  | "NonLoan-Individual"
  | "NonLoan-NonIndividual";

/** `stampData` for the e-Stamp flow (guide §4.4.1.5). */
export interface ProteanStampData {
  stateId: number;
  stampType: "e-Stamp" | "Digital Stamp";
  considerationPrice: number;
  organizationRegType: OrganizationRegType;
  stamps: StampArticle[];
  stampdutyPaidby: "firstParty" | "secondParty";
  estampdtls: EStampDetails;
  isRecipientToPayStamp?: boolean;
}

/** The master eSign request (guide §4.4.1). Only the fields this app sends. */
export interface MasterESignRequest {
  referenceId?: string;
  documentName: string;
  documentType: ProteanDocumentType;
  /** Data URIs: `data:application/pdf;base64,...`. Between 1 and 5. */
  pdfFiles: string[];
  isSequentialSign: boolean;
  coordinateType?: "default" | "custom" | "allPageCoordinate";
  defaultSignLocation?: "Top - Right" | "Bottom - Left" | "Top - Left" | "Bottom - Right";
  enableDownload?: boolean;
  successRedirectUrl?: string;
  failedRedirectUrl?: string;
  isStampDutyRequired?: boolean;
  stampData?: ProteanStampData;
  recipientData: ProteanRecipient[];
}

export interface MasterESignResponse {
  status: number;
  message: string;
  /** 5050 sent for approval · 5051 payment requested · 5052 sent for signing. */
  code: string;
  data: {
    documentId: string;
    recipientData: {
      recipientId: string;
      emailId?: string;
      mobileNumber?: number;
    }[];
    /** Present on 5051/5052 — one signing link per recipient. */
    redirectUrl?: { recipientId: string; redirectUrl: string }[];
    stampData?: unknown;
  };
}

/** `POST /api/v1/esign/document-status` (guide §5.19). `data` is an array of one. */
export interface DocumentStatusResponse {
  status: number;
  message: string;
  code: string;
  data: {
    documentId: string;
    referenceId: string | null;
    documentName: string;
    status: ProteanDocumentStatus | string;
    stampType?: string | null;
    stateName?: string | null;
    stampAmount?: number | null;
    feedback?: string | null;
    recipientData: {
      recipientId: string;
      recipientFirstName?: string;
      recipientLastName?: string | null;
      recipientEmail?: string | null;
      recipientMobile?: string | null;
      recipientOrder?: number;
      status: ProteanRecipientStatus | string;
    }[];
  }[];
}

/** `POST /api/v1/esign/document-pdf` (guide §5.20). */
export interface DocumentPdfResponse {
  status: number;
  message: string;
  code: string;
  data: {
    documentId: string;
    documentName: string;
    /** `data:application/pdf;base64,...` */
    documentPdf: string;
    isDocumentPurged: boolean;
  }[];
}

/** `POST /api/v1/esign/stampstates` (guide §5.1). */
export interface StampStatesResponse {
  status: number;
  data: {
    stateId: number;
    stateName: string;
    stampType: ("e-Stamp" | "Digital Stamp")[];
    isSpecialState: boolean;
  }[];
}

/** `POST /api/v1/esign/ArticleCodeFetchEstamp` (guide §5.4). */
export interface ArticleCodeResponse {
  status: number;
  data: { articleCode: string[] };
}

/** `POST /api/v1/esign/eStamp/considerationPrice` (guide §5.3), for special states. */
export interface ConsiderationPriceResponse {
  status: number;
  stampDutyAmount: string;
}

/** Webhook event names (guide §9.1). */
export type WebhookEventType =
  | "Initiated"
  | "Awaiting Signing"
  | "Signed"
  | "Rejected"
  | "Failed"
  | "Payment Initiated"
  | "Payment Successful"
  | "Payment Failed";

/**
 * Inbound webhook body (guide §9.1.1–9.1.8).
 *
 * Note what is absent: eSign webhooks carry no referenceId, so `documentId` is the only
 * thing tying a callback back to our row. Recipient arrays arrive under `recipientData`
 * on most events and `recipentlistData` (the vendor's spelling) on the payment ones.
 */
export interface ProteanWebhookPayload {
  orgId?: string;
  documentId: string;
  documentName?: string;
  webhookEventType: WebhookEventType | string;
  webhooklogId?: string;
  isSequentialSign?: boolean;
  amount?: number;
  currency?: string;
  recipientData?: WebhookRecipient[];
  recipentlistData?: WebhookRecipient[];
  signedRecipientData?: WebhookRecipient;
  rejectedRecipientData?: WebhookRecipient;
  failedRecipientData?: WebhookRecipient;
}

export interface WebhookRecipient {
  name?: string;
  status?: string;
  emailId?: string;
  mobileNumber?: string | null;
  /** Spelled `recipientId` on list entries and `recepientId` on the singular ones. */
  recipientId?: string;
  recepientId?: string;
}
