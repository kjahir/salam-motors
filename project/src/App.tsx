import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, type PageKey, type NavigateParams } from "@/components/Layout";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { MobileApp } from "@/mobile/MobileApp";
import { AuthPage } from "@/pages/AuthPage";
import { CreateOrganization } from "@/pages/CreateOrganization";
import { Dashboard } from "@/pages/Dashboard";
import { Inventory } from "@/pages/Inventory";
import { AddVehicle } from "@/pages/AddVehicle";
import { ManageVehicles } from "@/pages/ManageVehicles";
import { QuickAddExpense } from "@/pages/QuickAddExpense";
import { QuickAddDocument } from "@/pages/QuickAddDocument";
import { QuickAddInspection } from "@/pages/QuickAddInspection";
import { QuickMakeSale } from "@/pages/QuickMakeSale";
import { QuickViewVehicle } from "@/pages/QuickViewVehicle";
import { VehicleDetail } from "@/pages/VehicleDetail";
import { Passport } from "@/pages/Passport";
import { Partners } from "@/pages/Partners";
import { Parties } from "@/pages/Parties";
import { Finance } from "@/pages/Finance";
import { Alerts } from "@/pages/Alerts";
import { History } from "@/pages/History";
import { Policies } from "@/pages/Policies";
import { Team } from "@/pages/Team";
import { Audit } from "@/pages/Audit";
import { PartnerPortal } from "@/pages/PartnerPortal";
import { fetchAlerts } from "@/lib/queries";
import { canAccessPage } from "@/lib/permissions";
import { AssistantProvider, useAssistant } from "@/assistant/AssistantProvider";
import { AssistantShell } from "@/assistant/AssistantShell";

const PAGE_KEYS: ReadonlySet<PageKey> = new Set([
  "dashboard",
  "inventory",
  "add-vehicle",
  "manage-vehicles",
  "quick-add-expense",
  "quick-add-document",
  "quick-add-inspection",
  "quick-add-sale",
  "view-vehicle",
  "vehicle",
  "parties",
  "partners",
  "finance",
  "alerts",
  "passport",
  "history",
  "policies",
  "team",
  "audit",
]);

function isPageKey(value: string): value is PageKey {
  return PAGE_KEYS.has(value as PageKey);
}

function AppContent() {
  const { t } = useTranslation();
  const { session, loading, membership, partner, role } = useAuth();
  const { registerNavigation, setAppContext } = useAssistant();
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

  const handleNavigate = useCallback((next: PageKey, params?: NavigateParams) => {
    if (params?.vehicleId) {
      setPreviousPage((current) => page === "vehicle" || page === "passport" ? current : page);
      setVehicleId(params.vehicleId);
    } else if (next !== "vehicle" && next !== "passport") {
      setVehicleId(null);
    }
    if (next === "history") {
      setHistoryVehicleId(params?.historyVehicleId ?? null);
    }
    if (next === "vehicle") {
      setVehicleTab(params?.tab);
      setOpenEditVehicle(Boolean(params?.openEditVehicle));
      setHighlightPolicyId(params?.highlightPolicyId);
    } else {
      setVehicleTab(undefined);
      setOpenEditVehicle(false);
      setHighlightPolicyId(undefined);
    }
    setPage(next);
  }, [page]);

  const handleBack = useCallback(() => {
    setPage(previousPage);
    setVehicleId(null);
  }, [previousPage]);

  useEffect(() => {
    if (!session) return;
    if (!membership && partner) {
      setAppContext({ surface: "partner", page: "partner-portal" });
      return;
    }
    if (!isMobile && membership) {
      setAppContext({
        surface: "desktop",
        page,
        vehicleId: page === "vehicle" || page === "passport" ? vehicleId : page === "history" ? historyVehicleId : null,
        vehicleTab: page === "vehicle" ? vehicleTab : null,
      });
    }
  }, [historyVehicleId, isMobile, membership, page, partner, session, setAppContext, vehicleId, vehicleTab]);

  useEffect(() => {
    if (!membership || isMobile) return;
    registerNavigation((next, params) => {
      if (!isPageKey(next) || !canAccessPage(role, next)) return false;
      const needsVehicle = next === "vehicle" || next === "passport";
      if (needsVehicle && !params?.vehicleId && !vehicleId) return false;
      handleNavigate(next, params);
      return true;
    });
    return () => registerNavigation(null);
  }, [handleNavigate, isMobile, membership, registerNavigation, role, vehicleId]);

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "inventory":
        return <Inventory onNavigate={handleNavigate} />;
      case "add-vehicle":
        return <AddVehicle onNavigate={handleNavigate} />;
      case "manage-vehicles":
        return <ManageVehicles onNavigate={handleNavigate} />;
      case "quick-add-expense":
        return <QuickAddExpense onNavigate={handleNavigate} />;
      case "quick-add-document":
        return <QuickAddDocument onNavigate={handleNavigate} />;
      case "quick-add-inspection":
        return <QuickAddInspection onNavigate={handleNavigate} />;
      case "quick-add-sale":
        return <QuickMakeSale onNavigate={handleNavigate} />;
      case "view-vehicle":
        return <QuickViewVehicle onNavigate={handleNavigate} />;
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
      case "history":
        return <History vehicleFilter={historyVehicleId} />;
      case "policies":
        return <Policies />;
      case "team":
        return <Team />;
      case "audit":
        return <Audit />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (!membership && !partner) {
    return <CreateOrganization />;
  }

  // A staff membership always wins over a partner link (e.g. an Owner who
  // is also a JV investor sees the full staff app, not the read-only
  // partner view) - the partner OR-branch in RLS still applies underneath
  // regardless of which UI is shown.
  if (!membership && partner) {
    return <PartnerPortal />;
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
        <AssistantProvider>
          <AppContent />
          <AssistantShell />
        </AssistantProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
