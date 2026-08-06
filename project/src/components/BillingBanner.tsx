import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { useEntitlements } from "@/lib/useEntitlements";
import { getBillingNotice, isFeatureAvailable } from "@/lib/entitlements";
import type { PageKey } from "@/components/Layout";

/**
 * Desktop billing banner. Renders nothing in the healthy case, so it can
 * sit unconditionally at the top of the layout.
 *
 * Read-only is the loudest state but still deliberately non-blocking: a
 * dealership that cannot pay must keep full read access to its own
 * records, so this never becomes a modal or an interstitial.
 */
export function BillingBanner({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const { t } = useTranslation();
  const { entitlements } = useEntitlements();
  const notice = getBillingNotice(entitlements);

  if (notice.kind === "none") return null;

  const styles = {
    read_only: {
      wrapper: "border-red-200 bg-red-50",
      text: "text-red-900",
      body: "text-red-700",
      icon: <Lock size={16} className="text-red-600" />,
    },
    payment_failed: {
      wrapper: "border-amber-200 bg-amber-50",
      text: "text-amber-900",
      body: "text-amber-700",
      icon: <AlertTriangle size={16} className="text-amber-600" />,
    },
    cancelled: {
      wrapper: "border-slate-200 bg-slate-50",
      text: "text-slate-900",
      body: "text-slate-600",
      icon: <Clock size={16} className="text-slate-500" />,
    },
    trial_ending: {
      wrapper: "border-brand-200 bg-brand-50",
      text: "text-brand-900",
      body: "text-brand-700",
      icon: <Clock size={16} className="text-brand-600" />,
    },
  }[notice.kind];

  const title = t(`billing.banner.${notice.kind}.title`);
  const body =
    notice.kind === "read_only"
      ? t("billing.banner.read_only.body")
      : t(`billing.banner.${notice.kind}.body`, { count: notice.daysRemaining });

  return (
    <div
      role="status"
      className={`mx-6 mt-6 flex items-start gap-3 rounded-xl border px-4 py-3 ${styles.wrapper}`}
    >
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${styles.text}`}>{title}</p>
        <p className={`mt-0.5 text-sm ${styles.body}`}>{body}</p>
      </div>
      {onNavigate && isFeatureAvailable(entitlements, "billing") && (
        <button
          type="button"
          onClick={() => onNavigate("billing")}
          className="btn-primary btn-sm shrink-0"
        >
          {t("billing.banner.action")}
        </button>
      )}
    </div>
  );
}
