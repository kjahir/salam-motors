import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { AuthContext } from "./useAuth";
import type { Membership, Partner } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const activeRef = useRef(true);

  const loadAccess = async (userId: string) => {
    const [membershipResult, partnerResult] = await Promise.all([
      supabase.from("memberships").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(),
      supabase.from("partners").select("*").eq("auth_user_id", userId).is("deleted_at", null).maybeSingle(),
    ]);
    if (!activeRef.current) return;

    let membershipRow = membershipResult.data;
    const partnerRow = partnerResult.data;

    if (!membershipRow && !partnerRow) {
      // No active membership yet - the user may have a pending team invite
      // that was never accepted (invite emails don't auto-activate access).
      const { data: accepted } = await supabase.rpc("accept_own_invite");
      if (accepted && activeRef.current) {
        const { data: refreshed } = await supabase
          .from("memberships").select("*").eq("user_id", userId).eq("status", "active").maybeSingle();
        membershipRow = refreshed;
      }
    }
    if (!activeRef.current) return;

    setMembership((membershipRow as Membership) ?? null);
    setPartner((partnerRow as Partner) ?? null);

    const orgId = membershipRow?.org_id ?? partnerRow?.org_id ?? null;
    if (orgId) {
      const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
      if (activeRef.current) setOrgName(orgRow?.name ?? null);
    } else if (activeRef.current) {
      setOrgName(null);
    }
  };

  useEffect(() => {
    activeRef.current = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!activeRef.current) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadAccess(data.session.user.id);
      }
      if (activeRef.current) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        loadAccess(sess.user.id);
      } else {
        setMembership(null);
        setPartner(null);
        setOrgName(null);
      }
    });

    return () => {
      activeRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshAccess = async () => {
    if (session?.user) {
      await loadAccess(session.user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setMembership(null);
    setPartner(null);
    setOrgName(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        membership,
        partner,
        orgId: membership?.org_id ?? partner?.org_id ?? null,
        orgName,
        role: membership?.role ?? null,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
