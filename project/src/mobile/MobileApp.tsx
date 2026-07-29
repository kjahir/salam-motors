import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Bike, FileBarChart, Plus, Receipt, FileText, ClipboardCheck, ShoppingCart } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileDashboard } from "./MobileDashboard";
import { MobileInventory } from "./MobileInventory";
import { MobileVehicleDetail } from "./MobileVehicleDetail";
import { MobileVehicleForm } from "./MobileVehicleForm";
import { MobileReports } from "./MobileReports";
import { Sheet, Spinner } from "./ui/primitives";
import { usePermissions } from "@/lib/usePermissions";
import { useAssistant } from "@/assistant/AssistantProvider";
import { fetchVehicles } from "@/lib/queries";
import type { Vehicle } from "@/lib/types";

export type MobileScreen = "dashboard" | "inventory" | "vehicle" | "add-vehicle" | "edit-vehicle" | "reports";

export interface MobileNavigateParams {
  vehicleId?: string;
  tab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
  autoAdd?: boolean;
}

// The 4 non-Vehicle add targets reachable from the mobile "+" button, mapped onto
// VehicleDetail's internal tab keys (same keys desktop uses -- see compliance.ts deep links).
const ADD_TARGETS: { key: string; labelKey: string; icon: typeof Receipt }[] = [
  { key: "expenses", labelKey: "vehicleDetail.expenses", icon: Receipt },
  { key: "documents", labelKey: "vehicleDetail.documents", icon: FileText },
  { key: "inspection", labelKey: "vehicleDetail.inspection", icon: ClipboardCheck },
  { key: "sale", labelKey: "vehicleDetail.saleProfit", icon: ShoppingCart },
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
  const [vehicleAutoAdd, setVehicleAutoAdd] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [pickerVehicles, setPickerVehicles] = useState<Vehicle[] | null>(null);
  const [loadingPicker, setLoadingPicker] = useState(false);

  const navigate = useCallback<MobileNavigate>((next, params) => {
    if (params?.vehicleId) {
      setVehicleId(params.vehicleId);
    } else if (next !== "vehicle" && next !== "edit-vehicle") {
      setVehicleId(null);
    }
    if (next === "vehicle") {
      setVehicleTab(params?.tab);
      setHighlightPolicyId(params?.highlightPolicyId);
      setVehicleAutoAdd(Boolean(params?.autoAdd));
    } else {
      setVehicleTab(undefined);
      setHighlightPolicyId(undefined);
      setVehicleAutoAdd(false);
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

  // The raised "+" button is global (not vehicle-scoped): tapping it always offers all 5
  // add targets. "Vehicle" goes straight to Add Vehicle. For the other 4, if we're already
  // inside a specific vehicle's page we jump straight into that vehicle's section with
  // autoAdd; otherwise a second sheet lets the dealer pick which vehicle first.
  const handlePickAddVehicle = () => {
    setShowAddSheet(false);
    navigate("add-vehicle");
  };

  const handlePickAddTarget = (key: string) => {
    setShowAddSheet(false);
    if (screen === "vehicle" && vehicleId) {
      navigate("vehicle", { vehicleId, tab: key, autoAdd: true });
      return;
    }
    setAddTarget(key);
    setPickerVehicles(null);
    setLoadingPicker(true);
    fetchVehicles()
      .then(setPickerVehicles)
      .catch(() => setPickerVehicles([]))
      .finally(() => setLoadingPicker(false));
  };

  const handlePickVehicleForTarget = (v: Vehicle) => {
    if (!addTarget) return;
    const target = addTarget;
    setAddTarget(null);
    setPickerVehicles(null);
    navigate("vehicle", { vehicleId: v.id, tab: target, autoAdd: true });
  };

  const closeVehiclePicker = () => {
    setAddTarget(null);
    setPickerVehicles(null);
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
            autoAdd={vehicleAutoAdd}
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
      default:
        return <MobileDashboard onNavigate={navigate} />;
    }
  };

  // "vehicle" is included so the global "+" button (and its jump-straight-to-section
  // autoAdd behavior for a vehicle already open) stays reachable from a vehicle's own
  // detail page, not just from Dashboard/Inventory/Reports.
  const showBottomNav = screen === "dashboard" || screen === "inventory" || screen === "reports" || screen === "vehicle";

  return (
    <div className="mobile-shell min-h-screen">
      <div className="fixed right-3 top-3 z-30">
        <LanguageSwitcher variant="mobile" />
      </div>

      <div className={showBottomNav ? "pb-20" : ""}>{renderScreen()}</div>

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-mobile-card border-t border-mobile-border">
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
            {canAccessMobileTab("add-vehicle") && (
              <button
                onClick={() => setShowAddSheet(true)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
                aria-label={t("nav.addVehicle")}
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-mobile-primary text-white">
                  <Plus size={18} />
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
      )}

      <Sheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title={t("mobileAdd.title")}>
        <div className="space-y-2">
          <button
            onClick={handlePickAddVehicle}
            className="flex w-full items-center gap-3 rounded-xl border border-mobile-border bg-white px-3.5 py-3 text-sm font-medium text-mobile-text active:bg-mobile-bg"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary"><Bike size={18} /></span>
            {t("nav.addVehicle")}
          </button>
          {ADD_TARGETS.map(({ key, labelKey, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handlePickAddTarget(key)}
              className="flex w-full items-center gap-3 rounded-xl border border-mobile-border bg-white px-3.5 py-3 text-sm font-medium text-mobile-text active:bg-mobile-bg"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary"><Icon size={18} /></span>
              {t(labelKey)}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={addTarget !== null} onClose={closeVehiclePicker} title={t("mobileAdd.chooseVehicle")}>
        {loadingPicker ? (
          <div className="flex items-center justify-center py-10"><Spinner size={24} /></div>
        ) : (
          <div className="space-y-2">
            {(pickerVehicles ?? []).map((v) => (
              <button
                key={v.id}
                onClick={() => handlePickVehicleForTarget(v)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-mobile-border bg-white px-3.5 py-3 text-left active:bg-mobile-bg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-mobile-text truncate">{v.manufacturer} {v.model}</p>
                  <p className="text-xs text-mobile-text-muted font-mono">{v.stock_number}</p>
                </div>
              </button>
            ))}
            {!loadingPicker && (pickerVehicles ?? []).length === 0 && (
              <p className="text-sm text-mobile-text-muted text-center py-6">{t("mobileAdd.noVehicles")}</p>
            )}
          </div>
        )}
      </Sheet>
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
