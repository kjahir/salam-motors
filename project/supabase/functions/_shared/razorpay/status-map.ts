// Maps Razorpay's subscription vocabulary onto this codebase's own.
//
// Deliberately a one-way translation at the edge (see the migration
// header): every gating check in the app reads OUR status, so a Razorpay
// API change - or a second gateway later - stops at this file instead of
// leaking into every screen.
//
// Razorpay subscription states:
//   created       - subscription exists, mandate not yet authorized
//   authenticated - mandate authorized, first charge not yet made
//   active        - running and paid
//   pending       - a charge failed; Razorpay is retrying the mandate
//   halted        - retries exhausted, Razorpay gave up
//   cancelled     - cancelled by us or the customer
//   completed     - ran to total_count, nothing left to bill
//   expired       - authorization was never completed in time
//   paused        - temporarily suspended
//
// Mapping notes:
// - `created`/`authenticated` stay 'trialing': the dealer is mid-signup
//   and must not lose access between authorizing a mandate and the first
//   successful charge landing.
// - `pending` -> 'past_due' is what opens the grace window. Razorpay
//   retries a failed UPI mandate over several days; grace exists so that
//   window is not experienced as a lockout.
// - `halted` -> 'lapsed' (read-only) because Razorpay has stopped trying.
// - `completed` -> 'lapsed' rather than 'cancelled': the plan ran its
//   course, there is no live period left to honour.
// - `paused` -> 'past_due' so a paused subscription degrades through the
//   grace window rather than cutting access instantly.

export type InternalSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "lapsed"
  | "cancelled"
  | "comped";

const STATUS_MAP: Record<string, InternalSubscriptionStatus> = {
  created: "trialing",
  authenticated: "trialing",
  active: "active",
  pending: "past_due",
  paused: "past_due",
  halted: "lapsed",
  cancelled: "cancelled",
  completed: "lapsed",
  expired: "lapsed",
};

/**
 * Returns null for a status Razorpay has not documented, so the caller can
 * record the event without guessing. Guessing here would mean either
 * locking out a paying dealer or comping a non-paying one.
 */
export function mapRazorpayStatus(
  razorpayStatus: string | null | undefined,
): InternalSubscriptionStatus | null {
  if (!razorpayStatus) return null;
  return STATUS_MAP[razorpayStatus.trim().toLowerCase()] ?? null;
}

/** Webhook events this function acts on. Others are logged and ignored. */
export const HANDLED_EVENTS = [
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.paused",
  "subscription.resumed",
  "subscription.updated",
] as const;

export function isHandledEvent(eventType: string): boolean {
  return (HANDLED_EVENTS as readonly string[]).includes(eventType);
}
