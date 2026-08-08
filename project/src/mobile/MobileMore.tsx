import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bell, FileBarChart, History as HistoryIcon, ScrollText, ShieldCheck, UserCog, Users, Wallet } from "lucide-react";
import { MoreButton } from "./ui/primitives";
import { usePermissions } from "@/lib/usePermissions";
import type { PageKey } from "@/components/Layout";
import type { MobileNavigate, MobileScreen } from "./MobileApp";

/**
 * Everything the desktop sidebar reaches that the three other bottom-nav tabs do not. Each
 * button opens the same page component the desktop renders (wrapped in MobileDesktopPage), so
 * there is one implementation of Parties/Team/Audit/etc. rather than a mobile fork that
 * would drift. Icon-only and no background by design: Bill, Passport, Social Media Add,
 * eSign and eStamp are all landing here too, and a growing list of full-width rows would
 * outgrow the screen fast.
 *
 * `page` is the desktop PageKey the button's permission is checked against - these screens
 * are gated by the desktop role matrix (PAGE_ACCESS), not the mobile one, because they
 * *are* the desktop screens.
 *
 * `vehicleScoped: false` marks the entries that operate across the whole dealership rather
 * than one vehicle - those grey out while Bottom Bar V2 has a vehicle selected, same as the
 * Dashboard's own More row.
 */
const MORE_ITEMS: { screen: MobileScreen; page: PageKey; labelKey: string; icon: ReactNode; color: string; vehicleScoped?: false }[] = [
  // Reports moved here once the AI assistant took its bottom-bar slot.
  { screen: "reports", page: "finance", labelKey: "nav.reports", icon: <FileBarChart size={22} />, color: "text-mobile-primary" },
  { screen: "alerts", page: "alerts", labelKey: "nav.alerts", icon: <Bell size={22} />, color: "text-mobile-error" },
  { screen: "parties", page: "parties", labelKey: "nav.parties", icon: <Users size={22} />, color: "text-mobile-primary", vehicleScoped: false },
  { screen: "partners", page: "partners", labelKey: "nav.partners", icon: <Wallet size={22} />, color: "text-mobile-success", vehicleScoped: false },
  { screen: "team", page: "team", labelKey: "nav.team", icon: <UserCog size={22} />, color: "text-mobile-navy", vehicleScoped: false },
  { screen: "policies", page: "policies", labelKey: "nav.policies", icon: <ShieldCheck size={22} />, color: "text-mobile-warning" },
  { screen: "history", page: "history", labelKey: "nav.history", icon: <HistoryIcon size={22} />, color: "text-mobile-purple" },
  { screen: "audit", page: "audit", labelKey: "nav.audit", icon: <ScrollText size={22} />, color: "text-mobile-text-secondary" },
];

export function MobileMore({ onNavigate, selectedVehicleId }: {
  onNavigate: MobileNavigate;
  selectedVehicleId?: string | null;
}) {
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

      <div className="px-4 pt-4 pb-8">
        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <MoreButton
              key={item.screen}
              icon={item.icon}
              color={item.color}
              label={t(item.labelKey)}
              onClick={() => onNavigate(item.screen)}
              disabled={item.vehicleScoped === false && !!selectedVehicleId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
