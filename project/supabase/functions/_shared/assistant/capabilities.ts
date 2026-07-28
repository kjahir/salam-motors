import type { AssistantPrincipal, AssistantRole } from "./types.ts";

export type CapabilityRisk =
  | "read"
  | "low_risk_write"
  | "confirmation_required";

export interface Capability {
  id: string;
  toolName: string;
  description: string;
  risk: CapabilityRisk;
  roles: readonly AssistantRole[];
}

const ALL_STAFF: readonly AssistantRole[] = [
  "owner",
  "manager",
  "sales_executive",
  "accountant",
  "mechanic_inspector",
];

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "inventory.search",
    toolName: "search_inventory",
    description: "Search caller-visible vehicle inventory",
    risk: "read",
    roles: ALL_STAFF,
  },
  {
    id: "vehicle.read_360",
    toolName: "get_vehicle_360",
    description: "Read a role-filtered vehicle record",
    risk: "read",
    roles: ALL_STAFF,
  },
  {
    id: "dashboard.ageing",
    toolName: "get_dashboard_ageing",
    description: "Analyze inventory status and ageing",
    risk: "read",
    roles: ALL_STAFF,
  },
  {
    id: "alerts.compliance",
    toolName: "get_alerts_compliance",
    description: "Read alerts and policy-derived compliance gaps",
    risk: "read",
    roles: ALL_STAFF,
  },
  {
    id: "partner.portfolio",
    toolName: "get_partner_portfolio",
    description: "Read an authorized partner portfolio",
    risk: "read",
    roles: ["owner", "manager", "accountant", "partner"],
  },
  {
    id: "alert.acknowledge",
    toolName: "acknowledge_alert",
    description: "Acknowledge an explicitly identified alert",
    risk: "low_risk_write",
    roles: ALL_STAFF,
  },
  {
    id: "vehicle.create_with_purchase",
    toolName: "propose_create_vehicle_with_purchase",
    description: "Prepare atomic vehicle onboarding for confirmation",
    risk: "confirmation_required",
    roles: ["owner", "manager"],
  },
  {
    id: "vehicle.complete_sale",
    toolName: "propose_complete_vehicle_sale",
    description: "Prepare atomic sale completion for confirmation",
    risk: "confirmation_required",
    roles: ["owner"],
  },
] as const;

export function capabilitiesFor(
  principal: Pick<AssistantPrincipal, "role">,
): Capability[] {
  return CAPABILITIES.filter((capability) =>
    capability.roles.includes(principal.role)
  );
}

export function canUseTool(
  principal: Pick<AssistantPrincipal, "role">,
  toolName: string,
): boolean {
  return capabilitiesFor(principal).some((item) => item.toolName === toolName);
}

