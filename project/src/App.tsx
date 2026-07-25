import { useEffect, useState } from "react";
import { Layout, type PageKey, type NavigateParams } from "@/components/Layout";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { MobileApp } from "@/mobile/MobileApp";
import { AuthPage } from "@/pages/AuthPage";
import { Dashboard } from "@/pages/Dashboard";
import { Inventory } from "@/pages/Inventory";
import { AddVehicle } from "@/pages/AddVehicle";
import { VehicleDetail } from "@/pages/VehicleDetail";
import { Passport } from "@/pages/Passport";
import { Partners } from "@/pages/Partners";
import { Parties } from "@/pages/Parties";
import { Finance } from "@/pages/Finance";
import { Alerts } from "@/pages/Alerts";
import { Reports } from "@/pages/Reports";
import { History } from "@/pages/History";
import { Policies } from "@/pages/Policies";
import { fetchAlerts } from "@/lib/queries";

function AppContent() {
  const { session, loading } = useAuth();
  const isMobile = useIsMobileViewport();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<PageKey>("inventory");
  const [alertCount, setAlertCount] = useState(0);
  const [vehicleTab, setVehicleTab] = useState<string | undefined>(undefined);
  const [openEditVehicle, setOpenEditVehicle] = useState(false);
  const [highlightPolicyId, setHighlightPolicyId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    fetchAlerts()
      .then((a) => setAlertCount(a.filter((x) => x.status === "Open").length))
      .catch(() => undefined);
  }, [page, session]);

  const handleNavigate = (next: PageKey, params?: NavigateParams) => {
    if (params?.vehicleId) {
      setPreviousPage(page === "vehicle" || page === "passport" ? previousPage : page);
      setVehicleId(params.vehicleId);
    }
    if (next === "history") {
      setHistoryVehicleId(params?.historyVehicleId ?? null);
    }
    if (next === "vehicle") {
      setVehicleTab(params?.tab);
      setOpenEditVehicle(Boolean(params?.openEditVehicle));
      setHighlightPolicyId(params?.highlightPolicyId);
    }
    setPage(next);
  };

  const handleBack = () => {
    setPage(previousPage);
    setVehicleId(null);
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "inventory":
        return <Inventory onNavigate={handleNavigate} />;
      case "add-vehicle":
        return <AddVehicle onNavigate={handleNavigate} />;
      case "vehicle":
        return vehicleId ? (
          <VehicleDetail
            vehicleId={vehicleId}
            onNavigate={handleNavigate}
            onBack={handleBack}
            initialTab={vehicleTab}
            openEditVehicle={openEditVehicle}
            highlightPolicyId={highlightPolicyId}
          />
        ) : (
          <Inventory onNavigate={handleNavigate} />
        );
      case "passport":
        return vehicleId ? <Passport vehicleId={vehicleId} onNavigate={handleNavigate} onBack={handleBack} /> : <Inventory onNavigate={handleNavigate} />;
      case "partners":
        return <Partners onNavigate={handleNavigate} />;
      case "parties":
        return <Parties onNavigate={handleNavigate} />;
      case "finance":
        return <Finance onNavigate={handleNavigate} />;
      case "alerts":
        return <Alerts onNavigate={handleNavigate} />;
      case "reports":
        return <Reports onNavigate={handleNavigate} />;
      case "history":
        return <History vehicleFilter={historyVehicleId} />;
      case "policies":
        return <Policies />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (isMobile) {
    return <MobileApp />;
  }

  const isPassport = page === "passport";

  return (
    <>
      {isPassport && vehicleId ? (
        <Passport vehicleId={vehicleId} onNavigate={handleNavigate} onBack={handleBack} />
      ) : (
        <Layout current={page} onNavigate={handleNavigate} alertCount={alertCount}>
          {renderPage()}
        </Layout>
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
