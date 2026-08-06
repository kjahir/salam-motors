// Env/secret loading for Razorpay Subscriptions (+ UPI AutoPay).
//
// No merchant account exists yet - RAZORPAY_* are provisioned-but-empty
// Supabase secrets, exactly the pattern used for PROTEAN_* and
// GOOGLE_BUSINESS_PROFILE_*. isConfigured() gates real API calls; every
// caller reports a `not_configured` outcome rather than pretending a
// subscription was created. It starts working the moment real values are
// set, with no code change.
//
// Key id/secret are the API credentials. The webhook secret is SEPARATE
// (set independently in the Razorpay dashboard when registering the
// webhook URL) and is only used to verify inbound webhook signatures -
// never to sign outbound calls.

export interface RazorpayConfig {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  /** "test" or "live" - informational; the key id itself encodes the mode. */
  environment: string;
  apiBaseUrl: string;
}

function env(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

export function loadRazorpayConfig(): RazorpayConfig {
  return {
    keyId: env("RAZORPAY_KEY_ID") ?? null,
    keySecret: env("RAZORPAY_KEY_SECRET") ?? null,
    webhookSecret: env("RAZORPAY_WEBHOOK_SECRET") ?? null,
    environment: env("RAZORPAY_ENV") ?? "test",
    apiBaseUrl: env("RAZORPAY_API_BASE_URL") ?? "https://api.razorpay.com/v1",
  };
}

/** True when outbound Razorpay API calls can actually be made. */
export function isConfigured(config: RazorpayConfig): boolean {
  return Boolean(config.keyId && config.keySecret);
}

/**
 * True when inbound webhooks can be verified. Checked separately from
 * isConfigured(): a webhook can legitimately arrive on an instance whose
 * API keys are set but whose webhook secret is not, and processing an
 * UNVERIFIED billing event would let anyone who can reach the URL mark
 * any org as paid. Absent secret must fail closed.
 */
export function canVerifyWebhooks(config: RazorpayConfig): boolean {
  return Boolean(config.webhookSecret);
}

export const NOT_CONFIGURED_MESSAGE =
  "Razorpay is not configured on this environment yet (RAZORPAY_* secrets are placeholders). No subscription was created and no money moved.";
