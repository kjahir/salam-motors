/* TEMPORARY visual-preview harness — delete with the rest of src/__preview__. */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthContext } from "@/lib/useAuth";
import { ToastContext } from "@/components/ui/useToast";
import { AssistantProvider } from "@/assistant/AssistantProvider";
import { AssistantShell } from "@/assistant/AssistantShell";
import { Layout, type PageKey } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { MobileApp } from "@/mobile/MobileApp";
import "@/i18n";
import "@/index.css";
const auth = {
  session: {} as never, user: { email: "ops@salammotors.test" } as never, loading: false,
  membership: { org_id: "o1", role: "owner" } as never, partner: null, orgId: "o1",
  orgName: "Salam Motors", role: "owner" as never,
  signIn: async () => ({ error: null }), signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }), signOut: async () => {}, refreshAccess: async () => {},
};
const isMobile = new URLSearchParams(window.location.search).get("view") === "mobile";
function Desktop() {
  const [page, setPage] = useState<PageKey>("dashboard");
  return <Layout current={page} onNavigate={setPage} alertCount={3}><Dashboard onNavigate={(p) => setPage(p)} /></Layout>;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthContext.Provider value={auth}>
      <ToastContext.Provider value={{ toast: (m, t) => console.log("[toast]", t, m) }}>
        <AssistantProvider>
          {isMobile ? <MobileApp /> : <Desktop />}
          <AssistantShell />
        </AssistantProvider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  </StrictMode>,
);
