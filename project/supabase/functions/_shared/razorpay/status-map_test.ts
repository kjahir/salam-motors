import { isHandledEvent, mapRazorpayStatus } from "./status-map.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("mapRazorpayStatus keeps a mid-signup subscription on full access", () => {
  // Between authorizing a UPI mandate and the first charge landing there
  // is a real window where Razorpay reports created/authenticated. Mapping
  // either to a read-only state would lock a dealer out seconds after they
  // successfully paid.
  assert(mapRazorpayStatus("created") === "trialing", "created -> trialing");
  assert(mapRazorpayStatus("authenticated") === "trialing", "authenticated -> trialing");
});

Deno.test("mapRazorpayStatus routes retryable failures into the grace window", () => {
  assert(mapRazorpayStatus("pending") === "past_due", "pending -> past_due (grace)");
  assert(mapRazorpayStatus("paused") === "past_due", "paused -> past_due (grace)");
});

Deno.test("mapRazorpayStatus only goes read-only once Razorpay has given up", () => {
  assert(mapRazorpayStatus("halted") === "lapsed", "halted -> lapsed");
  assert(mapRazorpayStatus("expired") === "lapsed", "expired -> lapsed");
  assert(mapRazorpayStatus("completed") === "lapsed", "completed -> lapsed");
});

Deno.test("mapRazorpayStatus maps the happy path and explicit cancellation", () => {
  assert(mapRazorpayStatus("active") === "active", "active -> active");
  assert(mapRazorpayStatus("cancelled") === "cancelled", "cancelled -> cancelled");
});

Deno.test("mapRazorpayStatus normalizes case and whitespace", () => {
  assert(mapRazorpayStatus("  ACTIVE  ") === "active", "should trim and lowercase");
});

Deno.test("mapRazorpayStatus returns null for unknown or absent statuses", () => {
  // Null, not a guess. Guessing means either locking out a paying dealer
  // or comping a non-paying one; the caller records the event and leaves
  // the subscription untouched instead.
  assert(mapRazorpayStatus("some_future_status") === null, "unknown -> null");
  assert(mapRazorpayStatus(null) === null, "null -> null");
  assert(mapRazorpayStatus(undefined) === null, "undefined -> null");
  assert(mapRazorpayStatus("") === null, "empty -> null");
});

Deno.test("isHandledEvent covers the subscription lifecycle and ignores unrelated events", () => {
  assert(isHandledEvent("subscription.charged"), "charged is handled");
  assert(isHandledEvent("subscription.halted"), "halted is handled");
  assert(!isHandledEvent("payment.failed"), "unrelated payment events are not handled here");
  assert(!isHandledEvent("order.paid"), "one-time order events are not handled here");
});
