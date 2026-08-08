/**
 * Subscription entitlements - the UX mirror of what the database already
 * enforces.
 *
 * Like permissions.ts, nothing in this file is a security boundary. The
 * real block lives in `enforce_billing_write_access()`
 * (supabase/migrations/20260804090000_subscription_billing.sql), a trigger
 * on every dealer-authored table. This module exists so a read-only
 * dealership sees a disabled button and an explanation instead of filling
 * in a long form and being rejected by the database at submit time.
 *
 * The shape here is exactly the jsonb returned by the `org_entitlements`
 * RPC, so there is one definition of "access" across both layers.
 */

/** Mirrors org_subscriptions.status in the billing migration. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "lapsed"
  | "cancelled"
  | "comped";

export type AccessLevel = "full" | "read_only";

/**
 * Numeric limits use `null` for unlimited - which is what every plan ships
 * with today, because the real caps are a commercial decision that has not
 * been made (see the migration header). Booleans gate a whole feature.
 */
export interface PlanLimits {
  active_vehicles?: number | null;
  team_members?: number | null;
  ai_assistant?: boolean;
  partner_investment?: boolean;
  compliance_engine?: "basic" | "full";
  vehicle_passport?: boolean;
  social_media_ads?: boolean;
  esign_estamp?: boolean;
  billing?: boolean;
}

/**
 * All boolean-gated features. Extend this union when adding a new Growth
 * feature so that `hasFeature` and `isFeatureAvailable` stay in sync.
 */
export type PlanFeature =
  | "ai_assistant"
  | "partner_investment"
  | "vehicle_passport"
  | "social_media_ads"
  | "esign_estamp"
  | "billing";

export interface Entitlements {
  org_id: string;
  status: SubscriptionStatus;
  plan_code: string | null;
  plan_name: string | null;
  billing_cycle: "monthly" | "annual" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
  limits: PlanLimits;
  access: AccessLevel;
}

/**
 * What the UI should say about the current billing state. Deliberately
 * separate from `access`: a dealership can be in perfectly good standing
 * and still deserve a "trial ends in 3 days" nudge.
 */
export type BillingNotice =
  | { kind: "none" }
  | { kind: "trial_ending"; daysRemaining: number }
  | { kind: "payment_failed"; daysRemaining: number }
  | { kind: "cancelled"; daysRemaining: number }
  | { kind: "read_only" };

/** Days before a deadline at which we start warning. */
export const TRIAL_WARNING_DAYS = 5;

export function canWrite(entitlements: Entitlements | null): boolean {
  // Fail OPEN, matching org_has_write_access() in the database: if we could
  // not load billing state, that is our bug, and hiding a dealer's own
  // "Add vehicle" button over it is the worse outcome. The database still
  // has the final say on the actual write.
  if (!entitlements) return true;
  return entitlements.access === "full";
}

/**
 * Plan-level feature gate. Absent entitlements or an absent key mean
 * "allowed" for the same fail-open reason as canWrite().
 *
 * Prefer `isFeatureAvailable()` at call sites — it additionally enforces
 * the WIP gate so staging-only features never slip into production.
 */
export function hasFeature(
  entitlements: Entitlements | null,
  feature: PlanFeature,
): boolean {
  if (!entitlements) return true;
  const value = entitlements.limits?.[feature];
  return value === undefined ? true : Boolean(value);
}

/**
 * Features that are plan-gated (Growth) but not yet ready for production.
 * They are visible in staging (`VITE_ENABLE_WIP_FEATURES=true`) so the
 * team can test end-to-end, but `isFeatureAvailable` blocks them in prod
 * even for paid Growth orgs.
 *
 * Remove a feature from this set once it ships to production.
 */
const WIP_FEATURES: ReadonlySet<PlanFeature> = new Set([
  "vehicle_passport",
  "social_media_ads",
  "esign_estamp",
  "billing",
]);

/** True when the build has explicitly opted in to WIP features (staging). */
function isWipEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_WIP_FEATURES === "true";
}

/**
 * The single call-site check for whether a feature should be shown.
 *
 * Combines two gates:
 * 1. **WIP gate** — if the feature is still work-in-progress, it is hidden
 *    in production builds and shown only when `VITE_ENABLE_WIP_FEATURES=true`
 *    (set in the staging deployment, absent in prod).
 * 2. **Plan gate** — the org's current plan must include the feature.
 *
 * Fail-open semantics match `hasFeature` and `canWrite`: missing
 * entitlements do not silently disable a feature.
 */
export function isFeatureAvailable(
  entitlements: Entitlements | null,
  feature: PlanFeature,
): boolean {
  if (WIP_FEATURES.has(feature) && !isWipEnabled()) return false;
  return hasFeature(entitlements, feature);
}

/**
 * Whole days from now until `iso`, rounded UP, floored at 0.
 *
 * Rounding up is deliberate: with 18 hours left, "1 day remaining" is
 * accurate and "0 days remaining" reads as already-expired to someone who
 * still has most of a day to pay.
 */
export function daysUntil(iso: string | null, now: Date = new Date()): number {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  const ms = target - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function getBillingNotice(
  entitlements: Entitlements | null,
  now: Date = new Date(),
): BillingNotice {
  if (!entitlements) return { kind: "none" };

  if (entitlements.access === "read_only") return { kind: "read_only" };

  switch (entitlements.status) {
    case "past_due":
      // Always worth surfacing: the dealer has full access but money did
      // not arrive, and the grace window is finite.
      return { kind: "payment_failed", daysRemaining: daysUntil(entitlements.grace_ends_at, now) };
    case "cancelled":
      return { kind: "cancelled", daysRemaining: daysUntil(entitlements.current_period_end, now) };
    case "trialing": {
      const daysRemaining = daysUntil(entitlements.trial_ends_at, now);
      // A trial with no end date is an internal/unbounded one - nothing to warn about.
      if (!entitlements.trial_ends_at) return { kind: "none" };
      if (daysRemaining > TRIAL_WARNING_DAYS) return { kind: "none" };
      return { kind: "trial_ending", daysRemaining };
    }
    default:
      return { kind: "none" };
  }
}

/**
 * True when the database rejected a write because the subscription lapsed.
 * The trigger raises a message prefixed `SUBSCRIPTION_READ_ONLY:`; matching
 * on that lets a caller show the reactivate prompt instead of a raw
 * Postgres error.
 */
export function isReadOnlyError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
  return message.includes("SUBSCRIPTION_READ_ONLY");
}

/**
 * Whether the Subscribe button for a plan should be locked because the org
 * is already paying for that exact plan.
 *
 * Matching the current plan is NOT enough on its own. `start_org_trial()`
 * assigns every new organization a plan up front, so a trialing dealer's
 * "current plan" is the very one they need to buy - and a lapsed or
 * cancelled dealer re-subscribing to their old plan is how they recover.
 * Only an active (or comped) subscription means "you already have this".
 */
export function isPlanLockedIn(
  status: SubscriptionStatus | null | undefined,
  planCode: string,
  currentPlanCode: string | null | undefined,
): boolean {
  if (!currentPlanCode || planCode !== currentPlanCode) return false;
  return status === "active" || status === "comped";
}

/** Paise -> "₹1,234" for display. Prices are stored ex-GST. */
export function formatPaise(paise: number | null | undefined): string | null {
  if (paise === null || paise === undefined) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
