// Builds a `/api/v1/masteresign` payload from a sale.
//
// Separated from the edge function because the guide's field validation is fussy enough to
// be worth testing on its own: a document name may contain only letters, numbers and
// single spaces (guide §4.4.1, row 2), a mobile number is a ten-digit integer starting 6–9
// with no country code (§4.4.1.3, row 4), an email must be lowercase, and a signer's names
// are capped individually at 50 and jointly at 90 characters. Protean rejects the whole
// request for any one of these, so the normalizing happens here rather than being spread
// through the caller.

import { ProteanHttpError } from "./http.ts";
import type {
  MasterESignRequest,
  OrganizationRegType,
  ProteanRecipient,
  ProteanStampData,
} from "./types.ts";

export interface SignerInput {
  name: string;
  mobile?: string | null;
  email?: string | null;
  /** eStamp only — YYYY-MM-DD. */
  dob?: string | null;
  legalConstitution?: string | null;
  partyType?: string | null;
  relationshipToContract?: string | null;
  pan?: string | null;
  ovdType?: string | null;
  ovdNumber?: string | null;
  customOvdType?: string | null;
}

export interface StampInput {
  stateId: number;
  articleCode: string;
  /** Stamp duty in rupees. */
  stampAmount: number;
  /** The value the agreement is for — the sale's net payable. */
  considerationPrice: number;
  paidBy: "firstParty" | "secondParty";
  firstPartyName: string;
  secondPartyName: string;
  firstPartyPin?: number | null;
  firstPartyPan?: string | null;
  secondPartyPin?: number | null;
  secondPartyPan?: string | null;
}

export interface BuildESignInput {
  referenceId: string;
  documentName: string;
  pdfBase64: string;
  signers: SignerInput[];
  successRedirectUrl?: string;
  failedRedirectUrl?: string;
  stamp?: StampInput | null;
  organizationRegType: string;
}

/**
 * "Sale agreement — KA01AB1234" is not a legal document name: the em dash, and any other
 * punctuation, is rejected. Reduce to letters, numbers and single spaces, then clamp.
 */
export function sanitizeDocumentName(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned || "Sale Agreement";
}

/**
 * Reduces a stored contact number to what Protean accepts.
 *
 * Numbers in this app are typed by dealers and arrive as "+91 98123 45678",
 * "098123 45678", "9812345678" and worse. Strip to digits, drop a 91 country prefix or a
 * leading 0, and require what the guide requires: ten digits starting 6–9. Anything else
 * returns null so the caller can fail with a useful message instead of Protean's.
 */
export function normalizeMobile(value: string | null | undefined): number | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
  return Number(digits);
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Splits a full name into the guide's first/middle/last, respecting both the per-part cap
 * of 50 and the combined cap of 90.
 */
export function splitName(full: string): { firstName: string; middleName?: string; lastName?: string } {
  const allowed = full.replace(/[^A-Za-z0-9&,'().\s/-]/g, " ").replace(/\s+/g, " ").trim();
  const parts = allowed.split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Signer" };
  if (parts.length === 1) return { firstName: parts[0].slice(0, 50) };

  // Two caps apply at once: 50 per part and 90 across all three. Honouring only the first
  // lets two 50-character names through at 100 combined, which Protean rejects — so each
  // part is clamped against what the previous ones have already spent.
  const firstName = parts[0].slice(0, 50);
  const lastBudget = Math.min(50, 90 - firstName.length);
  const lastName = lastBudget > 0 ? parts[parts.length - 1].slice(0, lastBudget) : "";
  const middleBudget = Math.min(50, 90 - firstName.length - lastName.length);
  const middleName = middleBudget > 0
    ? parts.slice(1, -1).join(" ").slice(0, middleBudget)
    : "";
  return {
    firstName,
    ...(middleName ? { middleName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

function recipientFrom(
  signer: SignerInput,
  order: number,
  needsStampFields: boolean,
): ProteanRecipient {
  const mobileNumber = normalizeMobile(signer.mobile);
  const emailId = normalizeEmail(signer.email);
  if (!mobileNumber && !emailId) {
    throw new ProteanHttpError(
      400,
      "SIGNER_CONTACT_INVALID",
      `${signer.name || "A signer"} needs a valid email address or a 10-digit Indian mobile number — ` +
        "that is where Protean sends the signing link.",
    );
  }

  const recipient: ProteanRecipient = {
    ...splitName(signer.name),
    ...(mobileNumber ? { mobileNumber } : {}),
    ...(emailId ? { emailId } : {}),
    // Aadhaar OTP is the only method that needs nothing from the signer beyond their phone
    // — no pre-registered DSC, no drawn signature — which is what a walk-in buyer has.
    selectedSignType: "Aadhaar",
    subSignType: ["OTP"],
    signOrder: order,
    enableEmail: Boolean(emailId),
    enableSms: Boolean(mobileNumber),
  };

  if (!needsStampFields) return recipient;

  // Guide §4.4.1.3 rows 28–35: all of these become mandatory once an eStamp is attached.
  const missing: string[] = [];
  if (!signer.dob) missing.push("date of birth");
  if (!signer.pan && !signer.ovdNumber) missing.push("PAN or an officially valid document");
  if (missing.length > 0) {
    throw new ProteanHttpError(
      400,
      "SIGNER_STAMP_DETAILS_MISSING",
      `Stamp paper needs ${missing.join(" and ")} for ${signer.name || "each signer"}.`,
    );
  }

  recipient.recipientDob = signer.dob ?? undefined;
  recipient.recipientLegalConstitution = signer.legalConstitution ?? "Resident Individual";
  recipient.recipientPartyType = signer.partyType ?? "Indian Entity";
  recipient.recipientRelationshipToContract = signer.relationshipToContract ?? "Customer";
  // PAN and OVD are mutually exclusive; PAN wins when a dealer has entered both.
  if (signer.pan) {
    recipient.recipientPan = signer.pan.trim().toUpperCase();
  } else {
    recipient.recipientOvdType = (signer.ovdType ?? "Others") as ProteanRecipient["recipientOvdType"];
    recipient.recipientOvdNumber = signer.ovdNumber?.trim() ?? undefined;
    if (recipient.recipientOvdType === "Others") {
      recipient.recipientCustomOvdType = signer.customOvdType?.trim() || "Identity Document";
    }
  }
  return recipient;
}

function stampDataFrom(stamp: StampInput, organizationRegType: string): ProteanStampData {
  return {
    stateId: stamp.stateId,
    stampType: "e-Stamp",
    considerationPrice: Math.max(1, Math.round(stamp.considerationPrice)),
    organizationRegType: organizationRegType as OrganizationRegType,
    stamps: [{ articleCode: stamp.articleCode, stampAmount: Math.round(stamp.stampAmount) }],
    stampdutyPaidby: stamp.paidBy,
    estampdtls: {
      // Both party names are capped at 40 alphanumeric characters.
      firstPartyName: sanitizeDocumentName(stamp.firstPartyName).slice(0, 40),
      secondPartyName: sanitizeDocumentName(stamp.secondPartyName).slice(0, 40),
      ...(stamp.firstPartyPin ? { firstPartyPin: stamp.firstPartyPin } : {}),
      ...(stamp.firstPartyPan ? { firstPartyPanNo: stamp.firstPartyPan.toUpperCase() } : {}),
      ...(stamp.secondPartyPin ? { secondPartyPin: stamp.secondPartyPin } : {}),
      ...(stamp.secondPartyPan ? { secondPartyPanNo: stamp.secondPartyPan.toUpperCase() } : {}),
    },
  };
}

/**
 * Assembles the request.
 *
 * Signing is sequential, in the order given: the buyer signs first and the dealership
 * counter-signs, which matches how the paper version of this works and means the dealer is
 * not chasing a signature they have already given.
 */
export function buildMasterESignRequest(input: BuildESignInput): MasterESignRequest {
  if (input.signers.length === 0) {
    throw new ProteanHttpError(400, "NO_SIGNERS", "At least one signer is required.");
  }
  const stamped = Boolean(input.stamp);
  const request: MasterESignRequest = {
    referenceId: input.referenceId.slice(0, 100),
    documentName: sanitizeDocumentName(input.documentName),
    documentType: "Purchase Agreement",
    pdfFiles: [`data:application/pdf;base64,${input.pdfBase64}`],
    isSequentialSign: true,
    coordinateType: "default",
    defaultSignLocation: "Bottom - Right",
    enableDownload: true,
    recipientData: input.signers.map((signer, index) =>
      recipientFrom(signer, index + 1, stamped)
    ),
  };
  if (input.successRedirectUrl) request.successRedirectUrl = input.successRedirectUrl;
  if (input.failedRedirectUrl) request.failedRedirectUrl = input.failedRedirectUrl;
  if (input.stamp) {
    request.isStampDutyRequired = true;
    request.stampData = stampDataFrom(input.stamp, input.organizationRegType);
  }
  return request;
}

/** The signing link for the first signer, which is the one the dealer hands over. */
export function firstSigningUrl(
  redirectUrl: { recipientId: string; redirectUrl: string }[] | undefined,
): string | null {
  return redirectUrl && redirectUrl.length > 0 ? redirectUrl[0].redirectUrl : null;
}
