/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query rows are runtime-shaped; every outward record is selected, bounded, and normalized before model use. */
// deno-lint-ignore-file no-explicit-any
import {
  ACTION_SPECS,
  actionSpecByTool,
  actionTitle,
  type JsonSchema,
} from "./actions.ts";
import { sha256Hex, signActionToken } from "./action-token.ts";
import { canUseTool } from "./capabilities.ts";
import type { AssistantConfig } from "./config.ts";
import { AssistantPersistence } from "./persistence.ts";
import { addAuthoritativeSaleGuards } from "./sale-guard-loader.ts";
import type {
  ActionTokenPayload,
  AssistantPrincipal,
  AssistantRisk,
  IssuedProposal,
  SupabaseClientLike,
  ToolEntity,
  ToolResult,
} from "./types.ts";
import {
  asRecord,
  isUuid,
  nullableString,
  requiredNumber,
  requiredString,
} from "./validation.ts";

export interface OpenAIFunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
  strict: true;
}

export interface ToolExecutionContext {
  client: SupabaseClientLike;
  principal: AssistantPrincipal;
  config: AssistantConfig;
  persistence: AssistantPersistence;
  conversationId: string;
  runId: string | null;
  locale: string;
  issuedProposals: IssuedProposal[];
  evidence: Map<string, ToolEntity>;
  onStatus?: (message: string) => void;
}

const nullableText = (maximum = 200): JsonSchema => ({
  type: ["string", "null"],
  maxLength: maximum,
});
const nullableNumberSchema: JsonSchema = {
  type: ["number", "null"],
  minimum: 0,
};
const nullableUuid: JsonSchema = {
  type: ["string", "null"],
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};
const uuid: JsonSchema = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};

function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function functionTool(
  name: string,
  description: string,
  parameters: JsonSchema,
): OpenAIFunctionTool {
  return { type: "function", name, description, parameters, strict: true };
}

const READ_TOOLS: readonly OpenAIFunctionTool[] = [
  functionTool(
    "search_inventory",
    "Search caller-visible inventory by text, status, category, price, and days in stock. Null means no filter.",
    strictObject({
      query: nullableText(160),
      status: nullableText(80),
      category: nullableText(80),
      min_price: nullableNumberSchema,
      max_price: nullableNumberSchema,
      min_days: { type: ["integer", "null"], minimum: 0, maximum: 20_000 },
      max_days: { type: ["integer", "null"], minimum: 0, maximum: 20_000 },
      include_sold: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  functionTool(
    "get_vehicle_360",
    "Read one role-filtered vehicle record including inspections, document metadata, alerts, compliance, listing, history, and authorized finance data.",
    strictObject({ vehicle_id: uuid }),
  ),
  functionTool(
    "get_dashboard_ageing",
    "Summarize live inventory counts, asking value, status, and age buckets.",
    strictObject({
      include_sold: { type: "boolean" },
      ageing_threshold_days: {
        type: "integer",
        minimum: 1,
        maximum: 2_000,
      },
    }),
  ),
  functionTool(
    "get_alerts_compliance",
    "Read alerts and policy-derived compliance gaps. Null means no filter.",
    strictObject({
      vehicle_id: nullableUuid,
      status: nullableText(80),
      severity: nullableText(80),
      alert_type: nullableText(120),
      include_resolved: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  functionTool(
    "get_partner_portfolio",
    "Read investments, distributions, payable balance, and settlement ledger. Partner principals are always restricted to self.",
    strictObject({
      partner_id: nullableUuid,
      include_settled: { type: "boolean" },
    }),
  ),
  functionTool(
    "search_parties",
    "Find sellers, buyers, or mechanics by name, mobile, email, type, or exact ID. Use this to resolve party IDs before proposing vehicle purchases or sales.",
    strictObject({
      query: nullableText(160),
      party_type: nullableText(40),
      party_id: nullableUuid,
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  functionTool(
    "search_partners",
    "Find investment partners by name, mobile, email, status, or exact ID.",
    strictObject({
      query: nullableText(160),
      status: nullableText(40),
      partner_id: nullableUuid,
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  functionTool(
    "get_finance_overview",
    "Read organization finance totals and bounded supporting records for purchases, sales, expenses, investments, distributions, and settlements.",
    strictObject({
      vehicle_id: nullableUuid,
      date_from: nullableText(20),
      date_to: nullableText(20),
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  functionTool(
    "get_operational_records",
    "Read inspections, document metadata, listings, and enquiries, optionally for one vehicle.",
    strictObject({
      vehicle_id: nullableUuid,
      record_type: {
        type: "string",
        enum: ["all", "inspections", "documents", "listings", "enquiries"],
      },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  functionTool(
    "get_compliance_policies",
    "Read compliance policies and their current active state, severity, thresholds, and requirements.",
    strictObject({
      active_only: { type: "boolean" },
      policy_type: nullableText(80),
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  functionTool(
    "get_administration_overview",
    "Read role-authorized organization membership and audit activity. Sensitive credentials are never returned.",
    strictObject({
      section: { type: "string", enum: ["team", "audit", "both"] },
      entity_type: nullableText(80),
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  functionTool(
    "acknowledge_alert",
    "Immediately acknowledge one open alert. Call only after an explicit user request for that exact alert.",
    strictObject({ alert_id: uuid }),
  ),
] as const;

export function toolsForPrincipal(
  principal: AssistantPrincipal,
): OpenAIFunctionTool[] {
  const proposals = ACTION_SPECS.map((spec) =>
    functionTool(
      spec.toolName,
      `Prepare "${spec.title}" for human confirmation. This never executes the action.`,
      spec.parameters,
    )
  );
  return [...READ_TOOLS, ...proposals].filter((candidate) =>
    canUseTool(principal, candidate.name)
  );
}

export function toolRisk(name: string): AssistantRisk {
  return actionSpecByTool(name)?.risk ?? "low";
}

class ToolDatabaseError extends Error {
  constructor(readonly operation: string) {
    super(operation);
  }
}

function rows(result: any, operation: string): any[] {
  if (result.error) throw new ToolDatabaseError(operation);
  return Array.isArray(result.data) ? result.data : [];
}

function one(result: any, operation: string): any {
  if (result.error) throw new ToolDatabaseError(operation);
  return result.data ?? null;
}

function bool(object: Record<string, unknown>, key: string): boolean {
  if (typeof object[key] !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }
  return object[key] as boolean;
}

function nullableNumber(
  object: Record<string, unknown>,
  key: string,
): number | null {
  return object[key] === null ? null : requiredNumber(object, key, 0);
}

function nullableInteger(
  object: Record<string, unknown>,
  key: string,
): number | null {
  if (object[key] === null) return null;
  const value = requiredNumber(object, key, 0, 20_000);
  if (!Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  return value;
}

function optionalUuid(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value = nullableString(object, key, 64);
  if (value && !isUuid(value)) throw new Error(`${key} must be a UUID`);
  return value;
}

function daysSince(value: unknown): number {
  if (typeof value !== "string") return 0;
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
    : 0;
}

function financeVisible(principal: AssistantPrincipal): boolean {
  return ["owner", "manager", "accountant"].includes(principal.role);
}

function entity(
  type: string,
  id: unknown,
  label: unknown,
): ToolEntity | null {
  return typeof id === "string"
    ? { type, id, label: String(label ?? id).slice(0, 200) }
    : null;
}

async function searchInventory(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const text = nullableString(args, "query", 160)?.toLocaleLowerCase() ?? null;
  const status = nullableString(args, "status", 80)?.toLocaleLowerCase() ??
    null;
  const category = nullableString(args, "category", 80)?.toLocaleLowerCase() ??
    null;
  const minPrice = nullableNumber(args, "min_price");
  const maxPrice = nullableNumber(args, "max_price");
  const minDays = nullableInteger(args, "min_days");
  const maxDays = nullableInteger(args, "max_days");
  const includeSold = bool(args, "include_sold");
  const limit = requiredNumber(args, "limit", 1, 50);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new Error("min_price cannot exceed max_price");
  }
  if (minDays !== null && maxDays !== null && minDays > maxDays) {
    throw new Error("min_days cannot exceed max_days");
  }

  let request: any = context.client.from("vehicles").select(
    "id, stock_number, registration_number, category, manufacturer, model, variant, fuel_type, manufacture_year, odometer, current_status, asking_price, minimum_price, onboarded_at",
    { count: "exact" },
  ).eq("org_id", context.principal.orgId).is("deleted_at", null)
    .order("onboarded_at", { ascending: false }).limit(limit);
  if (text) {
    const safe = text.replace(/[%_,()]/g, " ").trim();
    if (safe) {
      request = request.or(
        `stock_number.ilike.%${safe}%,registration_number.ilike.%${safe}%,manufacturer.ilike.%${safe}%,model.ilike.%${safe}%,variant.ilike.%${safe}%`,
      );
    }
  }
  if (status) request = request.ilike("current_status", status);
  if (category) request = request.ilike("category", category);
  if (!includeSold) request = request.neq("current_status", "SOLD");
  if (minPrice !== null) request = request.gte("asking_price", minPrice);
  if (maxPrice !== null) request = request.lte("asking_price", maxPrice);
  if (minDays !== null) {
    request = request.lte(
      "onboarded_at",
      new Date(Date.now() - minDays * 86_400_000).toISOString(),
    );
  }
  if (maxDays !== null) {
    request = request.gte(
      "onboarded_at",
      new Date(Date.now() - (maxDays + 1) * 86_400_000).toISOString(),
    );
  }
  const result: any = await request;
  let vehicles = rows(result, "inventory search").map((vehicle) => ({
    ...vehicle,
    days_in_stock: daysSince(vehicle.onboarded_at),
  }));

  if (financeVisible(context.principal) && vehicles.length) {
    const financeResult = await context.client
      .from("vehicle_financial_summary")
      .select(
        "vehicle_id, total_vehicle_cost, estimated_profit, gross_profit",
      )
      .in("vehicle_id", vehicles.map((vehicle) => vehicle.id));
    const finance = rows(financeResult, "inventory finance");
    const byVehicle = new Map(finance.map((item) => [item.vehicle_id, item]));
    vehicles = vehicles.map((vehicle) => ({
      ...vehicle,
      financials: byVehicle.get(vehicle.id) ?? null,
    }));
  }

  return {
    ok: true,
    data: {
      total: result.count ?? vehicles.length,
      returned: vehicles.length,
      count: result.count ?? vehicles.length,
      vehicles,
      filters: {
        query: text,
        status,
        category,
        min_price: minPrice,
        max_price: maxPrice,
        min_days: minDays,
        max_days: maxDays,
      },
    },
    entities: vehicles.map((vehicle) =>
      entity(
        "vehicle",
        vehicle.id,
        `${vehicle.stock_number} · ${vehicle.manufacturer} ${vehicle.model}`,
      )!
    ),
    truncated: Number(result.count ?? vehicles.length) > vehicles.length,
  };
}

async function getVehicle360(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const vehicleId = requiredString(args, "vehicle_id", 64);
  if (!isUuid(vehicleId)) throw new Error("vehicle_id must be a UUID");
  const vehicleResult = await context.client
    .from("vehicles")
    .select(
      "id, stock_number, registration_number, category, manufacturer, brand, model, variant, fuel_type, colour, manufacture_year, registration_date, odometer, owner_count, registration_city, registration_state, current_location, current_status, asking_price, minimum_price, onboarded_at, sold_at, created_at, updated_at",
    )
    .eq("id", vehicleId)
    .eq("org_id", context.principal.orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const vehicle = one(vehicleResult, "vehicle");
  if (!vehicle) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Vehicle not found or not visible" },
    };
  }

  const [
    inspectionResult,
    documentResult,
    mediaResult,
    alertResult,
    listingResult,
    historyResult,
    complianceResult,
  ] = await Promise.all([
    context.client.from("inspections").select(
      "id, inspection_type, inspection_date, inspector_name, mechanic_party_id, overall_manual_score, accident_status, summary, status, mechanic:parties(id, full_name, mobile, email), items:inspection_items(id, category, score, condition_level, observation, recommended_action, estimated_cost, urgency, weight)",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .order("inspection_date", { ascending: false }).limit(20),
    context.client.from("vehicle_documents").select(
      "id, document_type, issue_date, expiry_date, issuer, verification_status, verified_at, version, created_at",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(
        100,
      ),
    context.client.from("vehicle_media").select(
      "id, media_type, media_category, uploaded_at",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .is("deleted_at", null).limit(100),
    context.client.from("alerts").select(
      "id, alert_type, severity, title, message, days_in_inventory, status, acknowledged_at, resolved_at, policy_id, created_at",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }).limit(100),
    context.client.from("listings").select(
      "id, asking_price, minimum_price, status, listed_at, public_slug, created_at",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }).limit(20),
    context.client.from("vehicle_status_history").select(
      "id, previous_status, new_status, reason, changed_at",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .order("changed_at", { ascending: false }).limit(100),
    context.client.from("vehicle_compliance_status").select(
      "vehicle_id, violation_count, max_severity_rank, violations",
    ).eq("vehicle_id", vehicleId).maybeSingle(),
  ]);

  const data: Record<string, unknown> = {
    vehicle: { ...vehicle, days_in_stock: daysSince(vehicle.onboarded_at) },
    inspections: rows(inspectionResult, "inspections"),
    documents: rows(documentResult, "documents"),
    media_count: rows(mediaResult, "media").length,
    media: rows(mediaResult, "media"),
    alerts: rows(alertResult, "alerts"),
    listings: rows(listingResult, "listings"),
    status_history: rows(historyResult, "status history"),
    compliance: one(complianceResult, "compliance"),
  };

  if (
    ["owner", "manager", "sales_executive", "accountant"].includes(
      context.principal.role,
    )
  ) {
    const saleResult = await context.client.from("sales").select(
      "id, buyer_party_id, sale_date, sale_price, discount, buyer_charges, payment_status, delivery_status, delivered_at, status, created_at, buyer:parties(id, full_name, mobile, email), payments:sale_payments(id, amount, payment_method, reference, paid_at)",
    ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
      .order("sale_date", { ascending: false }).limit(20);
    data.sales = rows(saleResult, "sales");
  }

  if (financeVisible(context.principal)) {
    const [
      summaryResult,
      purchaseResult,
      expenseResult,
      investmentResult,
      distributionResult,
    ] = await Promise.all([
      context.client.from("vehicle_financial_summary").select("*").eq(
        "vehicle_id",
        vehicleId,
      ).maybeSingle(),
      context.client.from("purchases").select(
        "id, seller_party_id, purchase_date, agreed_price, broker_commission, other_fee, payment_status, created_at, seller:parties(id, full_name, mobile, email), payments:purchase_payments(id, amount, payment_method, reference, paid_at)",
      ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
        .limit(20),
      context.client.from("expenses").select(
        "id, category, amount, expense_date, vendor, approval_status, created_at",
      ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
        .is("deleted_at", null).order("expense_date", { ascending: false })
        .limit(200),
      context.client.from("investments").select(
        "id, partner_id, amount, investment_date, purpose, status, created_at, partner:partners(id, name, mobile, email)",
      ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
        .limit(200),
      context.client.from("profit_distributions").select(
        "id, sale_id, partner_id, principal_return, profit_share, loss_share, total_entitlement, amount_paid, balance_payable, status, created_at, partner:partners(id, name, mobile, email)",
      ).eq("org_id", context.principal.orgId).eq("vehicle_id", vehicleId)
        .limit(200),
    ]);
    data.financial_summary = one(summaryResult, "financial summary");
    data.purchases = rows(purchaseResult, "purchases");
    data.expenses = rows(expenseResult, "expenses");
    data.investments = rows(investmentResult, "investments");
    data.profit_distributions = rows(distributionResult, "distributions");
  }

  const entities: ToolEntity[] = [
    entity(
      "vehicle",
      vehicle.id,
      `${vehicle.stock_number} · ${vehicle.manufacturer} ${vehicle.model}`,
    )!,
  ];
  for (const alert of data.alerts as any[]) {
    const item = entity("alert", alert.id, alert.title);
    if (item) entities.push(item);
  }
  return { ok: true, data, entities };
}

async function getDashboardAgeing(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const includeSold = bool(args, "include_sold");
  const threshold = requiredNumber(args, "ageing_threshold_days", 1, 2_000);
  if (!Number.isInteger(threshold)) {
    throw new Error("ageing_threshold_days must be an integer");
  }
  const result = await context.client.from("vehicles").select(
    "id, stock_number, manufacturer, model, current_status, asking_price, onboarded_at",
  ).eq("org_id", context.principal.orgId).is("deleted_at", null)
    .order("onboarded_at", { ascending: false }).limit(1_000);
  const vehicles = rows(result, "dashboard").map((vehicle) => ({
    ...vehicle,
    days_in_stock: daysSince(vehicle.onboarded_at),
  })).filter((vehicle) =>
    includeSold ||
    !String(vehicle.current_status ?? "").toLowerCase().includes("sold")
  );

  const statusCounts: Record<string, number> = {};
  const ageBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "91+": 0 };
  let askingValue = 0;
  for (const vehicle of vehicles) {
    const status = String(vehicle.current_status ?? "Unknown");
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    askingValue += Number(vehicle.asking_price ?? 0);
    if (vehicle.days_in_stock <= 30) ageBuckets["0-30"] += 1;
    else if (vehicle.days_in_stock <= 60) ageBuckets["31-60"] += 1;
    else if (vehicle.days_in_stock <= 90) ageBuckets["61-90"] += 1;
    else ageBuckets["91+"] += 1;
  }
  const ageing = vehicles.filter((vehicle) =>
    vehicle.days_in_stock >= threshold
  ).sort((left, right) => right.days_in_stock - left.days_in_stock).slice(
    0,
    50,
  );
  const data: Record<string, unknown> = {
    inventory_count: vehicles.length,
    asking_value: askingValue,
    status_counts: statusCounts,
    age_buckets: ageBuckets,
    ageing_threshold_days: threshold,
    ageing_vehicles: ageing,
  };
  if (financeVisible(context.principal) && vehicles.length) {
    const financeResult = await context.client.from(
      "vehicle_financial_summary",
    ).select(
      "vehicle_id, total_vehicle_cost, estimated_profit, gross_profit, total_invested",
    ).in("vehicle_id", vehicles.map((vehicle) => vehicle.id));
    const finance = rows(financeResult, "dashboard finance");
    data.financial_totals = finance.reduce(
      (totals: Record<string, number>, item: any) => {
        for (
          const key of [
            "total_vehicle_cost",
            "estimated_profit",
            "gross_profit",
            "total_invested",
          ]
        ) {
          totals[key] = (totals[key] ?? 0) + Number(item[key] ?? 0);
        }
        return totals;
      },
      {},
    );
  }
  return {
    ok: true,
    data,
    entities: ageing.map((vehicle) =>
      entity(
        "vehicle",
        vehicle.id,
        `${vehicle.stock_number} · ${vehicle.manufacturer} ${vehicle.model}`,
      )!
    ),
    truncated: vehicles.length >= 1_000 || ageing.length >= 50,
  };
}

async function getAlertsCompliance(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const vehicleId = optionalUuid(args, "vehicle_id");
  const status = nullableString(args, "status", 80);
  const severity = nullableString(args, "severity", 80);
  const alertType = nullableString(args, "alert_type", 120);
  const includeResolved = bool(args, "include_resolved");
  const limit = requiredNumber(args, "limit", 1, 100);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");

  let alertQuery = context.client.from("alerts").select(
    "id, vehicle_id, alert_type, severity, title, message, days_in_inventory, status, acknowledged_at, resolved_at, policy_id, created_at",
  ).eq("org_id", context.principal.orgId).order("created_at", {
    ascending: false,
  }).limit(limit);
  if (vehicleId) alertQuery = alertQuery.eq("vehicle_id", vehicleId);
  if (status) alertQuery = alertQuery.eq("status", status);
  if (severity) alertQuery = alertQuery.eq("severity", severity);
  if (alertType) alertQuery = alertQuery.eq("alert_type", alertType);
  if (!includeResolved && !status) {
    alertQuery = alertQuery.neq("status", "Resolved");
  }

  let complianceQuery = context.client.from("vehicle_compliance_status")
    .select("vehicle_id, violation_count, max_severity_rank, violations")
    .gt("violation_count", 0).limit(limit);
  if (vehicleId) complianceQuery = complianceQuery.eq("vehicle_id", vehicleId);
  const [alertResult, complianceResult] = await Promise.all([
    alertQuery,
    complianceQuery,
  ]);
  const alerts = rows(alertResult, "alerts");
  const compliance = rows(complianceResult, "compliance");
  const entities = alerts.map((alert) => entity("alert", alert.id, alert.title))
    .filter(Boolean) as ToolEntity[];
  for (const item of compliance) {
    const vehicle = entity(
      "vehicle",
      item.vehicle_id,
      `Vehicle ${item.vehicle_id} compliance`,
    );
    if (vehicle) entities.push(vehicle);
  }
  return {
    ok: true,
    data: {
      alert_count: alerts.length,
      alerts,
      compliance_gap_count: compliance.length,
      compliance,
    },
    entities,
    truncated: alerts.length === limit || compliance.length === limit,
  };
}

async function getPartnerPortfolio(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const requestedPartnerId = optionalUuid(args, "partner_id");
  const includeSettled = bool(args, "include_settled");
  const partnerId = context.principal.kind === "partner"
    ? context.principal.partnerId
    : requestedPartnerId;
  if (!partnerId) {
    return {
      ok: false,
      error: {
        code: "PARTNER_REQUIRED",
        message: "Choose one partner before requesting a partner portfolio",
      },
    };
  }

  let investmentQuery = context.client.from("investments").select(
    "id, partner_id, vehicle_id, amount, investment_date, purpose, payment_method, reference, status, created_at",
  ).eq("org_id", context.principal.orgId).order("investment_date", {
    ascending: false,
  }).limit(500);
  let distributionQuery = context.client.from("profit_distributions").select(
    "id, vehicle_id, sale_id, partner_id, principal_return, profit_share, loss_share, total_entitlement, amount_paid, balance_payable, status, created_at",
  ).eq("org_id", context.principal.orgId).order("created_at", {
    ascending: false,
  }).limit(500);
  if (partnerId) {
    investmentQuery = investmentQuery.eq("partner_id", partnerId);
    distributionQuery = distributionQuery.eq("partner_id", partnerId);
  }
  if (!includeSettled) {
    distributionQuery = distributionQuery.neq("status", "Paid");
  }

  const [investmentResult, distributionResult] = await Promise.all([
    investmentQuery,
    distributionQuery,
  ]);
  const investments = rows(investmentResult, "investments");
  const distributions = rows(distributionResult, "distributions");
  const distributionIds = distributions.map((item) => item.id);
  let settlements: any[] = [];
  if (distributionIds.length) {
    const settlementResult = await context.client.from(
      "profit_settlement_payments",
    ).select(
      "id, distribution_id, amount, payment_method, reference, paid_at, created_at",
    ).eq("org_id", context.principal.orgId).in(
      "distribution_id",
      distributionIds,
    ).order("paid_at", { ascending: false }).limit(500);
    settlements = rows(settlementResult, "settlements");
  }
  const summary = {
    invested: investments.reduce(
      (sum: number, item: any) => sum + Number(item.amount ?? 0),
      0,
    ),
    entitlement: distributions.reduce(
      (sum: number, item: any) => sum + Number(item.total_entitlement ?? 0),
      0,
    ),
    paid: distributions.reduce(
      (sum: number, item: any) => sum + Number(item.amount_paid ?? 0),
      0,
    ),
    payable: distributions.reduce(
      (sum: number, item: any) => sum + Number(item.balance_payable ?? 0),
      0,
    ),
  };
  const entities: ToolEntity[] = [];
  for (const item of investments) {
    const source = entity("investment", item.id, `Investment ${item.id}`);
    if (source) entities.push(source);
  }
  for (const item of distributions) {
    const source = entity(
      "profit_distribution",
      item.id,
      `Distribution ${item.id}`,
    );
    if (source) entities.push(source);
  }
  return {
    ok: true,
    data: {
      partner_id: partnerId,
      summary,
      investments,
      distributions,
      settlements,
    },
    entities,
    truncated: investments.length === 500 || distributions.length === 500,
  };
}

async function searchParties(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const query = nullableString(args, "query", 160);
  const partyType = nullableString(args, "party_type", 40);
  const partyId = optionalUuid(args, "party_id");
  const limit = requiredNumber(args, "limit", 1, 50);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  let request = context.client.from("parties").select(
    "id, party_type, party_subtype, full_name, mobile, email, city, state, consent, created_at",
    { count: "exact" },
  ).eq("org_id", context.principal.orgId).is("deleted_at", null)
    .order("full_name", { ascending: true }).limit(limit);
  if (partyId) request = request.eq("id", partyId);
  if (partyType) request = request.eq("party_type", partyType);
  if (query) {
    const safe = query.replace(/[%_,()]/g, " ").trim();
    if (safe) {
      request = request.or(
        `full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,email.ilike.%${safe}%`,
      );
    }
  }
  const result: any = await request;
  const parties = rows(result, "party search");
  return {
    ok: true,
    data: {
      total: result.count ?? parties.length,
      returned: parties.length,
      parties,
    },
    entities: parties.map((party) =>
      entity("party", party.id, party.full_name)!
    ),
    truncated: Number(result.count ?? parties.length) > parties.length,
  };
}

async function searchPartners(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const query = nullableString(args, "query", 160);
  const status = nullableString(args, "status", 40);
  const partnerId = optionalUuid(args, "partner_id");
  const limit = requiredNumber(args, "limit", 1, 50);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  let request = context.client.from("partners").select(
    "id, name, mobile, email, default_profit_share_pct, joining_date, status, created_at",
    { count: "exact" },
  ).eq("org_id", context.principal.orgId).is("deleted_at", null)
    .order("name", { ascending: true }).limit(limit);
  if (partnerId) request = request.eq("id", partnerId);
  if (status) request = request.eq("status", status);
  if (query) {
    const safe = query.replace(/[%_,()]/g, " ").trim();
    if (safe) {
      request = request.or(
        `name.ilike.%${safe}%,mobile.ilike.%${safe}%,email.ilike.%${safe}%`,
      );
    }
  }
  const result: any = await request;
  const partners = rows(result, "partner search");
  return {
    ok: true,
    data: {
      total: result.count ?? partners.length,
      returned: partners.length,
      partners,
    },
    entities: partners.map((partner) =>
      entity("partner", partner.id, partner.name)!
    ),
    truncated: Number(result.count ?? partners.length) > partners.length,
  };
}

async function getFinanceOverview(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const vehicleId = optionalUuid(args, "vehicle_id");
  const dateFrom = nullableString(args, "date_from", 20);
  const dateTo = nullableString(args, "date_to", 20);
  const limit = requiredNumber(args, "limit", 1, 100);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  const apply = (request: any, dateColumn: string) => {
    let next = request.eq("org_id", context.principal.orgId).limit(limit);
    if (vehicleId) next = next.eq("vehicle_id", vehicleId);
    if (dateFrom) next = next.gte(dateColumn, dateFrom);
    if (dateTo) next = next.lte(dateColumn, dateTo);
    return next;
  };
  const [
    purchasesResult,
    salesResult,
    expensesResult,
    investmentsResult,
    distributionsResult,
  ] = await Promise.all([
    apply(
      context.client.from("purchases").select(
        "id, vehicle_id, seller_party_id, purchase_date, agreed_price, broker_commission, other_fee, payment_status",
        { count: "exact" },
      ),
      "purchase_date",
    ).order("purchase_date", { ascending: false }),
    apply(
      context.client.from("sales").select(
        "id, vehicle_id, buyer_party_id, sale_date, sale_price, discount, buyer_charges, payment_status, delivery_status, status",
        { count: "exact" },
      ),
      "sale_date",
    ).order("sale_date", { ascending: false }),
    apply(
      context.client.from("expenses").select(
        "id, vehicle_id, category, amount, expense_date, vendor, approval_status, paid_by_partner_id",
        { count: "exact" },
      ).is("deleted_at", null),
      "expense_date",
    ).order("expense_date", { ascending: false }),
    apply(
      context.client.from("investments").select(
        "id, vehicle_id, partner_id, amount, investment_date, purpose, payment_method, status",
        { count: "exact" },
      ),
      "investment_date",
    ).order("investment_date", { ascending: false }),
    apply(
      context.client.from("profit_distributions").select(
        "id, vehicle_id, sale_id, partner_id, principal_return, profit_share, loss_share, total_entitlement, amount_paid, balance_payable, status, created_at",
        { count: "exact" },
      ),
      "created_at",
    ).order("created_at", { ascending: false }),
  ]);
  const group = (result: any, operation: string) => {
    const records = rows(result, operation);
    return {
      total: result.count ?? records.length,
      returned: records.length,
      records,
    };
  };
  const purchases = group(purchasesResult, "finance purchases");
  const sales = group(salesResult, "finance sales");
  const expenses = group(expensesResult, "finance expenses");
  const investments = group(investmentsResult, "finance investments");
  const distributions = group(distributionsResult, "finance distributions");
  const all = [purchases, sales, expenses, investments, distributions];
  return {
    ok: true,
    data: {
      filters: { vehicle_id: vehicleId, date_from: dateFrom, date_to: dateTo },
      purchases,
      sales,
      expenses,
      investments,
      distributions,
    },
    entities: [
      ...purchases.records.map((item: any) =>
        entity("purchase", item.id, `Purchase ${item.id}`)!
      ),
      ...sales.records.map((item: any) =>
        entity("sale", item.id, `Sale ${item.id}`)!
      ),
      ...expenses.records.map((item: any) =>
        entity("expense", item.id, `${item.category} expense`)!
      ),
      ...investments.records.map((item: any) =>
        entity("investment", item.id, `Investment ${item.id}`)!
      ),
    ],
    truncated: all.some((item) => Number(item.total) > item.returned),
  };
}

async function getOperationalRecords(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const vehicleId = optionalUuid(args, "vehicle_id");
  const recordType = requiredString(args, "record_type", 40);
  const supported = [
    "all",
    "inspections",
    "documents",
    "listings",
    "enquiries",
  ];
  if (!supported.includes(recordType)) {
    throw new Error("record_type is not supported");
  }
  const limit = requiredNumber(args, "limit", 1, 100);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  const read = async (
    table: string,
    select: string,
    order: string,
    deleted = false,
  ) => {
    let request = context.client.from(table).select(select, { count: "exact" })
      .eq("org_id", context.principal.orgId).order(order, { ascending: false })
      .limit(limit);
    if (vehicleId) request = request.eq("vehicle_id", vehicleId);
    if (deleted) request = request.is("deleted_at", null);
    const result: any = await request;
    const records = rows(result, `operational ${table}`);
    return {
      total: result.count ?? records.length,
      returned: records.length,
      records,
    };
  };
  const selected = (name: string) =>
    recordType === "all" || recordType === name;
  const [inspections, documents, listings, enquiries] = await Promise.all([
    selected("inspections")
      ? read(
        "inspections",
        "id, vehicle_id, inspection_type, inspection_date, inspector_name, mechanic_party_id, overall_manual_score, accident_status, summary, status, created_at",
        "inspection_date",
      )
      : null,
    selected("documents")
      ? read(
        "vehicle_documents",
        "id, vehicle_id, document_type, issue_date, expiry_date, issuer, verification_status, verified_at, version, created_at",
        "created_at",
        true,
      )
      : null,
    selected("listings")
      ? read(
        "listings",
        "id, vehicle_id, asking_price, minimum_price, status, listed_at, public_slug, created_at",
        "created_at",
      )
      : null,
    selected("enquiries")
      ? read(
        "enquiries",
        "id, vehicle_id, listing_id, buyer_party_id, enquiry_date, channel, offered_price, status, follow_up_date, assigned_to, created_at",
        "enquiry_date",
      )
      : null,
  ]);
  const groups = { inspections, documents, listings, enquiries };
  const entities: ToolEntity[] = [];
  for (const [type, group] of Object.entries(groups)) {
    for (const item of group?.records ?? []) {
      const source = entity(
        type.slice(0, -1),
        item.id,
        `${type.slice(0, -1)} ${item.id}`,
      );
      if (source) entities.push(source);
    }
  }
  return {
    ok: true,
    data: { vehicle_id: vehicleId, ...groups },
    entities,
    truncated: Object.values(groups).some((group) =>
      group !== null && Number(group.total) > group.returned
    ),
  };
}

async function getCompliancePolicies(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const activeOnly = bool(args, "active_only");
  const policyType = nullableString(args, "policy_type", 80);
  const limit = requiredNumber(args, "limit", 1, 100);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  let request = context.client.from("compliance_policies").select(
    "id, name, description, category, rule_type, params, severity, is_active, resolution_mode, created_at, updated_at",
    { count: "exact" },
  ).eq("org_id", context.principal.orgId).is("deleted_at", null)
    .order("updated_at", { ascending: false }).limit(limit);
  if (activeOnly) request = request.eq("is_active", true);
  if (policyType) request = request.eq("rule_type", policyType);
  const result: any = await request;
  const policies = rows(result, "compliance policies");
  return {
    ok: true,
    data: {
      total: result.count ?? policies.length,
      returned: policies.length,
      policies,
    },
    entities: policies.map((policy) =>
      entity("compliance_policy", policy.id, policy.name)!
    ),
    truncated: Number(result.count ?? policies.length) > policies.length,
  };
}

async function getAdministrationOverview(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const section = requiredString(args, "section", 20);
  if (!["team", "audit", "both"].includes(section)) {
    throw new Error("section is not supported");
  }
  const entityType = nullableString(args, "entity_type", 80);
  const limit = requiredNumber(args, "limit", 1, 100);
  if (!Number.isInteger(limit)) throw new Error("limit must be an integer");
  const teamPromise = section === "team" || section === "both"
    ? context.client.from("memberships").select(
      "id, user_id, role, status, display_name, email, invited_at, joined_at, created_at",
      { count: "exact" },
    ).eq("org_id", context.principal.orgId).order("created_at", {
      ascending: false,
    }).limit(limit)
    : Promise.resolve({ data: [], error: null, count: 0 });
  let auditRequest: any = context.client.from("audit_logs").select(
    "id, entity_type, entity_id, action, performed_by, performed_at, reason, source, changed_fields",
    { count: "exact" },
  ).eq("org_id", context.principal.orgId).order("performed_at", {
    ascending: false,
  }).limit(limit);
  if (entityType) auditRequest = auditRequest.eq("entity_type", entityType);
  const auditPromise = section === "audit" || section === "both"
    ? auditRequest
    : Promise.resolve({ data: [], error: null, count: 0 });
  const [teamResult, auditResult]: any[] = await Promise.all([
    teamPromise,
    auditPromise,
  ]);
  const team = rows(teamResult, "team overview");
  const audit = rows(auditResult, "audit overview");
  return {
    ok: true,
    data: {
      team: {
        total: teamResult.count ?? team.length,
        returned: team.length,
        records: team,
      },
      audit: {
        total: auditResult.count ?? audit.length,
        returned: audit.length,
        records: audit,
      },
    },
    entities: audit.map((item) =>
      entity("audit_log", item.id, `${item.entity_type} ${item.action}`)!
    ),
    truncated: Number(teamResult.count ?? team.length) > team.length ||
      Number(auditResult.count ?? audit.length) > audit.length,
  };
}

async function acknowledgeAlert(
  context: ToolExecutionContext,
  raw: unknown,
): Promise<ToolResult> {
  const args = asRecord(raw);
  const alertId = requiredString(args, "alert_id", 64);
  if (!isUuid(alertId)) throw new Error("alert_id must be a UUID");
  const result = await context.client.rpc("assistant_acknowledge_alert", {
    p_org_id: context.principal.orgId,
    p_alert_id: alertId,
  });
  const updated = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) throw new ToolDatabaseError("acknowledge alert");
  if (!updated) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The alert is not open or is no longer visible",
      },
    };
  }
  return {
    ok: true,
    data: updated,
    entities: [entity("alert", updated.id, updated.title)!],
  };
}

async function createProposal(
  context: ToolExecutionContext,
  name: string,
  raw: unknown,
): Promise<ToolResult> {
  const spec = actionSpecByTool(name);
  if (!spec) throw new Error("Unknown proposal action");
  if (!context.config.actionTokenSecret) {
    return {
      ok: false,
      error: {
        code: "ACTIONS_NOT_CONFIGURED",
        message: "Confirmation-required actions are not configured",
      },
    };
  }
  let parsed = spec.parse(raw, context.principal, context.locale);
  if (spec.actionType === "vehicle.complete_sale") {
    parsed = await addAuthoritativeSaleGuards(
      context.client,
      context.principal.orgId,
      parsed,
      context.locale,
    );
  }
  const localHash = await sha256Hex({
    action_type: spec.actionType,
    arguments: parsed.arguments,
    target_type: parsed.targetType,
    target_id: parsed.targetId,
  });
  const idempotencyKey = `proposal:${context.runId ?? context.conversationId}:${
    localHash.slice(0, 32)
  }`;
  const localizedTitle = actionTitle(spec.actionType, context.locale);
  const preview = {
    title: localizedTitle,
    summary: parsed.summary,
    changes: parsed.changes,
  };
  const { data, error } = await context.client.rpc(
    context.config.rpc.createProposal,
    {
      p_org_id: context.principal.orgId,
      p_conversation_id: context.conversationId,
      p_action_type: spec.actionType,
      p_arguments: parsed.arguments,
      p_preview: preview,
      p_idempotency_key: idempotencyKey,
      p_run_id: context.runId,
      p_tool_call_id: null,
      p_target_type: parsed.targetType,
      p_target_id: parsed.targetId,
      p_ttl_seconds: context.config.actionTtlSeconds,
    },
  );
  if (error) {
    console.error("assistant proposal RPC failed", error.code);
    return {
      ok: false,
      error: {
        code: "PROPOSAL_FAILED",
        message: "The action proposal could not be created",
      },
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row?.proposal_id || !row?.confirmation_token || !row?.argument_hash ||
    !row?.proposal_expires_at
  ) {
    return {
      ok: false,
      error: {
        code: "PROPOSAL_NOT_REISSUED",
        message: "That action was already confirmed or executed",
      },
    };
  }

  const envelope: ActionTokenPayload = {
    version: 1,
    proposalId: row.proposal_id,
    conversationId: context.conversationId,
    orgId: context.principal.orgId,
    userId: context.principal.userId,
    actionType: spec.actionType,
    argumentHash: row.argument_hash,
    confirmationToken: row.confirmation_token,
    expiresAt: row.proposal_expires_at,
  };
  const actionToken = await signActionToken(
    envelope,
    context.config.actionTokenSecret,
  );
  const reference = `proposal:${row.proposal_id}`;
  context.issuedProposals.push({
    id: row.proposal_id,
    reference,
    actionToken,
    actionType: spec.actionType,
    risk: spec.risk,
    title: localizedTitle,
    summary: parsed.summary,
    changes: parsed.changes,
    expiresAt: row.proposal_expires_at,
  });
  return {
    ok: true,
    data: {
      proposal_reference: reference,
      action_type: spec.actionType,
      title: localizedTitle,
      summary: parsed.summary,
      risk: spec.risk,
      changes: parsed.changes,
      expires_at: row.proposal_expires_at,
      requires_step_up: row.proposal_requires_step_up === true,
      instruction:
        "Create a confirmation block using proposal_reference as confirm.actionToken. Do not claim execution.",
    },
    entities: [],
  };
}

export async function executeTool(
  context: ToolExecutionContext,
  name: string,
  raw: unknown,
): Promise<ToolResult> {
  if (!canUseTool(context.principal, name)) {
    return {
      ok: false,
      error: {
        code: "TOOL_NOT_AUTHORIZED",
        message: "This capability is not available to the signed-in role",
      },
    };
  }
  context.onStatus?.(
    actionSpecByTool(name)
      ? "assistant.status.preparing"
      : "assistant.status.searching",
  );
  try {
    let result: ToolResult;
    switch (name) {
      case "search_inventory":
        result = await searchInventory(context, raw);
        break;
      case "get_vehicle_360":
        result = await getVehicle360(context, raw);
        break;
      case "get_dashboard_ageing":
        result = await getDashboardAgeing(context, raw);
        break;
      case "get_alerts_compliance":
        result = await getAlertsCompliance(context, raw);
        break;
      case "get_partner_portfolio":
        result = await getPartnerPortfolio(context, raw);
        break;
      case "search_parties":
        result = await searchParties(context, raw);
        break;
      case "search_partners":
        result = await searchPartners(context, raw);
        break;
      case "get_finance_overview":
        result = await getFinanceOverview(context, raw);
        break;
      case "get_operational_records":
        result = await getOperationalRecords(context, raw);
        break;
      case "get_compliance_policies":
        result = await getCompliancePolicies(context, raw);
        break;
      case "get_administration_overview":
        result = await getAdministrationOverview(context, raw);
        break;
      case "acknowledge_alert":
        result = await acknowledgeAlert(context, raw);
        break;
      default:
        result = actionSpecByTool(name)
          ? await createProposal(context, name, raw)
          : {
            ok: false,
            error: { code: "UNKNOWN_TOOL", message: "Unknown capability" },
          };
    }
    for (const item of result.entities ?? []) {
      context.evidence.set(`${item.type}:${item.id}`, item);
    }
    return result;
  } catch (error) {
    if (error instanceof ToolDatabaseError) {
      return {
        ok: false,
        error: {
          code: "DATA_ACCESS_FAILED",
          message: "Authorized application data could not be read",
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "INVALID_TOOL_ARGUMENTS",
        message: error instanceof Error
          ? error.message.slice(0, 240)
          : "Tool arguments were invalid",
      },
    };
  }
}
