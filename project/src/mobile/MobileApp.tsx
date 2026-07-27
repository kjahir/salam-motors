import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Bike, FileBarChart, Plus } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileDashboard } from "./MobileDashboard";
import { MobileInventory } from "./MobileInventory";
import { MobileVehicleDetail } from "./MobileVehicleDetail";
import { MobileVehicleForm } from "./MobileVehicleForm";
import { MobileReports } from "./MobileReports";
import { usePermissions } from "@/lib/usePermissions";

export type MobileScreen = "dashboard" | "inventory" | "vehicle" | "add-vehicle" | "edit-vehicle" | "reports";

export interface MobileNavigateParams {
  vehicleId?: string;
  tab?: string;
  highlightPolicyId?: string;
}

export interface MobileNavigate {
  (screen: MobileScreen, params?: MobileNavigateParams): void;
}

export function MobileApp() {
  const { t } = useTranslation();
  const { canAccessMobileTab } = usePermissions();
  const [screen, setScreen] = useState<MobileScreen>("dashboard");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleTab, setVehicleTab] = useState<string | undefined>(undefined);
  const [highlightPolicyId, setHighlightPolicyId] = useState<string | undefined>(undefined);

  const navigate: MobileNavigate = (next, params) => {
    if (params?.vehicleId) setVehicleId(params.vehicleId);
    if (next === "vehicle") {
      setVehicleTab(params?.tab);
      setHighlightPolicyId(params?.highlightPolicyId);
    }
    setScreen(next);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const isTabActive = (key: "dashboard" | "inventory" | "reports") => {
    if (key === "inventory") return screen === "inventory" || screen === "vehicle" || screen === "edit-vehicle";
    return screen === key;
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
      default:
        return <MobileDashboard onNavigate={navigate} />;
    }
  };

  const showBottomNav = screen === "dashboard" || screen === "inventory" || screen === "reports";

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
                onClick={() => navigate("add-vehicle")}
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
