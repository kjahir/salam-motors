/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase's fluent client is injected at runtime; business access stays behind this structural boundary. */
export const STAFF_ROLES = [
  "owner",
  "manager",
  "sales_executive",
  "accountant",
  "mechanic_inspector",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AssistantRole = StaffRole | "partner";
export type PrincipalKind = "staff" | "partner";

export interface AssistantPrincipal {
  kind: PrincipalKind;
  userId: string;
  orgId: string;
  role: AssistantRole;
  partnerId: string | null;
}

export interface AssistantSurfaceContext {
  surface: "desktop" | "mobile" | "partner";
  page?: string;
  vehicleId?: string;
  vehicleTab?: string;
}

export interface AssistantTurnRequest {
  conversationId?: string;
  message: string;
  locale: string;
  context: AssistantSurfaceContext;
  stream: boolean;
  action?: { token: string };
}

export type AssistantTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";
export type AssistantRisk = "low" | "medium" | "high" | "critical";
export type AssistantScalar = string | number | boolean | null;

export interface AssistantSource {
  entity: string;
  id?: string;
  label?: string;
  count?: number;
}

export interface AssistantProvenance {
  asOf: string;
  sources: AssistantSource[];
  filters?: Record<string, AssistantScalar>;
  truncated?: boolean;
}

export type AssistantAction =
  | {
    kind: "navigate";
    label: string;
    page: string;
    params?: {
      vehicleId?: string;
      historyVehicleId?: string;
      tab?: string;
      openEditVehicle?: boolean;
      highlightPolicyId?: string;
    };
  }
  | { kind: "reply"; label: string; message: string }
  | {
    kind: "invoke";
    label: string;
    actionToken: string;
    risk: AssistantRisk;
    confirmationText?: string;
  }
  | { kind: "download"; label: string; artifactId: string };

export interface MetricItem {
  label: string;
  value: string | number;
  format?: "inr" | "number" | "percent" | "days" | "text";
  tone?: AssistantTone;
  helpText?: string;
}

export interface VehicleResult {
  id: string;
  stockNumber: string;
  registrationNumber?: string | null;
  manufacturer: string;
  model: string;
  variant?: string | null;
  status: string;
  year?: number | null;
  fuelType?: string | null;
  odometer?: number | null;
  daysInStock?: number | null;
  askingPrice?: number | null;
  minimumPrice?: number | null;
  totalCost?: number | null;
  estimatedProfit?: number | null;
  realisedProfit?: number | null;
  alertCount?: number;
  complianceCount?: number;
  complianceSeverity?: string | null;
  explanation?: string;
  actions?: AssistantAction[];
}

export interface EntityColumn {
  key: string;
  label: string;
  format?:
    | "inr"
    | "number"
    | "percent"
    | "date"
    | "datetime"
    | "status"
    | "text";
  align?: "left" | "right" | "center";
}

export interface TimelineEvent {
  id?: string;
  at: string;
  label: string;
  status?: string;
  reason?: string | null;
  tone?: AssistantTone;
}

export interface AssistantField {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "currency"
    | "date"
    | "select"
    | "party_picker"
    | "checkbox"
    | "file_upload";
  value?: AssistantScalar | AssistantScalar[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export type AssistantBlock =
  | {
    type: "metric_grid";
    id?: string;
    title?: string;
    items: MetricItem[];
  }
  | {
    type: "vehicle_collection";
    id?: string;
    title?: string;
    description?: string;
    view?: "cards" | "table";
    items: VehicleResult[];
    shown?: number;
    total?: number;
    actions?: AssistantAction[];
  }
  | {
    type: "entity_table";
    id?: string;
    title?: string;
    entity: string;
    columns: EntityColumn[];
    rows: Array<Record<string, AssistantScalar>>;
    totals?: Record<string, AssistantScalar>;
    actions?: AssistantAction[];
  }
  | {
    type: "alert_list";
    id?: string;
    title?: string;
    items: Array<{
      id: string;
      vehicleId?: string | null;
      title: string;
      message?: string | null;
      severity: string;
      status: string;
      createdAt?: string;
      actions?: AssistantAction[];
    }>;
  }
  | {
    type: "cost_breakdown";
    id?: string;
    title?: string;
    vehicleId?: string;
    purchase?: number;
    expenses: Array<{ label: string; amount: number }>;
    total: number;
    askingPrice?: number | null;
    sale?: number | null;
    profit?: number | null;
  }
  | {
    type: "timeline";
    id?: string;
    title?: string;
    entityId?: string;
    events: TimelineEvent[];
  }
  | {
    type: "comparison";
    id?: string;
    title?: string;
    columns: EntityColumn[];
    rows: Array<Record<string, AssistantScalar>>;
    actions?: AssistantAction[];
  }
  | {
    type: "document_gallery";
    id?: string;
    title?: string;
    items: Array<{
      id: string;
      name: string;
      status: string;
      previewKind: "image" | "pdf" | "file";
      artifactId?: string;
      actions?: AssistantAction[];
    }>;
  }
  | {
    type: "form";
    id?: string;
    formId: string;
    intent: string;
    title: string;
    description?: string;
    fields: AssistantField[];
    submit: AssistantAction;
  }
  | {
    type: "confirmation";
    id?: string;
    title: string;
    summary: string;
    risk: AssistantRisk;
    changes: Array<{
      label: string;
      from?: AssistantScalar;
      to: AssistantScalar;
    }>;
    confirm: AssistantAction;
    cancel?: AssistantAction;
    expiresAt?: string;
  }
  | {
    type: "action_receipt";
    id?: string;
    status: "success" | "partial" | "failed";
    title: string;
    message?: string;
    details: Array<{ label: string; value: AssistantScalar }>;
    auditId?: string;
    actions?: AssistantAction[];
  }
  | {
    type: "progress";
    id?: string;
    title?: string;
    steps: Array<{
      label: string;
      status: "pending" | "running" | "done" | "failed";
    }>;
  }
  | {
    type: "empty_state";
    id?: string;
    title: string;
    explanation?: string;
    actions?: AssistantAction[];
  };

export interface AssistantTurn {
  schemaVersion: "1.0";
  turnId: string;
  conversationId?: string;
  locale: string;
  answer: { text: string; tone?: AssistantTone };
  blocks: AssistantBlock[];
  followUps?: AssistantAction[];
  provenance: AssistantProvenance;
}

export type ActionType =
  | "vehicle.create_with_purchase"
  | "vehicle.complete_sale";

export interface ActionDisplayChange {
  label: string;
  from?: AssistantScalar;
  to: AssistantScalar;
}

export interface IssuedProposal {
  id: string;
  reference: string;
  actionToken: string;
  actionType: ActionType;
  risk: AssistantRisk;
  title: string;
  summary: string;
  changes: ActionDisplayChange[];
  expiresAt: string;
}

export interface ToolEntity {
  type: string;
  id: string;
  label: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  entities?: ToolEntity[];
  truncated?: boolean;
}

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  result: ToolResult;
  latencyMs: number;
}

export interface ConversationHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ActionTokenPayload {
  version: 1;
  proposalId: string;
  conversationId: string;
  orgId: string;
  userId: string;
  actionType: ActionType;
  argumentHash: string;
  confirmationToken: string;
  expiresAt: string;
}

export interface StoredActionProposal {
  id: string;
  orgId: string;
  conversationId: string;
  requestedByUserId: string;
  actionType: ActionType;
  targetType: string | null;
  targetId: string | null;
  arguments: Record<string, unknown>;
  argumentHash: string;
  idempotencyKey: string;
  riskLevel: AssistantRisk;
  status: string;
  expiresAt: string;
  outcome: unknown;
}

export interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export type SupabaseClientLike = any;

