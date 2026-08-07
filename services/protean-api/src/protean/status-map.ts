// Protean's vocabulary, translated into ours.
//
// eSign Pro reports 22 document states and 17 recipient states (guide §4.1, §4.2);
// `protean_document_requests.status` has a check constraint allowing six. This module is
// the single place that bridges them, so a state we have never seen cannot end up
// violating the constraint and losing the update.
//
// The mapping is deliberately conservative: anything still capable of moving forward maps
// to `pending`, and only genuinely terminal states map to a terminal value. Getting this
// backwards would be the worse failure — a dealer told "failed" about a document a buyer
// is midway through signing.

import type {
  ProteanDocumentStatus,
  RequestStatus,
  WebhookEventType,
} from "./types.ts";

const TERMINAL_SUCCESS: string[] = ["Signed", "Signed & Purged"];

const TERMINAL_FAILURE: string[] = [
  "Procurement Failed",
  "Rejected Approval",
  "Rejected Edit Approval",
  "Verification Failed",
  "Verification Blocked",
  "Payment Failed",
  "Payment Blocked",
];

const TERMINAL_CANCELLED: string[] = [
  "Cancelled",
  "eStamp Cancelled",
  // The buyer declining is a cancellation of the signing, not a system failure — the
  // dealer's next step is a conversation, not a retry.
  "Customer Rejected",
];

const TERMINAL_EXPIRED: string[] = [
  "Signing Expired",
  "Payment Expired",
];

/**
 * Maps a document status to ours.
 *
 * Unknown strings map to `pending` rather than throwing: the vendor can add a state at any
 * time, and the cost of guessing wrong there is one stale row that the next poll corrects,
 * versus a write that fails the check constraint and drops the update entirely.
 */
export function requestStatusFromDocument(
  status: ProteanDocumentStatus | string,
): RequestStatus {
  if (TERMINAL_SUCCESS.includes(status)) return "completed";
  if (TERMINAL_FAILURE.includes(status)) return "failed";
  if (TERMINAL_CANCELLED.includes(status)) return "cancelled";
  if (TERMINAL_EXPIRED.includes(status)) return "expired";
  if (status === "Draft") return "initiated";
  return "pending";
}

/** Maps a webhook event to ours (guide §9.1). */
export function requestStatusFromWebhook(
  event: WebhookEventType | string,
): RequestStatus {
  switch (event) {
    case "Signed":
      return "completed";
    case "Rejected":
      return "cancelled";
    case "Failed":
    case "Payment Failed":
      return "failed";
    case "Initiated":
      return "initiated";
    default:
      // Awaiting Signing, Payment Initiated, Payment Successful — all still in flight.
      return "pending";
  }
}

/**
 * Whether a "Signed" webhook means the whole document is done.
 *
 * The Signed event fires per recipient, not per document: on a two-signer agreement the
 * dealer signs, a Signed event arrives, and the buyer still has not signed. Treating the
 * first one as completion would mark an unsigned agreement complete, so completion
 * requires every recipient in the payload to be Signed.
 */
export function allRecipientsSigned(
  recipients: { status?: string }[] | undefined,
): boolean {
  if (!recipients || recipients.length === 0) return false;
  return recipients.every((recipient) =>
    recipient.status === "Signed" || recipient.status === "Signing Skipped"
  );
}

/** A human-readable reason to store alongside a non-success outcome. */
export function failureReason(
  event: WebhookEventType | string,
  recipient?: { name?: string; status?: string },
): string | null {
  const who = recipient?.name ? ` (${recipient.name})` : "";
  switch (event) {
    case "Rejected":
      return `A signer declined to sign${who}.`;
    case "Failed":
      return `The signing process failed${who}.`;
    case "Payment Failed":
      return `Payment for this document failed${who}.`;
    default:
      return null;
  }
}
