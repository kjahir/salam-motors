import { describe, expect, it, vi } from "vitest";
import {
  canWrite,
  daysUntil,
  formatPaise,
  getBillingNotice,
  hasFeature,
  isFeatureAvailable,
  isPlanLockedIn,
  isReadOnlyError,
  type Entitlements,
} from "./entitlements";

const NOW = new Date("2026-08-04T12:00:00.000Z");

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    org_id: "org-1",
    status: "active",
    plan_code: "growth",
    plan_name: "Growth",
    billing_cycle: "monthly",
    trial_ends_at: null,
    current_period_end: null,
    grace_ends_at: null,
    cancel_at_period_end: false,
    limits: { ai_assistant: true, partner_investment: true },
    access: "full",
    ...overrides,
  };
}

describe("write gating", () => {
  it("allows writes on full access and blocks them when read-only", () => {
    expect(canWrite(entitlements({ access: "full" }))).toBe(true);
    expect(canWrite(entitlements({ access: "read_only", status: "lapsed" }))).toBe(false);
  });

  it("fails OPEN when entitlements could not be loaded", () => {
    // Mirrors org_has_write_access() in the database. A failed billing
    // fetch is our bug; hiding a dealership's own controls over it is
    // worse than briefly showing a button the database would reject.
    expect(canWrite(null)).toBe(true);
  });
});

describe("feature gating", () => {
  it("gates a feature the plan does not include", () => {
    const starter = entitlements({ plan_code: "starter", limits: { ai_assistant: false } });
    expect(hasFeature(starter, "ai_assistant")).toBe(false);
  });

  it("allows a feature the plan includes", () => {
    expect(hasFeature(entitlements(), "ai_assistant")).toBe(true);
  });

  it("fails open for an unknown limit key or missing entitlements", () => {
    // Plans seed with only some keys set; an absent key must not silently
    // switch a feature off for everyone.
    expect(hasFeature(entitlements({ limits: {} }), "partner_investment")).toBe(true);
    expect(hasFeature(null, "ai_assistant")).toBe(true);
  });
});

describe("WIP feature gate (isFeatureAvailable)", () => {
  it("blocks WIP features in production (env flag absent)", () => {
    vi.stubEnv("VITE_ENABLE_WIP_FEATURES", "");
    const growth = entitlements({ limits: { ai_assistant: true, vehicle_passport: true, social_media_ads: true, esign_estamp: true } });
    expect(isFeatureAvailable(growth, "ai_assistant")).toBe(false);
    expect(isFeatureAvailable(growth, "vehicle_passport")).toBe(false);
    expect(isFeatureAvailable(growth, "social_media_ads")).toBe(false);
    expect(isFeatureAvailable(growth, "esign_estamp")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("allows WIP features in staging when env flag is true and plan includes them", () => {
    vi.stubEnv("VITE_ENABLE_WIP_FEATURES", "true");
    const growth = entitlements({ limits: { ai_assistant: true, vehicle_passport: true } });
    expect(isFeatureAvailable(growth, "ai_assistant")).toBe(true);
    expect(isFeatureAvailable(growth, "vehicle_passport")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("still applies the plan gate even when the WIP flag is on", () => {
    vi.stubEnv("VITE_ENABLE_WIP_FEATURES", "true");
    const starter = entitlements({ plan_code: "starter", limits: { ai_assistant: false } });
    expect(isFeatureAvailable(starter, "ai_assistant")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("does not restrict non-WIP features regardless of the env flag", () => {
    vi.stubEnv("VITE_ENABLE_WIP_FEATURES", "");
    const growth = entitlements({ limits: { partner_investment: true } });
    // partner_investment is production-ready; env flag must not gate it
    expect(isFeatureAvailable(growth, "partner_investment")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("fails open when entitlements are unavailable (WIP flag on)", () => {
    vi.stubEnv("VITE_ENABLE_WIP_FEATURES", "true");
    expect(isFeatureAvailable(null, "ai_assistant")).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("daysUntil", () => {
  it("rounds partial days up so a dealer is never told 0 days while time remains", () => {
    expect(daysUntil("2026-08-05T06:00:00.000Z", NOW)).toBe(1);
    expect(daysUntil("2026-08-11T12:00:00.000Z", NOW)).toBe(7);
  });

  it("floors at zero for past, missing or unparseable dates", () => {
    expect(daysUntil("2026-08-01T12:00:00.000Z", NOW)).toBe(0);
    expect(daysUntil(null, NOW)).toBe(0);
    expect(daysUntil("not-a-date", NOW)).toBe(0);
  });
});

describe("billing notice", () => {
  it("stays quiet for a healthy paid subscription", () => {
    expect(getBillingNotice(entitlements(), NOW)).toEqual({ kind: "none" });
  });

  it("warns only near the end of a trial, not throughout it", () => {
    const far = entitlements({ status: "trialing", trial_ends_at: "2026-08-18T12:00:00.000Z" });
    expect(getBillingNotice(far, NOW)).toEqual({ kind: "none" });

    const near = entitlements({ status: "trialing", trial_ends_at: "2026-08-07T12:00:00.000Z" });
    expect(getBillingNotice(near, NOW)).toEqual({ kind: "trial_ending", daysRemaining: 3 });
  });

  it("always surfaces a failed payment, with the grace window remaining", () => {
    const pastDue = entitlements({
      status: "past_due",
      grace_ends_at: "2026-08-09T12:00:00.000Z",
    });
    expect(getBillingNotice(pastDue, NOW)).toEqual({ kind: "payment_failed", daysRemaining: 5 });
  });

  it("tells a cancelled dealership how long access lasts", () => {
    const cancelled = entitlements({
      status: "cancelled",
      cancel_at_period_end: true,
      current_period_end: "2026-08-14T12:00:00.000Z",
    });
    expect(getBillingNotice(cancelled, NOW)).toEqual({ kind: "cancelled", daysRemaining: 10 });
  });

  it("read-only outranks every other notice", () => {
    // Once access is gone, "your trial ends in 2 days" would be both wrong
    // and confusing - the lockout is the only thing worth saying.
    const lapsed = entitlements({
      status: "lapsed",
      access: "read_only",
      trial_ends_at: "2026-08-06T12:00:00.000Z",
    });
    expect(getBillingNotice(lapsed, NOW)).toEqual({ kind: "read_only" });
  });

  it("says nothing when entitlements are unavailable", () => {
    expect(getBillingNotice(null, NOW)).toEqual({ kind: "none" });
  });
});

describe("isReadOnlyError", () => {
  it("recognizes the trigger's error regardless of Postgres wrapping", () => {
    expect(isReadOnlyError({ message: 'SUBSCRIPTION_READ_ONLY: this dealership...' })).toBe(true);
    expect(isReadOnlyError("SUBSCRIPTION_READ_ONLY: ...")).toBe(true);
  });

  it("does not swallow unrelated database errors", () => {
    expect(isReadOnlyError({ message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isReadOnlyError(null)).toBe(false);
    expect(isReadOnlyError(undefined)).toBe(false);
  });
});

describe("isPlanLockedIn", () => {
  it("lets a trialing dealer subscribe to the plan they are trialing", () => {
    // The regression this exists for: start_org_trial() assigns every new
    // org a plan, so "current plan" during a trial is exactly the plan they
    // need to buy. Locking it stranded every new signup.
    expect(isPlanLockedIn("trialing", "growth", "growth")).toBe(false);
  });

  it("lets a lapsed or cancelled dealer re-subscribe to their old plan", () => {
    // This is the recovery path out of read-only.
    expect(isPlanLockedIn("lapsed", "growth", "growth")).toBe(false);
    expect(isPlanLockedIn("cancelled", "growth", "growth")).toBe(false);
    expect(isPlanLockedIn("past_due", "growth", "growth")).toBe(false);
  });

  it("locks the plan the org is genuinely paying for", () => {
    expect(isPlanLockedIn("active", "growth", "growth")).toBe(true);
    expect(isPlanLockedIn("comped", "growth", "growth")).toBe(true);
  });

  it("never locks a different plan, so upgrades stay available", () => {
    expect(isPlanLockedIn("active", "starter", "growth")).toBe(false);
    expect(isPlanLockedIn("comped", "enterprise", "growth")).toBe(false);
  });

  it("never locks when the org has no plan at all", () => {
    expect(isPlanLockedIn("trialing", "growth", null)).toBe(false);
    expect(isPlanLockedIn(null, "growth", undefined)).toBe(false);
  });
});

describe("formatPaise", () => {
  it("renders paise as whole rupees", () => {
    // 4999_00 paise = ₹4,999 (exclusive of GST, as stored).
    expect(formatPaise(499900)).toContain("4,999");
  });

  it("returns null for an unpriced plan rather than ₹0", () => {
    // Prices seed as NULL until commercial terms are set; showing "₹0"
    // would advertise a free plan that does not exist.
    expect(formatPaise(null)).toBeNull();
    expect(formatPaise(undefined)).toBeNull();
  });
});
