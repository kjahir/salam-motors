import type {
  AssistantAction,
  AssistantPrincipal,
  AssistantRole,
  AssistantSurfaceContext,
} from "./types.ts";
import { isRecord, isUuid } from "./validation.ts";

export const ASSISTANT_PAGES = [
  "dashboard",
  "inventory",
  "add-vehicle",
  "vehicle",
  "parties",
  "partners",
  "finance",
  "alerts",
  "passport",
  "history",
  "policies",
  "team",
] as const;
export type AssistantPage = (typeof ASSISTANT_PAGES)[number];

const PAGE_ROLES: Partial<
  Record<AssistantPage, readonly AssistantRole[]>
> = {
  "add-vehicle": ["owner", "manager", "sales_executive"],
  partners: ["owner", "manager", "accountant"],
  finance: ["owner", "manager", "accountant"],
  team: ["owner", "manager"],
};
const MOBILE_PAGES = new Set<AssistantPage>([
  "dashboard",
  "inventory",
  "add-vehicle",
  "vehicle",
  "finance",
  "passport",
  "history",
]);
const VEHICLE_TABS = new Set([
  "overview",
  "expenses",
  "inspection",
  "documents",
  "sale",
]);

function short(value: unknown, maximum: number): string | undefined {
  return typeof value === "string"
    ? value.trim().slice(0, maximum) || undefined
    : undefined;
}

export function allowedNavigationPages(
  principal: AssistantPrincipal,
  surface: AssistantSurfaceContext["surface"],
): AssistantPage[] {
  if (principal.kind === "partner" || surface === "partner") return [];
  return ASSISTANT_PAGES.filter((page) => {
    const roles = PAGE_ROLES[page];
    return (!roles || roles.includes(principal.role)) &&
      (surface !== "mobile" || MOBILE_PAGES.has(page));
  });
}

export function normalizeNavigationAction(
  value: unknown,
  principal: AssistantPrincipal,
  context: AssistantSurfaceContext,
  evidenceVehicleIds: ReadonlySet<string> = new Set(),
): AssistantAction | null {
  if (!isRecord(value) || value.kind !== "navigate") return null;
  const page = short(value.page, 40) as AssistantPage | undefined;
  const label = short(value.label, 160);
  if (
    !page || !label ||
    !allowedNavigationPages(principal, context.surface).includes(page)
  ) return null;

  const rawParams = isRecord(value.params) ? value.params : {};
  const allowedVehicleIds = new Set(evidenceVehicleIds);
  if (isUuid(context.vehicleId)) allowedVehicleIds.add(context.vehicleId);
  const vehicleId = isUuid(rawParams.vehicleId) &&
      allowedVehicleIds.has(rawParams.vehicleId)
    ? rawParams.vehicleId
    : undefined;
  const historyVehicleId = isUuid(rawParams.historyVehicleId) &&
      allowedVehicleIds.has(rawParams.historyVehicleId)
    ? rawParams.historyVehicleId
    : undefined;
  const highlightPolicyId = isUuid(rawParams.highlightPolicyId)
    ? rawParams.highlightPolicyId
    : undefined;
  const rawTab = short(rawParams.tab, 40);
  const tab = rawTab && VEHICLE_TABS.has(rawTab) ? rawTab : undefined;
  const canEdit = ["owner", "manager", "sales_executive"].includes(
    principal.role,
  );
  const openEditVehicle = rawParams.openEditVehicle === true &&
      canEdit && Boolean(vehicleId)
    ? true
    : undefined;

  if (["vehicle", "passport"].includes(page) && !vehicleId) return null;
  if (page === "history" && rawParams.historyVehicleId && !historyVehicleId) {
    return null;
  }
  return {
    kind: "navigate",
    label,
    page,
    params: {
      vehicleId,
      historyVehicleId,
      tab,
      openEditVehicle,
      highlightPolicyId,
    },
  };
}

