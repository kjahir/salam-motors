import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, CreditCard } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useEntitlements } from "@/lib/useEntitlements";
import { formatPaise, isPlanLockedIn, type SubscriptionStatus } from "@/lib/entitlements";

interface PlanRow {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  is_self_serve: boolean;
  monthly_price_paise: number | null;
  annual_price_paise: number | null;
  sort_order: number;
}

interface PaymentRow {
  id: string;
  event_type: string;
  amount_paise: number | null;
  created_at: string;
}

type BillingCycle = "monthly" | "annual";

const STATUS_COLORS: Record<SubscriptionStatus, "green" | "amber" | "red" | "slate" | "blue"> = {
  active: "green",
  comped: "green",
  trialing: "blue",
  past_due: "amber",
  cancelled: "slate",
  lapsed: "red",
};

/**
 * Razorpay Checkout is loaded on demand rather than in index.html - it is
 * a third-party script that only the owner, only on this screen, ever
 * needs. Resolves false if the script cannot be fetched so the caller can
 * report a real error instead of hanging on a missing global.
 */
function loadRazorpayCheckout(): Promise<boolean> {
  const SRC = "https://checkout.razorpay.com/v1/checkout.js";
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function Billing() {
  const { t, i18n } = useTranslation();
  const { orgId, role, orgName } = useAuth();
  const { entitlements, loading: entitlementsLoading, refresh } = useEntitlements();
  const { toast } = useToast();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isOwner = role === "owner";

  const formatDate = useCallback(
    (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString(i18n.language, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—",
    [i18n.language],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [planResult, paymentResult] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("id, code, name, tagline, is_self_serve, monthly_price_paise, annual_price_paise, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      // Payment history comes from the verified webhook ledger, not from
      // Razorpay's API - it is the record we can show even if Razorpay is
      // unreachable, and it is what our own billing state was derived from.
      supabase
        .from("billing_events")
        .select("id, event_type, amount_paise, created_at")
        .eq("event_type", "subscription.charged")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    setPlans((planResult.data as PlanRow[]) ?? []);
    setPayments((paymentResult.data as PaymentRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubscribe = async (plan: PlanRow) => {
    if (!orgId) return;
    setBusyPlan(plan.code);
    try {
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: { action: "create", org_id: orgId, plan_code: plan.code, billing_cycle: cycle },
      });
      if (error) throw error;

      const response = data as {
        razorpay_subscription_id?: string;
        razorpay_key_id?: string;
        error?: string;
        reason?: string;
      };
      if (response?.reason === "not_configured") {
        toast(t("billing.errors.notConfigured"), "error");
        return;
      }
      if (response?.reason === "price_not_set") {
        toast(t("billing.errors.priceNotSet", { plan: plan.name }), "error");
        return;
      }
      if (!response?.razorpay_subscription_id || !response.razorpay_key_id) {
        throw new Error(response?.error ?? t("billing.errors.checkoutFailed"));
      }

      const ready = await loadRazorpayCheckout();
      if (!ready) {
        toast(t("billing.errors.checkoutScript"), "error");
        return;
      }

      const RazorpayCtor = (window as unknown as { Razorpay: new (options: unknown) => { open: () => void } })
        .Razorpay;
      const checkout = new RazorpayCtor({
        key: response.razorpay_key_id,
        subscription_id: response.razorpay_subscription_id,
        name: orgName ?? t("app.name"),
        description: t("billing.checkoutDescription", { plan: plan.name }),
        // Access is NOT granted here. The subscription only becomes active
        // when the signature-verified webhook lands, so this handler just
        // re-reads whatever the server has decided by now.
        handler: async () => {
          toast(t("billing.paymentReceived"), "success");
          await refresh();
          await load();
        },
        modal: {
          ondismiss: () => toast(t("billing.checkoutDismissed"), "info"),
        },
        theme: { color: "#2563eb" },
      });
      checkout.open();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("billing.errors.checkoutFailed"), "error");
    } finally {
      setBusyPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!orgId) return;
    if (!window.confirm(t("billing.confirmCancel"))) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: { action: "cancel", org_id: orgId },
      });
      if (error) throw error;
      const response = data as { reason?: string; error?: string };
      if (response?.reason === "not_configured") {
        toast(t("billing.errors.notConfigured"), "error");
        return;
      }
      toast(t("billing.cancelScheduled"), "success");
      await refresh();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("billing.errors.cancelFailed"), "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading || entitlementsLoading) {
    return (
      <div className="p-6">
        <PageHeader title={t("billing.title")} />
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  const status = entitlements?.status ?? null;
  const currentPlanCode = entitlements?.plan_code ?? null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
        icon={<CreditCard size={20} />}
      />

      {!isOwner && (
        <Card className="mb-4 p-4">
          <p className="text-sm text-slate-600">{t("billing.ownerOnly")}</p>
        </Card>
      )}

      {/* Current subscription */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="stat-label">{t("billing.currentPlan")}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {entitlements?.plan_name ?? t("billing.noPlan")}
            </p>
          </div>
          {status && (
            <Badge color={STATUS_COLORS[status]}>{t(`billing.status.${status}`)}</Badge>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {status === "trialing" && (
            <div>
              <dt className="stat-label">{t("billing.trialEnds")}</dt>
              <dd className="text-sm text-slate-900">{formatDate(entitlements?.trial_ends_at ?? null)}</dd>
            </div>
          )}
          {entitlements?.current_period_end && (
            <div>
              <dt className="stat-label">
                {entitlements.cancel_at_period_end ? t("billing.accessUntil") : t("billing.renewsOn")}
              </dt>
              <dd className="text-sm text-slate-900">{formatDate(entitlements.current_period_end)}</dd>
            </div>
          )}
          {status === "past_due" && entitlements?.grace_ends_at && (
            <div>
              <dt className="stat-label">{t("billing.graceEnds")}</dt>
              <dd className="text-sm text-slate-900">{formatDate(entitlements.grace_ends_at)}</dd>
            </div>
          )}
          {entitlements?.billing_cycle && (
            <div>
              <dt className="stat-label">{t("billing.billingCycle")}</dt>
              <dd className="text-sm text-slate-900">{t(`billing.cycle.${entitlements.billing_cycle}`)}</dd>
            </div>
          )}
        </dl>

        {isOwner && entitlements && !entitlements.cancel_at_period_end &&
          (status === "active" || status === "past_due") && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-ghost btn-sm mt-4 text-red-600"
            >
              {cancelling ? t("common.saving") : t("billing.cancelSubscription")}
            </button>
          )}
      </Card>

      {/* Plan picker */}
      {isOwner && (
        <>
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{t("billing.choosePlan")}</h2>
            <div className="inline-flex rounded-pill border border-slate-200 p-0.5">
              {(["monthly", "annual"] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                    cycle === c ? "bg-brand-600 text-white" : "text-slate-600"
                  }`}
                >
                  {t(`billing.cycle.${c}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plans.map((plan) => {
              const price = cycle === "annual" ? plan.annual_price_paise : plan.monthly_price_paise;
              const formatted = formatPaise(price);
              const isCurrent = plan.code === currentPlanCode;
              const isLockedToPlan = isPlanLockedIn(status, plan.code, currentPlanCode);
              return (
                <Card key={plan.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{plan.name}</h3>
                    {isCurrent && <Badge color="brand">{t("billing.current")}</Badge>}
                  </div>
                  {plan.tagline && <p className="mt-1 text-xs text-slate-500">{plan.tagline}</p>}

                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {/* An unpriced plan shows a dash, never ₹0 - commercial
                        terms are still being set (see the migration header). */}
                    {formatted ?? "₹—"}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      {t(`billing.per.${cycle}`)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{t("billing.exGst")}</p>

                  <div className="flex-1" />

                  {plan.is_self_serve ? (
                    <button
                      type="button"
                      onClick={() => handleSubscribe(plan)}
                      disabled={busyPlan !== null || isLockedToPlan || price === null}
                      className="btn-primary btn-sm mt-4 w-full justify-center"
                    >
                      {busyPlan === plan.code ? (
                        <Spinner size={14} />
                      ) : isLockedToPlan ? (
                        <>
                          <Check size={14} /> {t("billing.current")}
                        </>
                      ) : (
                        t("billing.subscribe")
                      )}
                    </button>
                  ) : (
                    <a
                      href="mailto:sales@vahanexchange.in"
                      className="btn-secondary btn-sm mt-4 w-full justify-center"
                    >
                      {t("billing.contactSales")}
                    </a>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Payment history */}
      <h2 className="mt-8 text-base font-semibold text-slate-900">{t("billing.paymentHistory")}</h2>
      <Card className="mt-3 p-0">
        {payments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title={t("billing.noPayments")}
              description={t("billing.noPaymentsHint")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm text-slate-600">{formatDate(payment.created_at)}</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatPaise(payment.amount_paise) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
