import type { AppLocale } from "@/i18n";

export const ASSISTANT_SCHEMA_VERSION = "1.0" as const;

export type AssistantTone = "neutral" | "info" | "success" | "warning" | "danger";
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
  | {
      kind: "reply";
      label: string;
      message: string;
    }
  | {
      kind: "invoke";
      label: string;
      actionToken: string;
      risk: AssistantRisk;
      confirmationText?: string;
    }
  | {
      kind: "download";
      label: string;
      artifactId: string;
    };

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
  format?: "inr" | "number" | "percent" | "date" | "datetime" | "status" | "text";
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
  schemaVersion: typeof ASSISTANT_SCHEMA_VERSION;
  turnId: string;
  conversationId?: string;
  locale: AppLocale | string;
  answer: {
    text: string;
    tone?: AssistantTone;
  };
  blocks: AssistantBlock[];
  followUps?: AssistantAction[];
  provenance: AssistantProvenance;
}

export interface AssistantRequestContext {
  surface: "desktop" | "mobile" | "partner";
  page?: string;
  vehicleId?: string | null;
  vehicleTab?: string | null;
}

export interface AssistantTurnRequest {
  conversationId?: string;
  message: string;
  locale: string;
  context: AssistantRequestContext;
  stream?: boolean;
  action?: {
    token: string;
  };
}

export interface AssistantTurnResponse {
  conversationId?: string;
  turn: AssistantTurn;
}

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  turn?: AssistantTurn;
  status?: "sending" | "streaming" | "complete" | "failed";
  error?: string;
}

const BLOCK_TYPES = new Set<AssistantBlock["type"]>([
  "metric_grid",
  "vehicle_collection",
  "entity_table",
  "alert_list",
  "cost_breakdown",
  "timeline",
  "comparison",
  "document_gallery",
  "form",
  "confirmation",
  "action_receipt",
  "progress",
  "empty_state",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasBoundedArray(record: Record<string, unknown>, key: string, maximum: number): boolean {
  return Array.isArray(record[key]) && record[key].length <= maximum;
}

function isAssistantAction(value: unknown): value is AssistantAction {
  if (!isRecord(value) || typeof value.kind !== "string" || typeof value.label !== "string" || value.label.length > 160) {
    return false;
  }
  switch (value.kind) {
    case "navigate":
      return typeof value.page === "string" && (value.params === undefined || isRecord(value.params));
    case "reply":
      return typeof value.message === "string" && value.message.length <= 4_000;
    case "invoke":
      return (
        typeof value.actionToken === "string" &&
        value.actionToken.length <= 8_000 &&
        ["low", "medium", "high", "critical"].includes(String(value.risk))
      );
    case "download":
      return typeof value.artifactId === "string" && value.artifactId.length <= 500;
    default:
      return false;
  }
}

function isAssistantBlock(value: unknown): value is AssistantBlock {
  if (!isRecord(value) || typeof value.type !== "string" || !BLOCK_TYPES.has(value.type as AssistantBlock["type"])) {
    return false;
  }
  switch (value.type) {
    case "metric_grid":
      return hasBoundedArray(value, "items", 24);
    case "vehicle_collection":
      return hasBoundedArray(value, "items", 100);
    case "entity_table":
    case "comparison":
      return hasBoundedArray(value, "columns", 20) && hasBoundedArray(value, "rows", 200);
    case "alert_list":
      return hasBoundedArray(value, "items", 100);
    case "cost_breakdown":
      return hasBoundedArray(value, "expenses", 100) && typeof value.total === "number" && Number.isFinite(value.total);
    case "timeline":
      return hasBoundedArray(value, "events", 200);
    case "document_gallery":
      return hasBoundedArray(value, "items", 100);
    case "form":
      return (
        typeof value.formId === "string" &&
        typeof value.intent === "string" &&
        typeof value.title === "string" &&
        hasBoundedArray(value, "fields", 40) &&
        isAssistantAction(value.submit)
      );
    case "confirmation":
      return (
        typeof value.title === "string" &&
        typeof value.summary === "string" &&
        hasBoundedArray(value, "changes", 50) &&
        isAssistantAction(value.confirm)
      );
    case "action_receipt":
      return typeof value.title === "string" && hasBoundedArray(value, "details", 100);
    case "progress":
      return hasBoundedArray(value, "steps", 30);
    case "empty_state":
      return typeof value.title === "string";
    default:
      return false;
  }
}

export function isAssistantTurn(value: unknown): value is AssistantTurn {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== ASSISTANT_SCHEMA_VERSION) return false;
  if (typeof value.turnId !== "string" || typeof value.locale !== "string") return false;
  if (!isRecord(value.answer) || typeof value.answer.text !== "string" || value.answer.text.length > 20_000) return false;
  if (!Array.isArray(value.blocks) || value.blocks.length > 24 || !value.blocks.every(isAssistantBlock)) return false;
  if (
    value.followUps !== undefined &&
    (!Array.isArray(value.followUps) || value.followUps.length > 12 || !value.followUps.every(isAssistantAction))
  ) {
    return false;
  }
  if (
    !isRecord(value.provenance) ||
    typeof value.provenance.asOf !== "string" ||
    !Array.isArray(value.provenance.sources) ||
    value.provenance.sources.length > 100 ||
    !value.provenance.sources.every((source) => isRecord(source) && typeof source.entity === "string")
  ) {
    return false;
  }
  return true;
}

export function parseAssistantTurn(value: unknown): AssistantTurn {
  if (!isAssistantTurn(value)) {
    throw new Error("The assistant returned an unsupported response format.");
  }
  return value;
}

export function createFallbackTurn(text: string, locale: string, tone: AssistantTone = "neutral"): AssistantTurn {
  return {
    schemaVersion: ASSISTANT_SCHEMA_VERSION,
    turnId: crypto.randomUUID(),
    locale,
    answer: { text, tone },
    blocks: [],
    provenance: {
      asOf: new Date().toISOString(),
      sources: [],
    },
  };
}
