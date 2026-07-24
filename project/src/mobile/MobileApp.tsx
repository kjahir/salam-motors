import { useEffect, useState } from "react";
import { LayoutDashboard, Bike, FileBarChart, Plus } from "lucide-react";
import { MobileDashboard } from "./MobileDashboard";
import { MobileInventory } from "./MobileInventory";
import { MobileVehicleDetail } from "./MobileVehicleDetail";
import { MobileVehicleForm } from "./MobileVehicleForm";
import { MobileReports } from "./MobileReports";

export type MobileScreen = "dashboard" | "inventory" | "vehicle" | "add-vehicle" | "edit-vehicle" | "reports";

export interface MobileNavigate {
  (screen: MobileScreen, params?: { vehicleId?: string }): void;
}

export function MobileApp() {
  const [screen, setScreen] = useState<MobileScreen>("dashboard");
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  const navigate: MobileNavigate = (next, params) => {
    if (params?.vehicleId) setVehicleId(params.vehicleId);
    setScreen(next);
  };

  // Reset scroll position on every screen change so navigating never leaves the
  // viewport mid-scroll on the new screen.
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
          <MobileVehicleDetail vehicleId={vehicleId} onNavigate={navigate} onBack={() => navigate("inventory")} />
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
      <div className={showBottomNav ? "pb-20" : ""}>{renderScreen()}</div>

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-mobile-card border-t border-mobile-border">
          <div className="relative flex items-center justify-around h-16 max-w-md mx-auto px-2">
            <NavButton
              active={isTabActive("dashboard")}
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              onClick={() => navigate("dashboard")}
            />
            <NavButton
              active={isTabActive("inventory")}
              icon={<Bike size={20} />}
              label="Inventory"
              onClick={() => navigate("inventory")}
            />
            <div className="w-14 shrink-0" />
            <NavButton
              active={isTabActive("reports")}
              icon={<FileBarChart size={20} />}
              label="Reports"
              onClick={() => navigate("reports")}
            />
            <button
              onClick={() => navigate("add-vehicle")}
              className="absolute left-1/2 -top-5 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-mobile-primary text-white shadow-mobile-lg active:bg-mobile-primary-active"
              aria-label="Add vehicle"
            >
              <Plus size={26} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg ${active ? "text-mobile-primary" : "text-mobile-text-muted"}`}>
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
