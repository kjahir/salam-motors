import { supabase } from "./supabase";
import { proteanEsign } from "./proteanApi";

/**
 * Client side of the sale signing flow, on Protean e-Sign Pro.
 *
 * Shared by the desktop Sale & Profit tab and the mobile Sale tab: the two have separate
 * components because they have separate design systems, but the sequence of calls and the
 * meaning of each status is the same on both.
 *
 * The shape here follows the vendor's: stamping is not a separate operation, it is an
 * option on sending. One call produces the stamped, signable document and one documentId
 * that status checks, cancellation and webhooks all key on.
 *
 * The calls go to `services/protean-api/` rather than to a Supabase Edge Function — see
 * `proteanApi.ts` for why. Reading the request history still goes straight to Supabase,
 * because that is plain RLS-protected table access with no Protean involvement.
 */

export type ProteanRequestType = "esign" | "estamp";

export type ProteanRequestStatus =
  | "initiated"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface ProteanDocumentRequest {
  id: string;
  org_id: string;
  vehicle_id: string | null;
  sale_id: string | null;
  request_type: ProteanRequestType;
  status: ProteanRequestStatus;
  document_label: string;
  signer_details: { signers?: unknown[] } | null;
  request_payload:
    | { document_path?: string; document_id?: string; stamped?: boolean; article_code?: string | null }
    | null;
  protean_reference_id: string | null;
  /** Once signed, a `data:application/pdf;base64,…` copy of the signed document. */
  document_url: string | null;
  stamp_duty_amount: number | null;
  error_code: string | null;
  error_message: string | null;
  initiated_at: string;
  completed_at: string | null;
  updated_at: string;
}

/** Contact and, for stamped agreements, identity details for one signer. */
export interface ESignSigner {
  name: string;
  mobile?: string | null;
  email?: string | null;
  /** YYYY-MM-DD. Required by Protean once an eStamp is attached. */
  dob?: string | null;
  pan?: string | null;
  ovdType?: string | null;
  ovdNumber?: string | null;
}

export interface StampSelection {
  stateId: number;
  articleCode: string;
  stampAmount: number;
  paidBy: "firstParty" | "secondParty";
}

export interface StampState {
  stateId: number;
  stateName: string;
  isSpecialState: boolean;
}

export interface PreparedAgreement {
  document: { path: string; documentId: string; label: string; vehicleId: string };
  signers: ESignSigner[];
  parties: { first: string; second: string };
}

export function isSettled(status: ProteanRequestStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled" ||
    status === "expired";
}

/** Whether re-polling Protean for this request can still change anything. */
export function canRefresh(request: ProteanDocumentRequest): boolean {
  return !!request.protean_reference_id && !isSettled(request.status);
}

/** Whether the dealer can still call this signature off at Protean's end. */
export function canCancel(request: ProteanDocumentRequest): boolean {
  return !!request.protean_reference_id && !isSettled(request.status);
}

/** Every signature request raised against a sale, newest first. */
export async function fetchSaleDocumentRequests(
  saleId: string,
): Promise<ProteanDocumentRequest[]> {
  const { data, error } = await supabase
    .from("protean_document_requests")
    .select("*")
    .eq("sale_id", saleId)
    .order("initiated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProteanDocumentRequest[];
}

/**
 * Generates the agreement and files it against the vehicle, without sending it anywhere.
 *
 * Worth having on its own: it produces a real agreement the dealer can download and print
 * even before Protean is connected.
 */
export async function prepareSaleAgreement(
  orgId: string,
  saleId: string,
  signers?: ESignSigner[],
): Promise<PreparedAgreement> {
  return await proteanEsign<PreparedAgreement>({
    action: "prepare_sale_agreement",
    org_id: orgId,
    sale_id: saleId,
    signers,
  });
}

/** States that support e-Stamp, for the stamping form. */
export async function fetchStampStates(orgId: string): Promise<StampState[]> {
  const result = await proteanEsign<{ states: StampState[] }>({
    action: "stamp_options",
    org_id: orgId,
  });
  return result.states ?? [];
}

/** Article codes available on the dealer's stamp inventory for one state. */
export async function fetchArticleCodes(orgId: string, stateId: number): Promise<string[]> {
  const result = await proteanEsign<{ articleCodes: string[] }>({
    action: "stamp_options",
    org_id: orgId,
    state_id: stateId,
  });
  return result.articleCodes ?? [];
}

/**
 * Sends the agreement for signature, stamped if a stamp is supplied.
 *
 * One call, because that is what the vendor exposes: the document, the stamp duty and the
 * signers all go together and come back as one document.
 */
export async function sendSaleAgreementForSignature(
  orgId: string,
  saleId: string,
  signers: ESignSigner[],
  stamp?: StampSelection | null,
): Promise<{ request: ProteanDocumentRequest; signUrl?: string; message?: string }> {
  return await proteanEsign({
    action: "initiate_esign",
    org_id: orgId,
    sale_id: saleId,
    signers,
    // Where Protean returns the signer's browser once they are done.
    redirect_url: window.location.href,
    stamp: stamp
      ? {
        state_id: stamp.stateId,
        article_code: stamp.articleCode,
        stamp_amount: stamp.stampAmount,
        paid_by: stamp.paidBy,
      }
      : undefined,
  });
}

export async function refreshESignStatus(
  orgId: string,
  requestId: string,
): Promise<{ request: ProteanDocumentRequest; proteanStatus?: string }> {
  return await proteanEsign({
    action: "esign_status",
    org_id: orgId,
    request_id: requestId,
  });
}

export async function cancelESignRequest(
  orgId: string,
  requestId: string,
  feedback: string,
): Promise<ProteanDocumentRequest> {
  const result = await proteanEsign<{ request: ProteanDocumentRequest }>({
    action: "cancel_esign",
    org_id: orgId,
    request_id: requestId,
    feedback,
  });
  return result.request;
}

/** A short-lived link to a generated agreement in the private documents bucket. */
export async function agreementDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("vehicle-documents")
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("The agreement could not be opened.");
  }
  return data.signedUrl;
}

/** The stored agreement behind a request, when it has one. */
export function agreementPath(request: ProteanDocumentRequest): string | null {
  return request.request_payload?.document_path ?? null;
}

/**
 * Opens the signed copy.
 *
 * Protean returns the signed document inline as a base64 data URI rather than a URL, so
 * there is nothing to link to — it has to be turned back into bytes and handed to the
 * browser as a blob. Data URIs that big are refused by some browsers in `window.open`.
 */
export function openSignedDocument(dataUri: string, filename: string): void {
  const [header, encoded] = dataUri.split(",", 2);
  if (!encoded) throw new Error("The signed document could not be read.");
  const mime = header.match(/data:([^;]+)/)?.[1] ?? "application/pdf";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.target = "_blank";
  link.click();
  // Revoked on a timeout rather than immediately: revoking synchronously can beat the
  // browser to actually opening it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
