import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Bike, FileBarChart, Plus, Receipt, FileText, ClipboardCheck, ShoppingCart, Pencil, Eye } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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

// The 6 non-"Add Vehicle" targets reachable from the mobile "+" icon row, each landing on
// its own full-screen page with a vehicle-select dropdown at the top (rather than a
// pre-navigation picker Sheet) — so every one of these pages is directly reachable
// whether or not a vehicle was already in context.
const ADD_TARGETS: { key: string; screen: MobileScreen; labelKey: string; icon: typeof Receipt }[] = [
  { key: "update", screen: "update-vehicle", labelKey: "mobileAdd.updateVehicle", icon: Pencil },
  { key: "expenses", screen: "add-expense", labelKey: "vehicleDetail.expenses", icon: Receipt },
  { key: "documents", screen: "add-document", labelKey: "vehicleDetail.documents", icon: FileText },
  { key: "inspection", screen: "add-inspection", labelKey: "vehicleDetail.inspection", icon: ClipboardCheck },
  { key: "sale", screen: "add-sale", labelKey: "mobileAdd.makeSales", icon: ShoppingCart },
  { key: "view", screen: "view-vehicle", labelKey: "mobileAdd.viewVehicle", icon: Eye },
];

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
  const handlePickAddVehicle = () => {
    setAddRowOpen(false);
    navigate("add-vehicle");
  };

  const handlePickAddTarget = (targetScreen: MobileScreen) => {
    setAddRowOpen(false);
    navigate(targetScreen, screen === "vehicle" && vehicleId ? { vehicleId } : undefined);
  };

  const genericBack = (tab: string) => () =>
    vehicleId ? navigate("vehicle", { vehicleId, tab }) : navigate("inventory");

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
  const showBottomNav = screen === "dashboard" || screen === "inventory" || screen === "reports" || screen === "vehicle";
  const canAddVehicle = canAccessMobileTab("add-vehicle");

  return (
    <div className="mobile-shell min-h-screen">
      <div className="fixed right-3 top-3 z-30">
        <LanguageSwitcher variant="mobile" />
      </div>

      <div className={showBottomNav ? "pb-20" : ""}>{renderScreen()}</div>

      {/* Transparent tap-outside-to-dismiss layer: purely functional, never visually
          covers the dashboard/inventory content behind the icon row. */}
      {addRowOpen && <div className="fixed inset-0 z-20" onClick={() => setAddRowOpen(false)} />}

      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {addRowOpen && canAddVehicle && (
            <div className="mx-auto max-w-md w-full bg-mobile-card border-t border-x border-mobile-border rounded-t-2xl shadow-mobile-lg px-2 pt-3 pb-2 animate-slide-up">
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={handlePickAddVehicle}
                  className="flex flex-col items-center gap-1 py-1 active:opacity-70"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary"><Bike size={20} /></span>
                  <span className="text-[10px] font-medium text-mobile-text-secondary text-center leading-tight">{t("nav.addVehicle")}</span>
                </button>
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
                icon={<Bike size={20} />}
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
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-mobile-primary text-white">
                    <Plus size={18} className={`transition-transform duration-200 ${addRowOpen ? "rotate-45" : ""}`} />
                  </span>
                  <span className="text-[11px] font-semibold leading-none text-mobile-primary">{t("common.add")}</span>
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
