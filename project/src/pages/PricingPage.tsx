import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPaise } from "@/lib/entitlements";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { APP_ENTRY_HREF } from "@/components/marketing/constants";
import { Badge } from "@/components/ui/Badge";

type BillingCycle = "monthly" | "annual";

interface Tier {
  /** Matches subscription_plans.code - how a card finds its live price. */
  code: string;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  cta: { label: string; href: string; external?: boolean };
  popular?: boolean;
  features: string[];
}

/** The priced part of a plan, read live from the public catalog. */
interface PlanPrice {
  code: string;
  monthly_price_paise: number | null;
  annual_price_paise: number | null;
}

// Feature bullets stay in code - they are marketing copy, not billing data.
// PRICES do not: they come from the subscription_plans table below, so
// setting a real price is a data change rather than a redeploy. Until one is
// set the card falls back to the "₹—" placeholder this page has always shown.
const TIERS: Tier[] = [
  {
    code: "starter",
    name: "Starter",
    tagline: "For a single dealership getting off spreadsheets",
    price: "₹—",
    priceNote: "/mo + 18% GST",
    cta: { label: "Start free trial", href: APP_ENTRY_HREF },
    features: [
      "Vehicle inventory & lifecycle tracking",
      "Vehicle Passport (shareable, verifiable)",
      "Basic compliance alerts",
      "Up to — vehicles in active inventory", // TODO: real tier limit
      "Email support",
    ],
  },
  {
    code: "growth",
    name: "Growth",
    tagline: "For dealerships managing finance & investment partners",
    price: "₹—",
    priceNote: "/mo + 18% GST",
    cta: { label: "Start free trial", href: APP_ENTRY_HREF },
    popular: true,
    features: [
      "Everything in Starter",
      "Finance & partner investment tracking",
      "Full compliance rule engine & automated alerts",
      "Ask Salam AI assistant",
      "Unlimited Vehicle Passports",
      "Priority support",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    tagline: "For multi-location dealer groups & networks",
    price: "Custom",
    priceNote: "talk to sales",
    cta: { label: "Contact sales", href: "mailto:sales@vahanexchange.in", external: true },
    features: [
      "Everything in Growth",
      "Multiple organizations & role-based team management",
      "Dedicated onboarding",
      "Custom SLAs & support",
    ],
  },
];

const FAQS = [
  {
    q: "How does billing work?",
    // TODO: confirm final billing-cycle mechanics once Razorpay Subscriptions is wired up.
    a: "Starter and Growth plans are billed monthly or annually via UPI AutoPay or card. Enterprise plans are billed on custom terms agreed with our sales team.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Self-serve plans can be cancelled at any time from your account; you'll retain access until the end of the current billing period.",
  },
  {
    q: "Is GST included in the prices shown?",
    a: "Prices shown are exclusive of GST. 18% GST is added at checkout in accordance with Indian tax regulations, and a GST-compliant invoice is issued for every payment.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes. Starter and Growth plans start with a free trial — no credit card required to sign up and create your dealership.",
  },
];

export function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, PlanPrice>>({});

  // The catalog is readable by anonymous visitors (see the
  // public_read_active_plans RLS policy) precisely so this page can show
  // live prices without a login. A failure here is silent: the cards fall
  // back to their placeholder, which is strictly better than an error
  // banner on a marketing page.
  useEffect(() => {
    let active = true;
    void supabase
      .from("subscription_plans")
      .select("code, monthly_price_paise, annual_price_paise")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!active || !data) return;
        setPrices(Object.fromEntries((data as PlanPrice[]).map((p) => [p.code, p])));
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Live price for a tier, or null when it is unpriced or not self-serve.
   * Enterprise deliberately keeps its hardcoded "Custom" copy.
   */
  const priceFor = (tier: Tier): string | null => {
    const row = prices[tier.code];
    if (!row) return null;
    return formatPaise(cycle === "annual" ? row.annual_price_paise : row.monthly_price_paise);
  };

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Simple, transparent pricing</h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Pick a plan that fits your dealership. Upgrade anytime as you grow.
          </p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-inset ring-white/20">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                cycle === "monthly" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                cycle === "annual" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              Annual
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {cycle === "monthly" ? "Billed monthly." : "Billed annually."} {/* TODO: real annual discount, once pricing is finalized */}
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-card ${
                  tier.popular ? "border-2 border-brand-500" : "border border-slate-200"
                }`}
              >
                {tier.popular && (
                  <Badge color="brand" className="absolute -top-3 left-7">
                    Most popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{tier.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{tier.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-slate-900">
                    {priceFor(tier) ?? tier.price}
                  </span>
                  <span className="text-sm text-slate-500">
                    {priceFor(tier)
                      ? `${cycle === "annual" ? "/yr" : "/mo"} + 18% GST`
                      : tier.priceNote}
                  </span>
                </div>

                <a
                  href={tier.cta.href}
                  className={`mt-6 flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tier.popular
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tier.cta.label}
                </a>

                <ul className="mt-7 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={15} className="mt-0.5 shrink-0 text-accent-600" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-2xl text-center">
            <p className="text-sm text-slate-600">
              Pay via UPI AutoPay or card, powered by Razorpay. Subscriptions renew automatically each billing
              cycle until cancelled.
            </p>
            {/*
              Razorpay Subscriptions / UPI AutoPay is implemented, but NOT on this page, and that is
              deliberate: a subscription is attached to an organization, and a signed-out visitor does
              not have one yet. So the CTAs here go to signup; the dealer creates their dealership,
              lands on a 14-day trial, and subscribes from Settings > Billing (src/pages/Billing.tsx),
              which calls the billing-checkout Edge Function and opens Razorpay Checkout in
              subscription mode. Access only changes when the signature-verified billing-webhook
              confirms the charge.

              Prices above are read live from the subscription_plans table. They render as "₹—" until
              a real price is set there - no merchant credentials or commercial terms exist yet, so
              checkout currently returns "not configured" rather than charging anyone.
            */}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-slate-900">{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && <p className="px-5 pb-4 text-sm text-slate-600">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
