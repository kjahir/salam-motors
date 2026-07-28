import {
  canUseTool,
  capabilitiesFor,
} from "./capabilities.ts";
import type { AssistantRole } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("partner receives only the partner portfolio capability", () => {
  const capabilities = capabilitiesFor({ role: "partner" });
  assert(capabilities.length === 1, "partner should receive one capability");
  assert(
    capabilities[0].toolName === "get_partner_portfolio",
    "partner capability must be portfolio-only",
  );
});

Deno.test("vehicle onboarding proposals are limited to owner and manager", () => {
  assert(
    canUseTool({ role: "owner" }, "propose_create_vehicle_with_purchase"),
    "owner should propose vehicle onboarding",
  );
  assert(
    canUseTool({ role: "manager" }, "propose_create_vehicle_with_purchase"),
    "manager should propose vehicle onboarding",
  );
  assert(
    !canUseTool({ role: "accountant" }, "propose_create_vehicle_with_purchase"),
    "accountant must not propose vehicle onboarding",
  );
  assert(
    !canUseTool(
      { role: "sales_executive" },
      "propose_create_vehicle_with_purchase",
    ),
    "sales role must not propose vehicle onboarding",
  );
});

Deno.test("sale completion proposals are owner-only", () => {
  assert(
    canUseTool({ role: "owner" }, "propose_complete_vehicle_sale"),
    "owner should propose sale completion",
  );
  const denied: AssistantRole[] = [
    "manager",
    "sales_executive",
    "accountant",
    "mechanic_inspector",
    "partner",
  ];
  for (const role of denied) {
    assert(
      !canUseTool({ role }, "propose_complete_vehicle_sale"),
      `${role} must not propose sale completion`,
    );
  }
});

Deno.test("every staff role has safe inventory and alert reads", () => {
  const roles: AssistantRole[] = [
    "owner",
    "manager",
    "sales_executive",
    "accountant",
    "mechanic_inspector",
  ];
  for (const role of roles) {
    assert(
      canUseTool({ role }, "search_inventory"),
      `${role} needs inventory search`,
    );
    assert(
      canUseTool({ role }, "get_alerts_compliance"),
      `${role} needs alert/compliance reads`,
    );
    assert(
      canUseTool({ role }, "acknowledge_alert"),
      `${role} needs alert acknowledgement`,
    );
  }
});

Deno.test("unknown tools are always denied", () => {
  assert(
    !canUseTool({ role: "owner" }, "propose_add_expense"),
    "retired tool names must not resolve",
  );
  assert(
    !canUseTool({ role: "owner" }, "run_sql"),
    "arbitrary tools must not resolve",
  );
});
