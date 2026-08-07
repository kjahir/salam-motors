import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, type PageKey, type NavigateParams } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { QuickAddSale } from "@/pages/QuickAddSale";
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
import { Billing } from "@/pages/Billing";
import { PartnerPortal } from "@/pages/PartnerPortal";
import { BillingBanner } from "@/components/BillingBanner";
import { EntitlementsProvider } from "@/lib/entitlementsProvider";
import { useEntitlements } from "@/lib/useEntitlements";
import { isFeatureAvailable } from "@/lib/entitlements";
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
  "billing",
]);

function isPageKey(value: string): value is PageKey {
  return PAGE_KEYS.has(value as PageKey);
}

function AppContent() {
  const { t } = useTranslation();
  const { session, loading, membership, partner, role } = useAuth();
  const { entitlements } = useEntitlements();
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
        return <QuickAddSale onNavigate={handleNavigate} />;
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
        return vehicleId && isFeatureAvailable(entitlements, "vehicle_passport")
          ? <Passport vehicleId={vehicleId} onNavigate={handleNavigate} onBack={handleBack} />
          : <Inventory onNavigate={handleNavigate} />;
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
      case "billing":
        return isFeatureAvailable(entitlements, "billing") ? <Billing /> : <Dashboard onNavigate={handleNavigate} />;
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

  const isPassport = page === "passport" && isFeatureAvailable(entitlements, "vehicle_passport");

  return (
    <>
      {isPassport && vehicleId ? (
        <Passport vehicleId={vehicleId} onNavigate={handleNavigate} onBack={handleBack} />
      ) : (
        <Layout current={page} onNavigate={handleNavigate} alertCount={alertCount}>
          {/* Renders nothing while the subscription is healthy. */}
          <BillingBanner onNavigate={handleNavigate} />
          {renderPage()}
        </Layout>
      )}
    </>
  );
}

/**
 * Last line of defence. The assistant has its own, narrower boundaries (AssistantShell), so
 * this one catches a throw in the page tree itself - where the alternative is React
 * unmounting everything and leaving a blank white screen with no way forward.
 */
function AppCrashFallback({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-base font-semibold text-slate-950">{t("appError.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("appError.description")}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={reset} className="btn-primary">{t("appError.tryAgain")}</button>
          <button onClick={() => window.location.reload()} className="btn-secondary">{t("appError.reload")}</button>
        </div>
      </div>
    </div>
  );
}

/** Gate: renders nothing when the AI assistant WIP flag is off or the plan excludes it. */
function MaybeAssistantShell() {
  const { entitlements } = useEntitlements();
  if (!isFeatureAvailable(entitlements, "ai_assistant")) return null;
  return <AssistantShell />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        {/* Inside AuthProvider: entitlements are looked up per org_id. */}
        <EntitlementsProvider>
          <AssistantProvider>
            <ErrorBoundary label="app-root" fallback={(_error, reset) => <AppCrashFallback reset={reset} />}>
              <AppContent />
            </ErrorBoundary>
            <MaybeAssistantShell />
          </AssistantProvider>
        </EntitlementsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
