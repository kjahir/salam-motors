// Lean org-membership check for the protean-* edge functions. Deliberately
// simpler than ../assistant/auth.ts (no partner principal, no
// resolve_request_org RPC): these functions are staff-only business
// actions (initiating a paid eSign/eStamp, spending a lookup-API call), so
// a direct `memberships` lookup mirroring invite-team-member/index.ts's
// pattern is enough. The caller-scoped Supabase client (built from the
// forwarded Authorization header) already has RLS applied, so this lookup
// can only ever see the caller's own membership rows regardless.

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase's fluent client is injected at runtime; business access stays behind this structural boundary. */
import { ProteanHttpError } from "./protean/http.ts";

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

export interface AuthenticatedStaff {
  userId: string;
  orgId: string;
  role: string;
  /** Membership email, used as the dealer-side signer address on generated documents. */
  email: string | null;
}

export async function requireOrgStaff(
  client: SupabaseClientLike,
  orgId: string,
  allowedRoles: readonly string[],
): Promise<AuthenticatedStaff> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw new ProteanHttpError(401, "INVALID_SESSION", "Your session is no longer valid. Please sign in again.");
  }

  const { data: membership, error: membershipError } = await client
    .from("memberships")
    .select("role, status, email")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new ProteanHttpError(403, "ORG_ACCESS_DENIED", "No active access to this dealership was found.");
  }
  if (!allowedRoles.includes(membership.role)) {
    throw new ProteanHttpError(
      403,
      "ROLE_NOT_PERMITTED",
      "Your role does not have permission to perform this action.",
    );
  }

  return {
    userId: userData.user.id,
    orgId,
    role: membership.role,
    email: typeof membership.email === "string" ? membership.email : null,
  };
}
