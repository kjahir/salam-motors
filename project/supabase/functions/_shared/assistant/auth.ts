import { AssistantHttpError } from "./http.ts";
import {
  STAFF_ROLES,
  type AssistantPrincipal,
  type StaffRole,
  type SupabaseClientLike,
} from "./types.ts";

export function bearerToken(request: Request): string {
  const match = /^Bearer\s+(.+)$/i.exec(
    request.headers.get("Authorization") ?? "",
  );
  if (!match?.[1]) {
    throw new AssistantHttpError(
      401,
      "AUTH_REQUIRED",
      "Sign in to use the assistant.",
    );
  }
  return match[1];
}

async function assertActiveOrg(
  client: SupabaseClientLike,
  orgId: string,
): Promise<void> {
  const { data, error } = await client.rpc("resolve_request_org", {
    p_org_id: orgId,
    p_allow_partner: true,
  });
  if (error || data !== orgId) {
    throw new AssistantHttpError(
      403,
      "ORG_ACCESS_DENIED",
      "No active access to this dealership was found.",
    );
  }
}

export async function authenticatePrincipal(
  client: SupabaseClientLike,
): Promise<AssistantPrincipal> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user?.id) {
    throw new AssistantHttpError(
      401,
      "INVALID_SESSION",
      "Your session is no longer valid. Please sign in again.",
    );
  }

  const membershipResult = await client
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(2);
  if (membershipResult.error) {
    throw new AssistantHttpError(
      403,
      "ACCESS_CONTEXT_UNAVAILABLE",
      "Your dealership access could not be verified.",
    );
  }
  const memberships = Array.isArray(membershipResult.data)
    ? membershipResult.data
    : [];
  if (memberships.length > 1) {
    throw new AssistantHttpError(
      409,
      "ORG_SELECTION_REQUIRED",
      "Select a dealership before using the assistant.",
    );
  }
  if (memberships.length === 1) {
    const membership = memberships[0] as {
      org_id?: unknown;
      role?: unknown;
    };
    if (
      typeof membership.org_id !== "string" ||
      !STAFF_ROLES.includes(membership.role as StaffRole)
    ) {
      throw new AssistantHttpError(
        403,
        "INVALID_ACCESS_CONTEXT",
        "Your dealership role is not supported.",
      );
    }
    await assertActiveOrg(client, membership.org_id);
    return {
      kind: "staff",
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role as StaffRole,
      partnerId: null,
    };
  }

  const partnerResult = await client
    .from("partners")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(2);
  const partners = Array.isArray(partnerResult.data) ? partnerResult.data : [];
  if (partnerResult.error || partners.length !== 1) {
    throw new AssistantHttpError(
      403,
      "ACCESS_DENIED",
      "No active dealership or partner access was found.",
    );
  }
  const partner = partners[0] as { id?: unknown; org_id?: unknown };
  if (typeof partner.id !== "string" || typeof partner.org_id !== "string") {
    throw new AssistantHttpError(
      403,
      "INVALID_ACCESS_CONTEXT",
      "Your partner access is incomplete.",
    );
  }
  await assertActiveOrg(client, partner.org_id);
  return {
    kind: "partner",
    userId: user.id,
    orgId: partner.org_id,
    role: "partner",
    partnerId: partner.id,
  };
}

