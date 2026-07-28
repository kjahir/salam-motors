import type {
  AssistantAction,
  AssistantPrincipal,
  AssistantSurfaceContext,
  AssistantBlock,
  AssistantRisk,
  AssistantScalar,
  AssistantSource,
  AssistantTone,
  AssistantTurn,
  AssistantTurnRequest,
} from "./types.ts";
import { normalizeNavigationAction } from "./navigation.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;

export class RequestValidationError extends Error {
  readonly code = "INVALID_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function optionalShortString(
  value: unknown,
  field: string,
  maximum: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length > maximum) {
    throw new RequestValidationError(
      `${field} must be a string <= ${maximum} characters`,
    );
  }
  return value.trim() || undefined;
}

export function parseAssistantTurnRequest(
  value: unknown,
  acceptHeader = "",
): AssistantTurnRequest {
  if (!isRecord(value)) {
    throw new RequestValidationError("Request body must be a JSON object");
  }
  if (typeof value.message !== "string") {
    throw new RequestValidationError("message is required");
  }
  const message = value.message.trim();
  if (!message || message.length > 4_000) {
    throw new RequestValidationError(
      "message must contain 1 to 4,000 characters",
    );
  }
  const locale = typeof value.locale === "string" ? value.locale.trim() : "";
  if (!LOCALE_PATTERN.test(locale)) {
    throw new RequestValidationError(
      "locale must be a valid language tag such as en or hi-IN",
    );
  }
  if (!isRecord(value.context)) {
    throw new RequestValidationError("context is required");
  }
  if (
    !["desktop", "mobile", "partner"].includes(
      String(value.context.surface),
    )
  ) {
    throw new RequestValidationError(
      "context.surface must be desktop, mobile, or partner",
    );
  }
  const vehicleId = optionalShortString(
    value.context.vehicleId,
    "context.vehicleId",
    64,
  );
  if (vehicleId && !isUuid(vehicleId)) {
    throw new RequestValidationError("context.vehicleId must be a UUID");
  }
  let conversationId: string | undefined;
  if (value.conversationId !== undefined) {
    if (!isUuid(value.conversationId)) {
      throw new RequestValidationError("conversationId must be a UUID");
    }
    conversationId = value.conversationId;
  }
  let action: { token: string } | undefined;
  if (value.action !== undefined) {
    if (
      !isRecord(value.action) || typeof value.action.token !== "string" ||
      value.action.token.length < 32 || value.action.token.length > 8_000
    ) {
      throw new RequestValidationError("action.token is invalid");
    }
    action = { token: value.action.token };
  }
  if (value.stream !== undefined && typeof value.stream !== "boolean") {
    throw new RequestValidationError("stream must be a boolean");
  }
  return {
    conversationId,
    message,
    locale,
    context: {
      surface: value.context.surface as "desktop" | "mobile" | "partner",
      page: optionalShortString(value.context.page, "context.page", 160),
      vehicleId,
      vehicleTab: optionalShortString(
        value.context.vehicleTab,
        "context.vehicleTab",
        80,
      ),
    },
    stream: typeof value.stream === "boolean"
      ? value.stream
      : acceptHeader.includes("text/event-stream"),
    action,
  };
}

function cleanString(value: unknown, fallback = "", maximum = 2_000): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : fallback;
}

function cleanNullableString(
  value: unknown,
  maximum = 500,
): string | null {
  return typeof value === "string"
    ? value.trim().slice(0, maximum) || null
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanTone(value: unknown): AssistantTone {
  return ["neutral", "info", "success", "warning", "danger"].includes(
      String(value),
    )
    ? value as AssistantTone
    : "neutral";
}

function cleanRisk(value: unknown): AssistantRisk {
  return ["low", "medium", "high", "critical"].includes(String(value))
    ? value as AssistantRisk
    : "high";
}

function cleanScalar(value: unknown): AssistantScalar {
  return typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean" || value === null
    ? value
    : String(value ?? "");
}

function normalizeReplyAction(value: unknown): AssistantAction | null {
  if (!isRecord(value) || value.kind !== "reply") return null;
  const label = cleanString(value.label, "", 160);
  const message = cleanString(value.message, "", 4_000);
  return label && message ? { kind: "reply", label, message } : null;
}

function normalizeBlock(
  value: unknown,
  principal: AssistantPrincipal,
  context: AssistantSurfaceContext,
  evidenceVehicleIds: ReadonlySet<string>,
): AssistantBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const title = cleanNullableString(value.title, 200) ?? undefined;
  switch (value.type) {
    case "metric_grid": {
      const items = (Array.isArray(value.items) ? value.items : [])
        .slice(0, 24)
        .flatMap((item) => {
          if (!isRecord(item)) return [];
          const label = cleanString(item.label, "", 160);
          const numeric = finiteNumber(item.value);
          const itemValue = numeric ?? cleanString(item.value, "", 300);
          if (!label || itemValue === "") return [];
          return [{
            label,
            value: itemValue,
            format: ["inr", "number", "percent", "days", "text"].includes(
                String(item.format),
              )
              ? item.format as "inr" | "number" | "percent" | "days" | "text"
              : "text",
            tone: cleanTone(item.tone),
            helpText: cleanNullableString(item.helpText, 300) ?? undefined,
          }];
        });
      return { type: "metric_grid", title, items };
    }
    case "vehicle_collection": {
      const items = (Array.isArray(value.items) ? value.items : [])
        .slice(0, 100)
        .flatMap((item) => {
          if (!isRecord(item)) return [];
          const id = cleanString(item.id, "", 80);
          const stockNumber = cleanString(item.stockNumber, "", 100);
          const manufacturer = cleanString(item.manufacturer, "", 120);
          const model = cleanString(item.model, "", 120);
          const status = cleanString(item.status, "", 80);
          if (!id || !stockNumber || !manufacturer || !model || !status) {
            return [];
          }
          return [{
            id,
            stockNumber,
            registrationNumber: cleanNullableString(
              item.registrationNumber,
              80,
            ),
            manufacturer,
            model,
            variant: cleanNullableString(item.variant, 120),
            status,
            year: finiteNumber(item.year),
            fuelType: cleanNullableString(item.fuelType, 80),
            odometer: finiteNumber(item.odometer),
            daysInStock: finiteNumber(item.daysInStock),
            askingPrice: finiteNumber(item.askingPrice),
            minimumPrice: finiteNumber(item.minimumPrice),
            totalCost: finiteNumber(item.totalCost),
            estimatedProfit: finiteNumber(item.estimatedProfit),
            realisedProfit: finiteNumber(item.realisedProfit),
            alertCount: finiteNumber(item.alertCount) ?? 0,
            complianceCount: finiteNumber(item.complianceCount) ?? 0,
            complianceSeverity: cleanNullableString(
              item.complianceSeverity,
              80,
            ),
            explanation: cleanNullableString(item.explanation, 500) ??
              undefined,
            actions: (Array.isArray(item.actions) ? item.actions : [])
              .slice(0, 6)
              .map((action) => normalizeNavigationAction(
                action, principal, context, evidenceVehicleIds,
              ))
              .filter((action): action is AssistantAction => action !== null),
          }];
        });
      return {
        type: "vehicle_collection",
        title,
        description: cleanNullableString(value.description, 500) ?? undefined,
        view: value.view === "table" ? "table" : "cards",
        items,
        shown: items.length,
        total: finiteNumber(value.total) ?? items.length,
      };
    }
    case "alert_list": {
      const items = (Array.isArray(value.items) ? value.items : [])
        .slice(0, 100)
        .flatMap((item) => {
          if (!isRecord(item)) return [];
          const id = cleanString(item.id, "", 80);
          const itemTitle = cleanString(item.title, "", 200);
          const severity = cleanString(item.severity, "", 80);
          const status = cleanString(item.status, "", 80);
          if (!id || !itemTitle || !severity || !status) return [];
          return [{
            id,
            vehicleId: cleanNullableString(item.vehicleId, 80),
            title: itemTitle,
            message: cleanNullableString(item.message, 800),
            severity,
            status,
            createdAt: cleanNullableString(item.createdAt, 80) ?? undefined,
          }];
        });
      return { type: "alert_list", title, items };
    }
    case "timeline": {
      const events = (Array.isArray(value.events) ? value.events : [])
        .slice(0, 200)
        .flatMap((item) => {
          if (!isRecord(item)) return [];
          const at = cleanString(item.at, "", 80);
          const label = cleanString(item.label, "", 240);
          if (!at || !label) return [];
          return [{
            id: cleanNullableString(item.id, 100) ?? undefined,
            at,
            label,
            status: cleanNullableString(item.status, 80) ?? undefined,
            reason: cleanNullableString(item.reason, 500),
            tone: cleanTone(item.tone),
          }];
        });
      return {
        type: "timeline",
        title,
        entityId: cleanNullableString(value.entityId, 100) ?? undefined,
        events,
      };
    }
    case "confirmation": {
      const confirm = isRecord(value.confirm) &&
          value.confirm.kind === "invoke"
        ? {
          kind: "invoke" as const,
          label: cleanString(value.confirm.label, "Confirm", 160),
          actionToken: cleanString(value.confirm.actionToken, "", 8_000),
          risk: cleanRisk(value.confirm.risk),
          confirmationText: cleanNullableString(
            value.confirm.confirmationText,
            500,
          ) ?? undefined,
        }
        : null;
      if (!confirm) return null;
      const changes = (Array.isArray(value.changes) ? value.changes : [])
        .slice(0, 50)
        .flatMap((item) =>
          isRecord(item) && typeof item.label === "string"
            ? [{
              label: cleanString(item.label, "", 160),
              from: item.from === undefined
                ? undefined
                : cleanScalar(item.from),
              to: cleanScalar(item.to),
            }]
            : []
        );
      return {
        type: "confirmation",
        title: cleanString(value.title, "Confirm action", 200),
        summary: cleanString(value.summary, "", 1_000),
        risk: cleanRisk(value.risk),
        changes,
        confirm,
        cancel: normalizeReplyAction(value.cancel) ?? undefined,
        expiresAt: cleanNullableString(value.expiresAt, 80) ?? undefined,
      };
    }
    case "action_receipt": {
      const status = ["success", "partial", "failed"].includes(
          String(value.status),
        )
        ? value.status as "success" | "partial" | "failed"
        : "failed";
      const details = (Array.isArray(value.details) ? value.details : [])
        .slice(0, 100)
        .flatMap((item) =>
          isRecord(item) && typeof item.label === "string"
            ? [{
              label: cleanString(item.label, "", 160),
              value: cleanScalar(item.value),
            }]
            : []
        );
      return {
        type: "action_receipt",
        status,
        title: cleanString(value.title, "Action result", 200),
        message: cleanNullableString(value.message, 800) ?? undefined,
        details,
        auditId: cleanNullableString(value.auditId, 100) ?? undefined,
      };
    }
    case "empty_state":
      return {
        type: "empty_state",
        title: cleanString(value.title, "No results", 200),
        explanation: cleanNullableString(value.explanation, 800) ?? undefined,
      };
    default:
      return null;
  }
}

function normalizeSources(value: unknown): AssistantSource[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((source) => {
    if (!isRecord(source)) return [];
    const entity = cleanString(source.entity, "", 80);
    if (!entity) return [];
    return [{
      entity,
      id: cleanNullableString(source.id, 120) ?? undefined,
      label: cleanNullableString(source.label, 200) ?? undefined,
      count: finiteNumber(source.count) ?? undefined,
    }];
  });
}

export function normalizeModelTurn(
  value: unknown,
  conversationId: string,
  locale: string,
  principal: AssistantPrincipal,
  context: AssistantSurfaceContext,
  evidenceVehicleIds: ReadonlySet<string> = new Set(),
): AssistantTurn {
  if (!isRecord(value) || !isRecord(value.answer)) {
    throw new Error("Model returned an invalid structured turn");
  }
  const text = cleanString(value.answer.text, "", 20_000);
  if (!text) throw new Error("Model returned an empty answer");
  const blocks = (Array.isArray(value.blocks) ? value.blocks : [])
    .slice(0, 24)
    .map((block) =>
      normalizeBlock(block, principal, context, evidenceVehicleIds))
    .filter((block): block is AssistantBlock => block !== null);
  const followUps = (Array.isArray(value.followUps) ? value.followUps : [])
    .slice(0, 12)
    .map((action) => normalizeReplyAction(action) ??
      normalizeNavigationAction(action, principal, context, evidenceVehicleIds))
    .filter((action): action is AssistantAction => action !== null);
  const provenance = isRecord(value.provenance) ? value.provenance : {};
  return {
    schemaVersion: "1.0",
    turnId: crypto.randomUUID(),
    conversationId,
    locale,
    answer: { text, tone: cleanTone(value.answer.tone) },
    blocks,
    followUps,
    provenance: {
      asOf: new Date().toISOString(),
      sources: normalizeSources(provenance.sources),
      truncated: provenance.truncated === true || undefined,
    },
  };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${stableJson(value[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected an object");
  return value;
}

export function requiredString(
  object: Record<string, unknown>,
  key: string,
  maximum = 500,
): string {
  const value = object[key];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

export function nullableString(
  object: Record<string, unknown>,
  key: string,
  maximum = 1_000,
): string | null {
  const value = object[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length > maximum) {
    throw new Error(`${key} must be a string or null`);
  }
  return value.trim() || null;
}

export function requiredNumber(
  object: Record<string, unknown>,
  key: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = object[key];
  if (
    typeof value !== "number" || !Number.isFinite(value) || value < minimum ||
    value > maximum
  ) {
    throw new Error(`${key} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

