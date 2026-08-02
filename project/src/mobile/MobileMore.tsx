import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bell, ChevronRight, History as HistoryIcon, ScrollText, ShieldCheck, UserCog, Users, Wallet } from "lucide-react";
import { Card } from "./ui/primitives";
import { usePermissions } from "@/lib/usePermissions";
import type { PageKey } from "@/components/Layout";
import type { MobileNavigate, MobileScreen } from "./MobileApp";

/**
 * Everything the desktop sidebar reaches that the three other bottom-nav tabs do not. Each
 * row opens the same page component the desktop renders (wrapped in MobileDesktopPage), so
 * there is one implementation of Parties/Team/Audit/etc. rather than a mobile fork that
 * would drift.
 *
 * `page` is the desktop PageKey the row's permission is checked against - these screens
 * are gated by the desktop role matrix (PAGE_ACCESS), not the mobile one, because they
 * *are* the desktop screens.
 */
const MORE_ITEMS: { screen: MobileScreen; page: PageKey; labelKey: string; icon: ReactNode }[] = [
  { screen: "alerts", page: "alerts", labelKey: "nav.alerts", icon: <Bell size={18} /> },
  { screen: "parties", page: "parties", labelKey: "nav.parties", icon: <Users size={18} /> },
  { screen: "partners", page: "partners", labelKey: "nav.partners", icon: <Wallet size={18} /> },
  { screen: "team", page: "team", labelKey: "nav.team", icon: <UserCog size={18} /> },
  { screen: "policies", page: "policies", labelKey: "nav.policies", icon: <ShieldCheck size={18} /> },
  { screen: "history", page: "history", labelKey: "nav.history", icon: <HistoryIcon size={18} /> },
  { screen: "audit", page: "audit", labelKey: "nav.audit", icon: <ScrollText size={18} /> },
];

export function MobileMore({ onNavigate }: { onNavigate: MobileNavigate }) {
  const { t } = useTranslation();
  const { canAccessPage } = usePermissions();
  const items = MORE_ITEMS.filter((item) => canAccessPage(item.page));

  return (
    <div>
      <div className="bg-mobile-navy text-white px-5 pt-6 pb-8">
        <p className="font-poppins text-[13px] font-medium uppercase tracking-wide text-white/70">Salam</p>
        <h1 className="font-poppins text-2xl font-bold mt-1">{t("mobileMore.title")}</h1>
        <p className="text-xs text-white/70 mt-1">{t("mobileMore.description")}</p>
      </div>

      <div className="px-4 -mt-4 pb-4 space-y-2">
        {items.map((item) => (
          <Card key={item.screen} className="px-4 py-3.5" onClick={() => onNavigate(item.screen)}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mobile-primary/10 text-mobile-primary">
                {item.icon}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-mobile-text">{t(item.labelKey)}</span>
              <ChevronRight size={16} className="shrink-0 text-mobile-text-muted" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
