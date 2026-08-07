import { createContext, useContext } from "react";
import type { Entitlements } from "./entitlements";

export interface EntitlementsContextValue {
  /**
   * Null while loading, and also when the fetch failed or the signed-in
   * user has no org (a partner-only login). Every consumer treats null as
   * "unknown, allow" - see canWrite()/hasFeature() in entitlements.ts for
   * why fail-open is the right default here.
   */
  entitlements: Entitlements | null;
  loading: boolean;
  /** Re-fetch after a checkout completes or a plan changes. */
  refresh: () => Promise<void>;
}

export const EntitlementsContext = createContext<EntitlementsContextValue | undefined>(undefined);

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return ctx;
}
