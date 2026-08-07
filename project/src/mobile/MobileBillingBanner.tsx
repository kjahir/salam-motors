import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { useEntitlements } from "@/lib/useEntitlements";
import { getBillingNotice } from "@/lib/entitlements";

/**
 * Mobile counterpart of components/BillingBanner.tsx. A separate component
 * on purpose: mobile has its own token vocabulary (mobile.*) and its own
 * component tree - see CLAUDE.md. The billing LOGIC is shared
 * (getBillingNotice); only the presentation differs.
 *
 * There is no "Manage billing" action here: the Billing screen is desktop
 * only for now, so this states the situation rather than offering a button
 * that would go nowhere.
 */
export function MobileBillingBanner() {
  const { t } = useTranslation();
  const { entitlements } = useEntitlements();
  const notice = getBillingNotice(entitlements);

  if (notice.kind === "none") return null;

  const styles = {
    read_only: {
      wrapper: "bg-mobile-error-bg",
      title: "text-mobile-error",
      icon: <Lock size={16} className="text-mobile-error" />,
    },
    payment_failed: {
      wrapper: "bg-mobile-warning-bg",
      title: "text-mobile-warning",
      icon: <AlertTriangle size={16} className="text-mobile-warning" />,
    },
    // These two sit on the mobile page background, so they need a card
    // surface + border to read as a distinct element rather than blending in.
    cancelled: {
      wrapper: "bg-mobile-card border border-mobile-border",
      title: "text-mobile-text",
      icon: <Clock size={16} className="text-mobile-text-secondary" />,
    },
    trial_ending: {
      wrapper: "bg-mobile-card border border-mobile-border",
      title: "text-mobile-navy",
      icon: <Clock size={16} className="text-mobile-navy" />,
    },
  }[notice.kind];

  const body =
    notice.kind === "read_only"
      ? t("billing.banner.read_only.body")
      : t(`billing.banner.${notice.kind}.body`, { count: notice.daysRemaining });

  return (
    <div role="status" className={`mx-4 mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 ${styles.wrapper}`}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${styles.title}`}>
          {t(`billing.banner.${notice.kind}.title`)}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-mobile-text-secondary">{body}</p>
      </div>
    </div>
  );
}
