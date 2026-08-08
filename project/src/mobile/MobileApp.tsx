import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Bike, Sparkles, MoreHorizontal, X } from "lucide-react";
import { MobileDashboard } from "./MobileDashboard";
import { MobileInventory } from "./MobileInventory";
import { MobileMore } from "./MobileMore";
import { MobileDesktopPage } from "./MobileDesktopPage";
import { Sheet } from "./ui/primitives";
import { MobileVehicleSearch } from "./ui/MobileVehicleSearch";
import { Alerts } from "@/pages/Alerts";
import { Audit } from "@/pages/Audit";
import { History } from "@/pages/History";
import { Parties } from "@/pages/Parties";
import { Partners } from "@/pages/Partners";
import { Policies } from "@/pages/Policies";
import { Team } from "@/pages/Team";
import type { NavigateParams, PageKey } from "@/components/Layout";
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
import { useEntitlements } from "@/lib/useEntitlements";
import { isFeatureAvailable } from "@/lib/entitlements";
import { MobileBillingBanner } from "./MobileBillingBanner";

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
  | "view-vehicle"
  | "more"
  | "manage-vehicles"
  // More's children: the desktop pages, hosted in the mobile shell (see MobileDesktopPage).
  | "alerts"
  | "parties"
  | "partners"
  | "team"
  | "policies"
  | "history"
  | "audit";

/** More's children, so back always returns to More and the bottom bar stays hidden. */
const MORE_SCREENS: MobileScreen[] = ["alerts", "parties", "partners", "team", "policies", "history", "audit"];

const MORE_TITLE_KEYS: Record<string, string> = {
  alerts: "nav.alerts",
  parties: "nav.parties",
  partners: "nav.partners",
  team: "nav.team",
  policies: "nav.policies",
  history: "nav.history",
  audit: "nav.audit",
};

export interface MobileNavigateParams {
  vehicleId?: string;
  tab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
  /** A specific record's id to scroll to and briefly highlight on arrival — used when a
   *  Reports row deep-links into a list+editor screen like Add Expense. */
  highlightRecordId?: string;
}

/** Set to false to hide the bottom nav bar entirely. It shows on every screen. */
const SHOW_BOTTOM_NAV = true;

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
  const { registerNavigation, setAppContext, toggle: toggleAssistant, isOpen: assistantOpen } = useAssistant();
  const { canAccessMobileTab } = usePermissions();
  const { entitlements } = useEntitlements();
  const showAssistantTab = isFeatureAvailable(entitlements, "ai_assistant");
  const [screen, setScreen] = useState<MobileScreen>("dashboard");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleTab, setVehicleTab] = useState<string | undefined>(undefined);
  const [highlightPolicyId, setHighlightPolicyId] = useState<string | undefined>(undefined);
  const [highlightRecordId, setHighlightRecordId] = useState<string | undefined>(undefined);
  /** Selected vehicle context for Bottom Bar V2. */
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleLabel, setSelectedVehicleLabel] = useState("");
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  /** Tracks which screen navigated into the current screen for contextual back. */
  const fromScreenRef = useRef<MobileScreen>("dashboard");

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
    setHighlightRecordId(params?.highlightRecordId);
    setScreen((current) => {
      // always track previous screen so inventory/reports/More back buttons work contextually
      fromScreenRef.current = current;
      return next;
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

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

  // Inventory and the per-vehicle screens no longer sit under any tab (the vehicle list is
  // reached from Reports' Inventory tab and from a vehicle's own Back), so on those screens
  // no tab lights up rather than one claiming them. Reports moved into More once the AI
  // assistant took its bottom-bar slot, so it no longer lights up a tab of its own either.
  const isTabActive = (key: "dashboard" | "more") => {
    if (key === "more") return screen === "more" || MORE_SCREENS.includes(screen);
    return screen === key;
  };

  // Backing out of a vehicle-action page returns to the vehicle itself (on its matching
  // tab, so the record just added is visible) if one was already in context, otherwise to
  // the dashboard — matching wherever the dealer would have started the action from.
  const genericBack = (tab: string) => () =>
    vehicleId ? navigate("vehicle", { vehicleId, tab }) : navigate("dashboard");

  /**
   * The More screens are the desktop page components, so they hand back desktop PageKeys.
   * A vehicle is the only destination any of them actually links to; map that onto the
   * mobile vehicle screens and let anything else fall through rather than dead-end.
   */
  const desktopNavigate = (page: PageKey, params?: NavigateParams) => {
    const targetVehicleId = params?.vehicleId ?? params?.historyVehicleId;
    if ((page === "vehicle" || page === "passport") && targetVehicleId) {
      if (params?.openEditVehicle) {
        navigate("edit-vehicle", { vehicleId: targetVehicleId });
      } else {
        navigate("vehicle", { vehicleId: targetVehicleId, tab: params?.tab, highlightPolicyId: params?.highlightPolicyId });
      }
      return;
    }
    if (page === "inventory" || page === "dashboard") navigate(page);
  };

  // A plain function, not a component: an inline component would be a new type on every
  // render and would remount (and so reset) the hosted page's state.
  const morePage = (target: MobileScreen, content: React.ReactNode) => (
    <MobileDesktopPage title={t(MORE_TITLE_KEYS[target])} onBack={() => navigate(fromScreenRef.current)}>
      {content}
    </MobileDesktopPage>
  );

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <MobileDashboard onNavigate={navigate} selectedVehicleId={selectedVehicleId} />;
      case "inventory":
        return (
          <MobileInventory
            onNavigate={navigate}
            onBack={() => navigate(fromScreenRef.current as MobileScreen)}
            vehicleFilter={selectedVehicleId}
          />
        );
      case "manage-vehicles":
        return <MobileInventory manageMode onBack={genericBack("overview")} onNavigate={navigate} />;
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
        return (
          <MobileReports
            onNavigate={navigate}
            onBack={() => navigate(fromScreenRef.current as MobileScreen)}
            vehicleFilter={selectedVehicleId}
          />
        );
      case "update-vehicle":
        return <MobileUpdateVehicle vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("overview")} />;
      case "add-expense":
        return (
          <MobileAddExpense
            vehicleId={vehicleId ?? undefined}
            onNavigate={navigate}
            onBack={genericBack("expenses")}
            highlightRecordId={highlightRecordId}
          />
        );
      case "add-document":
        return <MobileAddDocument vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("documents")} />;
      case "add-inspection":
        return <MobileAddInspection vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={genericBack("inspection")} />;
      case "add-sale":
        return <MobileAddSale vehicleId={vehicleId ?? undefined} onBack={genericBack("sale")} />;
      case "view-vehicle":
        return <MobileViewVehicle vehicleId={vehicleId ?? undefined} onNavigate={navigate} onBack={() => navigate("inventory")} />;
      case "more":
        return <MobileMore onNavigate={navigate} selectedVehicleId={selectedVehicleId} />;
      case "alerts":
        return morePage("alerts", <Alerts onNavigate={desktopNavigate} />);
      case "parties":
        return morePage("parties", <Parties onNavigate={desktopNavigate} />);
      case "partners":
        return morePage("partners", <Partners onNavigate={desktopNavigate} />);
      case "team":
        return morePage("team", <Team />);
      case "policies":
        return morePage("policies", <Policies />);
      case "history":
        return morePage("history", <History vehicleFilter={null} />);
      case "audit":
        return morePage("audit", <Audit />);
      default:
        return <MobileDashboard onNavigate={navigate} selectedVehicleId={selectedVehicleId} />;
    }
  };

  // Always visible: the bottom bar is the one constant navigation surface on every screen.
  const showBottomNav = SHOW_BOTTOM_NAV;

  return (
    <div className="mobile-shell min-h-screen">
      {/* Renders nothing while the subscription is healthy. */}
      <MobileBillingBanner />
      <div className={selectedVehicleId ? "pb-32" : "pb-20"}>{renderScreen()}</div>

      {/* Transparent tap-outside-to-dismiss layer: purely functional. */}
      {vehiclePickerOpen && <div className="fixed inset-0 z-20" onClick={() => setVehiclePickerOpen(false)} />}

      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {/* Vehicle picker sheet — stops above the nav bar (bottom-20) rather than
              covering it, so the bar (and, if present, the selected-vehicle chip below)
              stay visible and the sheet reads as opening "from" the vehicle button. */}
          <Sheet
            open={vehiclePickerOpen}
            onClose={() => setVehiclePickerOpen(false)}
            title={t("mobileAdd.selectVehicle")}
            compact
            bodyClassName="flex flex-col min-h-[50vh]"
            bottomClass={selectedVehicleId ? "bottom-32" : "bottom-20"}
          >
            <MobileVehicleSearch
              value={selectedVehicleId ?? ""}
              onChange={(id, v) => {
                setSelectedVehicleId(id || null);
                setSelectedVehicleLabel(v ? [v.manufacturer, v.model].filter(Boolean).join(" ") || v.stock_number : "");
                setVehiclePickerOpen(false);
              }}
              inStockOnly
              inline
            />
          </Sheet>

          {/* Selected-vehicle chip: its own row above the nav bar (not squeezed inside the
              vehicle button's own flex column, which is what made the old badge tiny and
              its close icon nearly untappable). */}
          {selectedVehicleId && (
            <div className="flex justify-center px-3 pt-2 pb-1.5 bg-mobile-card border-t border-mobile-border">
              <div className="flex max-w-[85%] items-center gap-2 rounded-full bg-mobile-primary py-1.5 pl-3 pr-1.5 shadow-mobile-md">
                <Bike size={14} className="shrink-0 text-white" />
                <span className="truncate text-xs font-semibold text-white">{selectedVehicleLabel}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedVehicleId(null); setSelectedVehicleLabel(""); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
                  aria-label={t("mobileAdd.closeMenu")}
                >
                  <X size={15} className="text-white" />
                </button>
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
              {/* Vehicle context button: opens picker; icon highlights while a vehicle is
                  selected, the chip above shows which one. */}
              <button
                onClick={() => setVehiclePickerOpen(true)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
                aria-label={t("nav.vehicle")}
              >
                <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors ${
                  selectedVehicleId ? "bg-mobile-primary text-white" : "bg-mobile-primary/10 text-mobile-primary"
                }`}>
                  <Bike size={18} />
                </span>
                <span className="text-[10px] font-medium leading-none text-mobile-primary">{t("nav.vehicle")}</span>
              </button>
              {showAssistantTab && (
                <button
                  onClick={toggleAssistant}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
                  aria-label={t("assistant.launcher.label")}
                >
                  <span
                    className={`ai-assistant-icon-shape flex h-[30px] w-[30px] items-center justify-center bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-mobile-sm ${
                      assistantOpen ? "is-open" : ""
                    }`}
                  >
                    <Sparkles size={16} />
                  </span>
                  <span className="text-[10px] font-medium leading-none text-mobile-primary">
                    {t("assistant.launcher.label")}
                  </span>
                </button>
              )}
              <NavButton
                active={isTabActive("more")}
                icon={<MoreHorizontal size={20} />}
                label={t("nav.more")}
                onClick={() => navigate("more")}
              />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick, disabled }: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** Dimmed and inert while the vehicle-action row has the bar. */
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-opacity ${
        disabled ? "opacity-30" : active ? "text-mobile-primary" : "text-mobile-text-muted"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
