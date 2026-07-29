import { requireOrgStaff } from "./auth.ts";
import { ProteanHttpError } from "./http.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Minimal stand-in for the subset of the Supabase JS client this module
// uses: auth.getUser() and a chained from().select().eq().eq().eq().maybeSingle().
function fakeClient(options: {
  user: { id: string } | null;
  membership: { role: string; status: string } | null;
}) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve(
          options.user
            ? { data: { user: options.user }, error: null }
            : { data: { user: null }, error: new Error("no session") },
        ),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: options.membership, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

Deno.test("requireOrgStaff rejects when there is no authenticated user", async () => {
  const client = fakeClient({ user: null, membership: null });
  let threw: unknown;
  try {
    await requireOrgStaff(client, "org-1", ["owner"]);
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert((threw as ProteanHttpError).code === "INVALID_SESSION", "expected INVALID_SESSION");
});

Deno.test("requireOrgStaff rejects when the caller has no active membership in the org", async () => {
  const client = fakeClient({ user: { id: "user-1" }, membership: null });
  let threw: unknown;
  try {
    await requireOrgStaff(client, "org-1", ["owner"]);
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert((threw as ProteanHttpError).code === "ORG_ACCESS_DENIED", "expected ORG_ACCESS_DENIED");
});

Deno.test("requireOrgStaff rejects when the caller's role is not in the allowed list", async () => {
  const client = fakeClient({
    user: { id: "user-1" },
    membership: { role: "mechanic_inspector", status: "active" },
  });
  let threw: unknown;
  try {
    await requireOrgStaff(client, "org-1", ["owner", "manager"]);
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert((threw as ProteanHttpError).code === "ROLE_NOT_PERMITTED", "expected ROLE_NOT_PERMITTED");
});

Deno.test("requireOrgStaff resolves with userId/orgId/role when the caller is an active permitted member", async () => {
  const client = fakeClient({
    user: { id: "user-1" },
    membership: { role: "owner", status: "active" },
  });
  const result = await requireOrgStaff(client, "org-1", ["owner", "manager"]);
  assert(result.userId === "user-1", "expected userId");
  assert(result.orgId === "org-1", "expected orgId");
  assert(result.role === "owner", "expected role");
});
