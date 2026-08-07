import { canUseTool, capabilitiesFor } from "./capabilities.ts";
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
Deno.test("application-wide reads follow operational role boundaries", () => {
  const allStaff: AssistantRole[] = [
    "owner",
    "manager",
    "sales_executive",
    "accountant",
    "mechanic_inspector",
  ];
  for (const role of allStaff) {
    assert(
      canUseTool({ role }, "search_parties"),
      `${role} needs party lookup`,
    );
    assert(
      canUseTool({ role }, "get_operational_records"),
      `${role} needs operational records`,
    );
    assert(
      canUseTool({ role }, "get_compliance_policies"),
      `${role} needs policy reads`,
    );
  }
  for (const role of ["owner", "manager", "accountant"] as AssistantRole[]) {
    assert(
      canUseTool({ role }, "search_partners"),
      `${role} needs partner lookup`,
    );
    assert(
      canUseTool({ role }, "get_finance_overview"),
      `${role} needs finance reads`,
    );
  }
  for (const role of ["owner", "manager"] as AssistantRole[]) {
    assert(
      canUseTool({ role }, "get_administration_overview"),
      `${role} needs administration reads`,
    );
  }
  assert(
    !canUseTool({ role: "sales_executive" }, "get_finance_overview"),
    "sales must not receive finance overview",
  );
  assert(
    !canUseTool({ role: "accountant" }, "get_administration_overview"),
    "accountant must not receive team or audit data",
  );
  assert(
    !canUseTool({ role: "partner" }, "search_parties"),
    "partner must remain portfolio-only",
  );
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
