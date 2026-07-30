import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike,
  Users,
  UserCircle,
  Bell,
  PlusCircle,
  Menu,
  X,
  LogOut,
  ChevronDown,
  History,
  ShieldCheck,
  LayoutDashboard,
  FileBarChart,
  UserCog,
  ScrollText,
  Receipt,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/useAuth";
import { usePermissions } from "@/lib/usePermissions";
import { ROLE_LABELS } from "@/lib/constants";

export type PageKey =
  | "dashboard"
  | "inventory"
  | "add-vehicle"
  | "manage-vehicles"
  | "quick-add-expense"
  | "quick-add-document"
  | "quick-add-inspection"
  | "quick-add-sale"
  | "view-vehicle"
  | "vehicle"
  | "parties"
  | "partners"
  | "finance"
  | "alerts"
  | "passport"
  | "history"
  | "policies"
  | "team"
  | "audit";

// The "Vehicles" group in the sidebar: a pure expand/collapse header (it is not itself a
// page) over the per-vehicle work screens. Each child is a full page with a vehicle-select
// dropdown at the top (src/components/VehicleSelectField.tsx), the desktop counterpart to
// the mobile "+" icon row's targets (src/mobile/MobileApp.tsx's ADD_TARGETS).
//
// "View Vehicle" and "Make Sales" are deliberately absent: viewing a vehicle is what
// clicking an Inventory row does, and selling starts from the Sell Vehicle button on the
// Dashboard and on the vehicle itself.
const VEHICLE_GROUP: { key: PageKey; labelKey: string; icon: ReactNode }[] = [
  { key: "manage-vehicles", labelKey: "nav.manageVehicles", icon: <PlusCircle size={15} /> },
  { key: "quick-add-expense", labelKey: "vehicleDetail.expenses", icon: <Receipt size={15} /> },
  { key: "quick-add-document", labelKey: "vehicleDetail.documents", icon: <FileText size={15} /> },
  { key: "quick-add-inspection", labelKey: "vehicleDetail.inspection", icon: <ClipboardCheck size={15} /> },
];

export interface NavigateParams {
  vehicleId?: string;
  historyVehicleId?: string;
  tab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
}

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
  alertCount?: number;
}

const navItems: { key: PageKey; labelKey: string; icon: ReactNode }[] = [
  { key: "dashboard", labelKey: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "inventory", labelKey: "nav.inventory", icon: <Bike size={18} /> },
  { key: "finance", labelKey: "nav.reports", icon: <FileBarChart size={18} /> },
  { key: "parties", labelKey: "nav.parties", icon: <UserCircle size={18} /> },
  { key: "partners", labelKey: "nav.partners", icon: <Users size={18} /> },
  { key: "alerts", labelKey: "nav.alerts", icon: <Bell size={18} /> },
  { key: "history", labelKey: "nav.history", icon: <History size={18} /> },
  { key: "policies", labelKey: "nav.policies", icon: <ShieldCheck size={18} /> },
  { key: "team", labelKey: "nav.team", icon: <UserCog size={18} /> },
  { key: "audit", labelKey: "nav.audit", icon: <ScrollText size={18} /> },
];

/** "vehicles" is the collapsible group above, not a page. */
type NavEntry = { key: PageKey } | { group: "vehicles" };

const navSections: NavEntry[][] = [
  [{ key: "dashboard" }, { group: "vehicles" }, { key: "inventory" }, { key: "finance" }],
  [{ key: "parties" }, { key: "partners" }],
  [{ key: "alerts" }, { key: "history" }, { key: "policies" }, { key: "team" }, { key: "audit" }],
];

const isGroup = (e: NavEntry): e is { group: "vehicles" } => "group" in e;

export function Layout({ current, onNavigate, children, alertCount = 0 }: LayoutProps) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOnVehicleGroup = VEHICLE_GROUP.some((a) => a.key === current);
  const [vehiclesOpen, setVehiclesOpen] = useState(isOnVehicleGroup);
  const { canAccessPage } = usePermissions();
  const { orgName } = useAuth();

  const isActive = (key: PageKey) => {
    if (key === "inventory" && (current === "vehicle" || current === "parties")) return true;
    return current === key;
  };

  const handleNav = (key: PageKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const visibleVehicleGroup = VEHICLE_GROUP.filter(({ key }) => canAccessPage(key));

  const visibleNavSections = navSections
    .map((section) =>
      section.filter((entry) => (isGroup(entry) ? visibleVehicleGroup.length > 0 : canAccessPage(entry.key))),
    )
    .filter((section) => section.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Bike size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{orgName ?? t("app.brand")}</p>
          <p className="text-[11px] text-slate-400 leading-tight">{t("app.tagline")}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleNavSections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className={`space-y-0.5 ${sectionIndex > 0 ? "mt-4 pt-4 border-t border-slate-800" : ""}`}
          >
            {section.map((entry) => {
              // The Vehicles group is a header only: clicking it expands or collapses its
              // children, it never navigates anywhere itself.
              if (isGroup(entry)) {
                return (
                  <div key="vehicles-group">
                    <button
                      onClick={() => setVehiclesOpen((o) => !o)}
                      aria-expanded={vehiclesOpen}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isOnVehicleGroup && !vehiclesOpen
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Bike size={18} />
                      <span className="flex-1 text-left">{t("nav.vehicles")}</span>
                      <ChevronDown size={14} className={`transition-transform ${vehiclesOpen ? "rotate-180" : ""}`} />
                    </button>
                    {vehiclesOpen && (
                      <div className="mt-0.5 ml-4 space-y-0.5 border-l border-slate-800 pl-3">
                        {visibleVehicleGroup.map((action) => (
                          <button
                            key={action.key}
                            onClick={() => handleNav(action.key)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                              current === action.key ? "bg-brand-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                          >
                            {action.icon}
                            <span className="flex-1 text-left">{t(action.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              const item = navItems.find((n) => n.key === entry.key)!;
              const active = isActive(item.key);
              return (
                <div key={item.key}>
                  <button
                    onClick={() => handleNav(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{t(item.labelKey)}</span>
                    {item.key === "alerts" && alertCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {alertCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-3 px-3 py-4 border-t border-slate-800">
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex w-60 shrink-0">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-60 animate-slide-up">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost btn-sm" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Bike size={18} className="text-brand-600 shrink-0" />
            <span className="text-sm font-semibold truncate">{orgName ?? t("app.brand")}</span>
          </div>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>

      {mobileOpen && (
        <button
          className="fixed top-2 right-2 z-50 lg:hidden text-white p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const email = user?.email ?? "";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold shrink-0">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-white truncate">{email || t("auth.user")}</p>
          <p className="text-[10px] text-slate-400 truncate">{role ? t("roles." + role, { defaultValue: ROLE_LABELS[role] }) : t("auth.signedIn")}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-20">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <LogOut size={14} />
              {t("auth.signOut")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
