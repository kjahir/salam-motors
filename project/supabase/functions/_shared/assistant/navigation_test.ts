import { allowedNavigationPages } from "./navigation.ts";
import type { AssistantPrincipal, StaffRole } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function staff(role: StaffRole): AssistantPrincipal {
  return {
    kind: "staff",
    userId: "11111111-1111-4111-8111-111111111111",
    orgId: "22222222-2222-4222-8222-222222222222",
    role,
    partnerId: null,
  };
}

Deno.test("audit navigation follows the app's owner-manager permission", () => {
  assert(
    allowedNavigationPages(staff("owner"), "desktop").includes("audit"),
    "owner should be able to navigate to audit",
  );
  assert(
    allowedNavigationPages(staff("manager"), "desktop").includes("audit"),
    "manager should be able to navigate to audit",
  );
  assert(
    !allowedNavigationPages(staff("accountant"), "desktop").includes("audit"),
    "accountant should not be able to navigate to audit",
  );
});

Deno.test("audit remains unavailable on mobile and partner surfaces", () => {
  assert(
    !allowedNavigationPages(staff("owner"), "mobile").includes("audit"),
    "the mobile app has no audit page",
  );
  const partner: AssistantPrincipal = {
    kind: "partner",
    userId: "33333333-3333-4333-8333-333333333333",
    orgId: "22222222-2222-4222-8222-222222222222",
    role: "partner",
    partnerId: "44444444-4444-4444-8444-444444444444",
  };
  assert(
    !allowedNavigationPages(partner, "partner").includes("audit"),
    "partner surface should not receive staff navigation",
  );
});
