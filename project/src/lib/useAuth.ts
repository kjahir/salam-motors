import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Membership, Partner, Role } from "./types";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** The caller's active staff membership, if any. Null for a partner-only or unlinked login. */
  membership: Membership | null;
  /** The partner record linked to this login, if any (JV investor self-service). */
  partner: Partner | null;
  /** Convenience accessor: membership.org_id, falling back to partner.org_id. */
  orgId: string | null;
  /** The signed-in user's dealership name, once membership/partner resolves an org_id. */
  orgName: string | null;
  /** Convenience accessor: membership.role. Null for partner-only or unlinked logins. */
  role: Role | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Self-serve account creation - optional path for a brand-new dealer with nobody to invite them. */
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Re-fetch membership/partner/org - call after create_organization() or accepting an invite. */
  refreshAccess: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
