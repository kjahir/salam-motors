import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./useAuth";
import { EntitlementsContext } from "./useEntitlements";
import type { Entitlements } from "./entitlements";

/**
 * Loads the signed-in dealership's billing entitlements once per org and
 * shares them with the whole tree.
 *
 * Reads through the `org_entitlements` RPC rather than selecting from
 * org_subscriptions directly, because `access` (full vs read-only) is
 * computed against now() in SQL - the same expression the write-blocking
 * trigger uses. Deriving it again in JavaScript would be a second source
 * of truth that drifts the moment either side changes.
 *
 * The RPC is membership-checked server-side and returns NULL for any org
 * the caller does not belong to.
 */
export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { orgId, session } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const load = useCallback(async () => {
    if (!orgId || !session) {
      setEntitlements(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("org_entitlements", { p_org_id: orgId });
    if (!activeRef.current) return;

    if (error) {
      // Leave entitlements null - consumers fail open. A billing lookup
      // failing must not present as a lapsed subscription.
      console.error("Failed to load subscription entitlements", error);
      setEntitlements(null);
    } else {
      setEntitlements((data as Entitlements | null) ?? null);
    }
    setLoading(false);
  }, [orgId, session]);

  useEffect(() => {
    activeRef.current = true;
    setLoading(true);
    void load();
    return () => {
      activeRef.current = false;
    };
  }, [load]);

  return (
    <EntitlementsContext.Provider value={{ entitlements, loading, refresh: load }}>
      {children}
    </EntitlementsContext.Provider>
  );
}
