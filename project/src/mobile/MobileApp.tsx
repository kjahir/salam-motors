import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Bike, FileBarChart, Warehouse, Receipt, FileText, ClipboardCheck } from "lucide-react";
import { MobileDashboard } from "./MobileDashboard";
import { MobileInventory } from "./MobileInventory";
import { MobileVehicleDetail } from "./MobileVehicleDetail";
import { MobileVehicleForm } from "./MobileVehicleForm";
import { MobileReports } from "./MobileReports";
import { MobileAddExpense } from "./MobileAddExpense";
import { MobileAddDocument } from "./MobileAddDocument";
import { MobileAddInspection } from "./MobileAddInspection";
import { MobileAddSale } from "./MobileAddSale";
import { MobileUpdateVehicle } from "./MobileUpdateVehicle";
import { MobileViewVehicle } from "./MobileViewVehicle";
import { usePermissions } from "@/lib/usePermissions";
import { useAssistant } from "@/assistant/AssistantProvider";

export type MobileScreen =
  | "dashboard"
  | "inventory"
  | "vehicle"
  | "add-vehicle"
  | "edit-vehicle"
  | "reports"
  | "update-vehicle"
  | "add-expense"
  | "add-document"
  | "add-inspection"
  | "add-sale"
  | "view-vehicle";

export interface MobileNavigateParams {
  vehicleId?: string;
  tab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
}

// Targets reachable from the mobile "+" icon row, each landing on its own full-screen page
// with a vehicle-select dropdown at the top (rather than a pre-navigation picker Sheet) —
// so every one is directly reachable whether or not a vehicle was already in context.
//
// Mirrors the desktop sidebar's "Vehicles" group (src/components/Layout.tsx): viewing a
// vehicle is what tapping an Inventory row does, and selling starts from the Sell Vehicle
// button on the Dashboard and on the vehicle itself, so neither needs an icon here.
const ADD_TARGETS: { key: string; screen: MobileScreen; labelKey: string; icon: typeof Receipt }[] = [
  { key: "vehicle", screen: "update-vehicle", labelKey: "nav.manageVehicles", icon: Bike },
  { key: "expenses", screen: "add-expense", labelKey: "vehicleDetail.expenses", icon: Receipt },
  { key: "documents", screen: "add-document", labelKey: "vehicleDetail.documents", icon: FileText },
  { key: "inspection", screen: "add-inspection", labelKey: "vehicleDetail.inspection", icon: ClipboardCheck },
];

/** Screens that keep the bottom bar (and so can host the vehicle-action row). */
const BOTTOM_NAV_SCREENS: MobileScreen[] = ["dashboard", "inventory", "reports", "vehicle"];

export interface MobileNavigate {
  (screen: MobileScreen, params?: MobileNavigateParams): void;
}

function assistantScreen(page: string, hasVehicle: boolean): MobileScreen | null {
  switch (page) {
    case "dashboard":
    case "inventory":
    case "add-vehicle":
    case "reports":
      return page;
    case "finance":
      return "reports";
    case "vehicle":
    case "edit-vehicle":
      return hasVehicle ? page : null;
    case "passport":
    case "history":
      return hasVehicle ? "vehicle" : null;
    default:
      return null;
  }
}

export function MobileApp() {
  const { t } = useTranslation();
  const { registerNavigation, setAppContext } = useAssistant();
  const { canAccessMobileTab } = usePermissions();
  const [screen, setScreen] = useState<MobileScreen>("dashboard");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleTab, setVehicleTab] = useState<string | undefined>(undefined);
  const [highlightPolicyId, setHighlightPolicyId] = useState<string | undefined>(undefined);
  const [addRowOpen, setAddRowOpen] = useState(false);
  /**
   * The screen the vehicle-action row was opened from. Kept in a ref so `navigate` can stay
   * a stable callback: leaving an action page for any bottom-nav screen drops the dealer
   * back where they started with the row still open, ready for the next entry.
   */
  const addOriginRef = useRef<MobileScreen | null>(null);

  const navigate = useCallback<MobileNavigate>((next, params) => {
    if (params?.vehicleId) {
      setVehicleId(params.vehicleId);
    } else if (next !== "vehicle" && next !== "edit-vehicle") {
      setVehicleId(null);
    }
    if (next === "vehicle") {
      setVehicleTab(params?.tab);
      setHighlightPolicyId(params?.highlightPolicyId);
    } else {
      setVehicleTab(undefined);
      setHighlightPolicyId(undefined);
    }
    setScreen(next);
    if (addOriginRef.current && BOTTOM_NAV_SCREENS.includes(next)) {
      addOriginRef.current = null;
      setAddRowOpen(true);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Published as a CSS variable rather than a prop because the assistant launcher lives
  // outside this tree (AssistantShell), and only needs to know how much room to leave.
  useEffect(() => {
    const showing = addRowOpen && BOTTOM_NAV_SCREENS.includes(screen);
    document.documentElement.style.setProperty("--mobile-action-row", showing ? "6.5rem" : "0rem");
    return () => {
      document.documentElement.style.removeProperty("--mobile-action-row");
    };
  }, [addRowOpen, screen]);

  useEffect(() => {
    setAppContext({
      surface: "mobile",
      page: screen,
      vehicleId: screen === "vehicle" || screen === "edit-vehicle" ? vehicleId : null,
      vehicleTab: screen === "vehicle" ? vehicleTab : null,
    });
  }, [screen, setAppContext, vehicleId, vehicleTab]);

  useEffect(() => {
    registerNavigation((page, params) => {
      const currentVehicleId = screen === "vehicle" || screen === "edit-vehicle" ? vehicleId ?? undefined : undefined;
      const nextVehicleId = params?.vehicleId ?? params?.historyVehicleId ?? currentVehicleId;
      const requestedPage = page === "vehicle" && params?.openEditVehicle ? "edit-vehicle" : page;
      const target = assistantScreen(requestedPage, Boolean(nextVehicleId));
      if (!target || !canAccessMobileTab(target)) return false;
      navigate(target, {
        vehicleId: nextVehicleId,
        tab: params?.tab,
        highlightPolicyId: params?.highlightPolicyId,
      });
      return true;
    });
    return () => registerNavigation(null);
  }, [canAccessMobileTab, navigate, registerNavigation, screen, vehicleId]);

  const isTabActive = (key: "dashboard" | "inventory" | "reports") => {
    if (key === "inventory") return screen === "inventory" || screen === "vehicle" || screen === "edit-vehicle";
    return screen === key;
  };

  // The raised "+" button is global (not vehicle-scoped): tapping it reveals a horizontal
  // row of all 7 targets, just above the bottom nav. "Vehicle" goes straight to Add
  // Vehicle. Every other target lands on its own full-screen page that owns its own
  // vehicle-select dropdown, so if we're already inside a specific vehicle's page we
  // just pass that vehicleId along as a convenience preselect; otherwise the page opens
  // with nothing selected and the dealer picks a vehicle right there.
  const handlePickAddTarget = (targetScreen: MobileScreen) => {
    addOriginRef.current = screen;
    setAddRowOpen(false);
    navigate(targetScreen, screen === "vehicle" && vehicleId ? { vehicleId } : undefined);
  };

  // Backing out of a vehicle-action page returns to whatever was on screen when it was
  // opened — dashboard, inventory, reports or the vehicle itself (on its matching tab, so
  // the record just added is visible). navigate() reopens the action row on arrival.
  const genericBack = (tab: string) => () => {
    const origin = addOriginRef.current;
    if (origin === "vehicle" && vehicleId) return navigate("vehicle", { vehicleId, tab });
    if (origin) return navigate(origin);
    return vehicleId ? navigate("vehicle", { vehicleId, tab }) : navigate("inventory");
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <MobileDashboard onNavigate={navigate} />;
      case "inventory":
        return <MobileInventory onNavigate={navigate} />;
      case "vehicle":
        return vehicleId ? (
          <MobileVehicleDetail
            vehicleId={vehicleId}
            onNavigate={navigate}
            onBack={() => navigate("inventory")}
            initialTab={vehicleTab}
            highlightPolicyId={highlightPolicyId}
          />
        ) : (
          <MobileInventory onNavigate={navigate} />
        );
      case "add-vehicle":
        return <MobileVehicleForm mode="create" onNavigate={navigate} onBack={() => navigate("inventory")} />;
      case "edit-vehicle":
        return vehicleId ? (
          <MobileVehicleForm mode="edit" vehicleId={vehicleId} onNavigate={navigate} onBack={() => navigate("vehicle", { vehicleId })} />
        ) : (
          <MobileInventory onNavigate={navigate} />
        );
      case "reports":
        return <MobileReports />;
      case "update-vehicle":
        return <MobileUpdateVehicle vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("overview")} />;
      case "add-expense":
        return <MobileAddExpense vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("expenses")} />;
      case "add-document":
        return <MobileAddDocument vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("documents")} />;
      case "add-inspection":
        return <MobileAddInspection vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("inspection")} />;
      case "add-sale":
        return <MobileAddSale vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("sale")} />;
      case "view-vehicle":
        return <MobileViewVehicle vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={() => navigate("inventory")} />;
      default:
        return <MobileDashboard onNavigate={navigate} />;
    }
  };

  // "vehicle" is included so the global "+" button (and its jump-straight-to-page behavior
  // for a vehicle already open) stays reachable from a vehicle's own detail page, not just
  // from Dashboard/Inventory/Reports.
  const showBottomNav = BOTTOM_NAV_SCREENS.includes(screen);
  const canAddVehicle = canAccessMobileTab("add-vehicle");

  return (
    <div className="mobile-shell min-h-screen">
      <div className={showBottomNav ? "pb-20" : ""}>{renderScreen()}</div>

      {/* Transparent tap-outside-to-dismiss layer: purely functional, never visually
          covers the dashboard/inventory content behind the icon row. */}
      {addRowOpen && <div className="fixed inset-0 z-20" onClick={() => setAddRowOpen(false)} />}

      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {addRowOpen && canAddVehicle && (
            <div className="mx-auto max-w-md w-full bg-mobile-card border-t border-x border-mobile-border rounded-t-2xl shadow-mobile-lg px-2 pt-3 pb-2 animate-slide-up">
              <div className="grid grid-cols-4 gap-1">
                {ADD_TARGETS.map(({ key, screen: targetScreen, labelKey, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handlePickAddTarget(targetScreen)}
                    className="flex flex-col items-center gap-1 py-1 active:opacity-70"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary"><Icon size={20} /></span>
                    <span className="text-[10px] font-medium text-mobile-text-secondary text-center leading-tight">{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <nav className="bg-mobile-card border-t border-mobile-border">
            <div className="flex items-stretch max-w-md mx-auto">
              <NavButton
                active={isTabActive("dashboard")}
                icon={<LayoutDashboard size={20} />}
                label={t("nav.dashboard")}
                onClick={() => navigate("dashboard")}
              />
              <NavButton
                active={isTabActive("inventory")}
                icon={<Warehouse size={20} />}
                label={t("nav.inventory")}
                onClick={() => navigate("inventory")}
              />
              {canAddVehicle && (
                <button
                  onClick={() => setAddRowOpen((o) => !o)}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
                  aria-label={addRowOpen ? t("mobileAdd.closeMenu") : t("mobileAdd.openMenu")}
                  aria-expanded={addRowOpen}
                >
                  <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-white transition-colors ${addRowOpen ? "bg-mobile-primary-active" : "bg-mobile-primary"}`}>
                    <Bike size={18} />
                  </span>
                  <span className="text-[11px] font-semibold leading-none text-mobile-primary">{t("nav.vehicle")}</span>
                </button>
              )}
              {canAccessMobileTab("reports") && (
                <NavButton
                  active={isTabActive("reports")}
                  icon={<FileBarChart size={20} />}
                  label={t("nav.reports")}
                  onClick={() => navigate("reports")}
                />
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 ${active ? "text-mobile-primary" : "text-mobile-text-muted"}`}>
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
