// Dealer-initiated subscription actions: start a subscription, or cancel
// one. Both live here rather than in two functions because they share the
// same authorization path (must be the org's `owner`) and the same org
// resolution - splitting them would duplicate that and give two places to
// get "who may change billing" wrong.
//
// This function NEVER marks an org as paid. It creates the Razorpay
// subscription and records its id; the org's access only changes when a
// signature-verified webhook arrives at billing-webhook. That separation
// is deliberate - the browser telling us "I paid" is not evidence, and
// treating it as evidence is the classic way to give away a SaaS product.
//
// No merchant credentials exist yet: with RAZORPAY_* unset this returns
// HTTP 503 with reason "not_configured" instead of pretending to have
// created a subscription (same pattern as post-vehicle-ad / Protean).
//
// Auth model mirrors post-vehicle-ad: a caller-scoped client (the
// requester's own JWT, RLS applies) authorizes the request; the writes
// afterwards use the service role, because org_subscriptions deliberately
// has no user-facing INSERT/UPDATE policy - a dealer must not be able to
// set their own status to 'active'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isConfigured, loadRazorpayConfig, NOT_CONFIGURED_MESSAGE } from "../_shared/razorpay/config.ts";
import { cancelSubscription, createPlan, createSubscription } from "../_shared/razorpay/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Changing a subscription is an owner-only act. Managers can run the
// dealership day to day; committing the business to a recurring payment
// is not part of that.
const BILLING_ROLES = ["owner"];

type BillingCycle = "monthly" | "annual";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: string; org_id?: string; plan_code?: string; billing_cycle?: string }
    | null;
  if (!body || typeof body.org_id !== "string") {
    return json({ error: "org_id is required" }, 400);
  }
  const action = body.action ?? "create";
  if (action !== "create" && action !== "cancel") {
    return json({ error: "action must be 'create' or 'cancel'" }, 400);
  }

  // RLS-scoped: only resolves if the caller is an active member.
  const { data: membership } = await callerClient
    .from("memberships")
    .select("role, status, email")
    .eq("org_id", body.org_id)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || !BILLING_ROLES.includes(membership.role)) {
    return json({ error: "Only the dealership owner can change the subscription" }, 403);
  }

  const config = loadRazorpayConfig();
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: subscription } = await admin
    .from("org_subscriptions")
    .select("id, plan_id, status, billing_cycle, razorpay_subscription_id, current_period_end")
    .eq("org_id", body.org_id)
    .maybeSingle();

  // ============================================================
  // Cancel
  // ============================================================
  if (action === "cancel") {
    if (!subscription?.razorpay_subscription_id) {
      return json({ error: "There is no active Razorpay subscription to cancel" }, 409);
    }
    if (!isConfigured(config)) {
      return json({ error: NOT_CONFIGURED_MESSAGE, reason: "not_configured" }, 503);
    }

    // cancel_at_cycle_end: the pricing page promises "you'll retain access
    // until the end of the current billing period", so we never terminate
    // a paid period the dealer has already paid for.
    const result = await cancelSubscription(config, {
      razorpaySubscriptionId: subscription.razorpay_subscription_id,
      atCycleEnd: true,
    });
    if (!result.ok) {
      if (result.reason === "not_configured") {
        return json({ error: NOT_CONFIGURED_MESSAGE, reason: "not_configured" }, 503);
      }
      return json({ error: `Razorpay could not cancel the subscription: ${result.error}` }, 502);
    }

    // Reflect the intent immediately so the Billing page is honest before
    // the webhook lands. Access is NOT revoked here - org_entitlements()
    // keeps 'cancelled' at full access until current_period_end passes.
    await admin
      .from("org_subscriptions")
      .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("org_id", body.org_id);

    return json({
      ok: true,
      action: "cancel",
      cancel_at_period_end: true,
      access_until: subscription.current_period_end,
    });
  }

  // ============================================================
  // Create
  // ============================================================
  const cycle = body.billing_cycle as BillingCycle | undefined;
  if (cycle !== "monthly" && cycle !== "annual") {
    return json({ error: "billing_cycle must be 'monthly' or 'annual'" }, 400);
  }
  if (typeof body.plan_code !== "string") {
    return json({ error: "plan_code is required" }, 400);
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select(
      "id, code, name, tagline, is_self_serve, is_active, monthly_price_paise, annual_price_paise, razorpay_plan_id_monthly, razorpay_plan_id_annual",
    )
    .eq("code", body.plan_code)
    .maybeSingle();
  if (!plan || !plan.is_active) {
    return json({ error: "Unknown or inactive plan" }, 404);
  }
  if (!plan.is_self_serve) {
    return json(
      { error: "This plan is arranged with our sales team and cannot be started online", reason: "contact_sales" },
      409,
    );
  }

  const amountPaise = cycle === "annual" ? plan.annual_price_paise : plan.monthly_price_paise;
  if (amountPaise === null || amountPaise === undefined) {
    // Prices seed as NULL until commercial terms are set - see the
    // migration header. Refusing here is what stops a dealer being
    // charged an amount nobody has agreed to.
    return json(
      {
        error: `The ${plan.name} plan does not have a ${cycle} price set yet.`,
        reason: "price_not_set",
      },
      409,
    );
  }

  if (!isConfigured(config)) {
    return json({ error: NOT_CONFIGURED_MESSAGE, reason: "not_configured" }, 503);
  }

  // Reuse the cached Razorpay plan id for this (plan, cycle), creating it
  // on first use. Razorpay plans are immutable, so this is safe to cache
  // indefinitely; a price change creates a new plan id (see client.ts).
  const cachedColumn = cycle === "annual" ? "razorpay_plan_id_annual" : "razorpay_plan_id_monthly";
  let razorpayPlanId = cycle === "annual" ? plan.razorpay_plan_id_annual : plan.razorpay_plan_id_monthly;

  if (!razorpayPlanId) {
    const planResult = await createPlan(config, {
      name: `${plan.name} (${cycle})`,
      description: plan.tagline ?? plan.name,
      amountPaise,
      cycle,
    });
    if (!planResult.ok) {
      if (planResult.reason === "not_configured") {
        return json({ error: NOT_CONFIGURED_MESSAGE, reason: "not_configured" }, 503);
      }
      return json({ error: `Razorpay could not create the plan: ${planResult.error}` }, 502);
    }
    razorpayPlanId = planResult.data.id;

    const { error: cacheErr } = await admin
      .from("subscription_plans")
      .update({ [cachedColumn]: razorpayPlanId, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (cacheErr) {
      // Non-fatal: the subscription can still be created. Worst case we
      // create a duplicate Razorpay plan next time, which is untidy but
      // harmless - it does not double-charge anyone.
      console.error("billing-checkout: failed to cache razorpay plan id", cacheErr);
    }
  }

  const subResult = await createSubscription(config, {
    razorpayPlanId,
    cycle,
    orgId: body.org_id,
    planCode: plan.code,
    notifyEmail: membership.email,
  });
  if (!subResult.ok) {
    if (subResult.reason === "not_configured") {
      return json({ error: NOT_CONFIGURED_MESSAGE, reason: "not_configured" }, 503);
    }
    return json({ error: `Razorpay could not create the subscription: ${subResult.error}` }, 502);
  }

  // Record the pending subscription. Status is deliberately NOT set to
  // 'active' here - the org keeps whatever access it already had (trial,
  // comped, lapsed) until billing-webhook confirms a real charge.
  const { error: updateErr } = await admin
    .from("org_subscriptions")
    .update({
      plan_id: plan.id,
      billing_cycle: cycle,
      razorpay_subscription_id: subResult.data.id,
      cancel_at_period_end: false,
      cancelled_at: null,
      last_payment_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", body.org_id);
  if (updateErr) {
    console.error("billing-checkout: failed to record subscription", updateErr);
    return json({ error: "Subscription was created at Razorpay but could not be recorded" }, 500);
  }

  // key_id is publishable - it is what Razorpay Checkout needs in the
  // browser. key_secret never leaves this function.
  return json({
    ok: true,
    action: "create",
    razorpay_subscription_id: subResult.data.id,
    razorpay_key_id: config.keyId,
    plan_code: plan.code,
    plan_name: plan.name,
    billing_cycle: cycle,
    amount_paise: amountPaise,
    short_url: subResult.data.short_url ?? null,
  });
});
