// Thin Razorpay REST client - only the calls this product needs.
//
// Auth is HTTP Basic with key_id:key_secret (Razorpay does not use bearer
// tokens or request signing for its REST API; the only HMAC in this
// integration is on webhooks - see signature.ts).
//
// Every call returns a discriminated result rather than throwing, matching
// the google-business/post.ts shape, so callers can distinguish
// "not configured yet" from "Razorpay said no" and record the difference.

import { isConfigured, type RazorpayConfig } from "./config.ts";

export type RazorpayResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "api_error"; error: string; status?: number };

export interface RazorpayPlan {
  id: string;
  period: string;
  interval: number;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  short_url?: string;
  notes?: Record<string, string>;
}

function authHeader(config: RazorpayConfig): string {
  return `Basic ${btoa(`${config.keyId}:${config.keySecret}`)}`;
}

async function request<T>(
  config: RazorpayConfig,
  path: string,
  init: { method: string; body?: unknown },
): Promise<RazorpayResult<T>> {
  if (!isConfigured(config)) {
    return { ok: false, reason: "not_configured" };
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: authHeader(config),
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      error: `Network error calling Razorpay: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const text = await response.text();
  if (!response.ok) {
    // Razorpay errors look like { error: { code, description, ... } }.
    let description = text;
    try {
      const parsed = JSON.parse(text);
      description = parsed?.error?.description ?? text;
    } catch {
      // Non-JSON error body - keep the raw text.
    }
    return { ok: false, reason: "api_error", error: description, status: response.status };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: "api_error", error: "Razorpay returned a non-JSON success body" };
  }
}

/**
 * Razorpay plans are immutable and priced at creation. We create one per
 * (our plan, billing cycle) and cache its id on subscription_plans, so a
 * dealer subscribing to the same tier reuses it rather than creating a
 * duplicate plan on every checkout.
 */
export function createPlan(
  config: RazorpayConfig,
  params: {
    name: string;
    description: string;
    amountPaise: number;
    cycle: "monthly" | "annual";
  },
): Promise<RazorpayResult<RazorpayPlan>> {
  return request<RazorpayPlan>(config, "/plans", {
    method: "POST",
    body: {
      // Razorpay's own vocabulary is "yearly", ours is "annual".
      period: params.cycle === "annual" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: params.name,
        description: params.description,
        // Paise, exclusive of GST - matches how the DB stores it.
        amount: params.amountPaise,
        currency: "INR",
      },
    },
  });
}

/**
 * total_count is how many cycles Razorpay will bill before the
 * subscription completes on its own. Razorpay requires it, so "forever"
 * is expressed as a long horizon (10 years) rather than being omitted;
 * a dealer who stays that long gets re-subscribed, which is a far better
 * failure than a mandate that silently stops.
 */
const TOTAL_COUNT: Record<"monthly" | "annual", number> = {
  monthly: 120,
  annual: 10,
};

export function createSubscription(
  config: RazorpayConfig,
  params: {
    razorpayPlanId: string;
    cycle: "monthly" | "annual";
    orgId: string;
    planCode: string;
    notifyEmail?: string | null;
  },
): Promise<RazorpayResult<RazorpaySubscription>> {
  return request<RazorpaySubscription>(config, "/subscriptions", {
    method: "POST",
    body: {
      plan_id: params.razorpayPlanId,
      total_count: TOTAL_COUNT[params.cycle],
      quantity: 1,
      // Razorpay sends its own mandate/payment emails and SMS.
      customer_notify: 1,
      // `notes` is the only field that survives the whole Razorpay
      // lifecycle and comes back on every webhook, so the org id is
      // carried here. It is a convenience for reconciliation only -
      // the webhook resolves the org by razorpay_subscription_id
      // against our own table, never by trusting these notes.
      notes: {
        org_id: params.orgId,
        plan_code: params.planCode,
      },
    },
  });
}

export function cancelSubscription(
  config: RazorpayConfig,
  params: { razorpaySubscriptionId: string; atCycleEnd: boolean },
): Promise<RazorpayResult<RazorpaySubscription>> {
  return request<RazorpaySubscription>(
    config,
    `/subscriptions/${params.razorpaySubscriptionId}/cancel`,
    {
      method: "POST",
      // 1 = keep serving until the paid period ends (what "cancel
      // anytime, keep access until the end of the cycle" on the pricing
      // page promises). 0 = terminate immediately.
      body: { cancel_at_cycle_end: params.atCycleEnd ? 1 : 0 },
    },
  );
}

export function fetchSubscription(
  config: RazorpayConfig,
  razorpaySubscriptionId: string,
): Promise<RazorpayResult<RazorpaySubscription>> {
  return request<RazorpaySubscription>(config, `/subscriptions/${razorpaySubscriptionId}`, {
    method: "GET",
  });
}
