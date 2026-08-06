import {
  allRecipientsSigned,
  failureReason,
  requestStatusFromDocument,
  requestStatusFromWebhook,
} from "./status-map.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** The six values `protean_document_requests.status` is constrained to. */
const ALLOWED = ["initiated", "pending", "completed", "failed", "cancelled", "expired"];

Deno.test("every documented document status maps into the allowed six", () => {
  // Guide §4.1, all 22 states. A value outside the six would fail the check constraint and
  // silently lose the update, so this walks the whole published list.
  const documented = [
    "Draft",
    "Awaiting Approval",
    "Rejected Approval",
    "Procurement In Progress",
    "Procurement Failed",
    "Payment Pending",
    "Payment Failed",
    "Payment Expired",
    "Awaiting Signing",
    "Signing Expired",
    "Verification Failed",
    "Customer Rejected",
    "Awaiting Edit Approval",
    "Rejected Edit Approval",
    "Awaiting Cancel Approval",
    "Rejected Cancel Approval",
    "Cancelled",
    "eStamp Cancelled",
    "Signed",
    "Signed & Purged",
    "Payment Blocked",
    "Verification Blocked",
  ];
  for (const status of documented) {
    const mapped = requestStatusFromDocument(status);
    assert(ALLOWED.includes(mapped), `${status} mapped to ${mapped}`);
  }
});

Deno.test("only genuinely finished states are treated as finished", () => {
  assert(requestStatusFromDocument("Signed") === "completed", "Signed should complete");
  assert(requestStatusFromDocument("Signed & Purged") === "completed", "purged is still signed");
  assert(requestStatusFromDocument("Cancelled") === "cancelled", "Cancelled");
  assert(requestStatusFromDocument("Customer Rejected") === "cancelled", "a decline is a cancellation");
  assert(requestStatusFromDocument("Signing Expired") === "expired", "expiry");
  assert(requestStatusFromDocument("Procurement Failed") === "failed", "NESL rejection is a failure");
  assert(requestStatusFromDocument("Draft") === "initiated", "Draft");
  // Still moving: these must not look terminal to the dealer.
  assert(requestStatusFromDocument("Awaiting Signing") === "pending", "awaiting signature");
  assert(requestStatusFromDocument("Procurement In Progress") === "pending", "procurement");
  assert(requestStatusFromDocument("Payment Pending") === "pending", "payment pending");
});

Deno.test("an unknown status is treated as in-flight, not as a failure", () => {
  // The vendor can add a state at any time. A wrong "pending" self-corrects on the next
  // poll; a wrong "failed" tells the dealer a live agreement is dead.
  assert(requestStatusFromDocument("Some Future State") === "pending", "unknown should be pending");
});

Deno.test("webhook events map the same way", () => {
  assert(requestStatusFromWebhook("Signed") === "completed", "Signed");
  assert(requestStatusFromWebhook("Rejected") === "cancelled", "Rejected");
  assert(requestStatusFromWebhook("Failed") === "failed", "Failed");
  assert(requestStatusFromWebhook("Payment Failed") === "failed", "Payment Failed");
  assert(requestStatusFromWebhook("Initiated") === "initiated", "Initiated");
  assert(requestStatusFromWebhook("Awaiting Signing") === "pending", "Awaiting Signing");
  assert(requestStatusFromWebhook("Payment Successful") === "pending", "payment is not signing");
});

Deno.test("a document is only complete once every recipient has signed", () => {
  // Signed fires per recipient (guide §9.1.3). On a two-signer agreement the first event
  // arrives while the buyer has not signed — treating it as completion would mark an
  // unsigned agreement done.
  assert(
    !allRecipientsSigned([{ status: "Signed" }, { status: "Pending" }]),
    "one signature out of two is not completion",
  );
  assert(
    allRecipientsSigned([{ status: "Signed" }, { status: "Signed" }]),
    "both signed is completion",
  );
  assert(
    allRecipientsSigned([{ status: "Signed" }, { status: "Signing Skipped" }]),
    "a deliberately skipped signer does not hold the document open",
  );
  assert(!allRecipientsSigned([]), "an empty list is not completion");
  assert(!allRecipientsSigned(undefined), "a missing list is not completion");
});

Deno.test("failures carry a reason naming who caused them", () => {
  const rejected = failureReason("Rejected", { name: "R. Kumar" });
  assert(rejected?.includes("R. Kumar"), rejected ?? "no reason");
  assert(rejected?.includes("declined"), rejected ?? "no reason");
  assert(failureReason("Signed") === null, "a success has no failure reason");
});
