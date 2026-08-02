import { useMemo, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { formatMetric, formatScalar, severityTone } from "./format";
import {
  type AssistantAction,
  type AssistantBlock,
  type AssistantField,
  type AssistantProvenance,
  type AssistantRisk,
  type AssistantScalar,
  type AssistantTurn,
  type VehicleResult,
} from "./schema";
import { useAssistant } from "./AssistantProvider";

const toneStyles = {
  neutral: "border-slate-200 bg-white text-slate-900",
  info: "border-blue-200 bg-blue-50 text-blue-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-950",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-900">{children}</h3>;
}

function SafeText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className={`space-y-1.5 whitespace-pre-wrap break-words ${className}`}>
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2">
              <span aria-hidden="true" className="mt-1 text-brand-500">
                •
              </span>
              <span>{bullet[1]}</span>
            </div>
          );
        }
        return line ? <p key={index}>{line}</p> : <div key={index} className="h-1" />;
      })}
    </div>
  );
}

function riskButtonClass(risk?: AssistantRisk): string {
  if (risk === "critical") return "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";
  if (risk === "high") return "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500";
  return "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500";
}
const riskOrder: Record<AssistantRisk, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function stricterRisk(left: AssistantRisk, right: AssistantRisk): AssistantRisk {
  return riskOrder[left] >= riskOrder[right] ? left : right;
}


function ActionButton({
  action,
  compact = false,
  disabled = false,
  override,
  allowInvoke = false,
}: {
  action: AssistantAction;
  compact?: boolean;
  disabled?: boolean;
  override?: AssistantAction;
  allowInvoke?: boolean;
}) {
  const { handleAction, isBusy } = useAssistant();
  const { t } = useTranslation();
  const unavailableReason =
    action.kind === "download"
      ? t("assistant.display.downloadUnavailable")
      : action.kind === "invoke" && !allowInvoke ? t("assistant.safety.needsConfirmation") : undefined;
  const isUnavailable = Boolean(unavailableReason);
  const risk = action.kind === "invoke" ? action.risk : undefined;
  const icon =
    action.kind === "navigate" ? (
      <ExternalLink size={compact ? 13 : 15} />
    ) : action.kind === "download" ? (
      <Download size={compact ? 13 : 15} />
    ) : (
      <ArrowRight size={compact ? 13 : 15} />
    );

  return (
    <button
      type="button"
      disabled={disabled || isBusy || isUnavailable}
      title={unavailableReason}
      onClick={() => void handleAction(override ?? action)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${
        action.kind === "invoke"
          ? riskButtonClass(risk)
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-brand-500"
      }`}
    >
      <span>{action.label}</span>
      {isUnavailable && (
        <span className="text-[10px] font-normal">({t("assistant.display.unavailable")})</span>
      )}
      {icon}
    </button>
  );
}

function ActionRow({ actions, compact = false }: { actions?: AssistantAction[]; compact?: boolean }) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <ActionButton key={`${action.kind}-${action.label}-${index}`} action={action} compact={compact} />
      ))}
    </div>
  );
}

function MetricGrid({ block }: { block: Extract<AssistantBlock, { type: "metric_grid" }> }) {
  return (
    <div className="space-y-2.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {block.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={`rounded-xl border p-3 ${toneStyles[item.tone ?? "neutral"]}`}
            title={item.helpText}
          >
            <p className="text-[11px] font-medium opacity-70">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{formatMetric(item)}</p>
            {item.helpText && <p className="mt-1 text-[10px] leading-snug opacity-70">{item.helpText}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehicleResult }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {vehicle.manufacturer} {vehicle.model}
            {vehicle.variant ? ` ${vehicle.variant}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {vehicle.stockNumber}
            {vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {vehicle.askingPrice !== undefined && vehicle.askingPrice !== null && (
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{t("assistant.display.asking")}</span>
            <span className="font-semibold text-slate-800">{formatINR(vehicle.askingPrice)}</span>
          </div>
        )}
        {vehicle.totalCost !== undefined && vehicle.totalCost !== null && (
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{t("assistant.display.totalCost")}</span>
            <span className="font-semibold text-slate-800">{formatINR(vehicle.totalCost)}</span>
          </div>
        )}
        {vehicle.daysInStock !== undefined && vehicle.daysInStock !== null && (
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{t("assistant.display.age")}</span>
            <span className="font-semibold text-slate-800">{t("assistant.display.days", { count: vehicle.daysInStock })}</span>
          </div>
        )}
        {vehicle.estimatedProfit !== undefined && vehicle.estimatedProfit !== null && (
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{t("assistant.display.estimatedProfit")}</span>
            <span className={vehicle.estimatedProfit >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
              {formatINR(vehicle.estimatedProfit)}
            </span>
          </div>
        )}
      </div>

      {/* Boolean(), not a bare `a || b`: the server normalizes both counts to a number
          (finiteNumber(...) ?? 0), so the truthiness guard evaluated to 0 and React printed
          a literal "0" under every vehicle card that had no alerts. */}
      {Boolean(vehicle.alertCount || vehicle.complianceCount) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Boolean(vehicle.alertCount) && <Badge color="amber">{t("assistant.display.alerts", { count: vehicle.alertCount })}</Badge>}
          {Boolean(vehicle.complianceCount) && (
            <Badge color={severityTone(vehicle.complianceSeverity ?? "")}>
              {t("assistant.display.compliance", { count: vehicle.complianceCount })}
            </Badge>
          )}
        </div>
      )}

      {vehicle.explanation && (
        <SafeText text={vehicle.explanation} className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600" />
      )}
      {vehicle.actions?.length ? <div className="mt-3"><ActionRow actions={vehicle.actions} compact /></div> : null}
    </div>
  );
}

function VehicleCollection({ block }: { block: Extract<AssistantBlock, { type: "vehicle_collection" }> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          {block.title && <SectionTitle>{block.title}</SectionTitle>}
          {block.description && <p className="mt-0.5 text-xs text-slate-500">{block.description}</p>}
        </div>
        {typeof block.total === "number" && (
          <span className="shrink-0 text-[11px] text-slate-400">
            {t("assistant.display.showingOf", { shown: block.shown ?? block.items.length, total: block.total })}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {block.items.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
      <ActionRow actions={block.actions} compact />
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
  totals,
  actions,
}: {
  title?: string;
  columns: Extract<AssistantBlock, { type: "entity_table" }>["columns"];
  rows: Array<Record<string, AssistantScalar>>;
  totals?: Record<string, AssistantScalar>;
  actions?: AssistantAction[];
}) {
  return (
    <div className="space-y-2.5">
      {title && <SectionTitle>{title}</SectionTitle>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-3 py-2.5 font-semibold ${
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-slate-700">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-2.5 ${
                      column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {formatScalar(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-3 py-2.5">
                    {formatScalar(totals[column.key], column.format)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <ActionRow actions={actions} compact />
    </div>
  );
}

function AlertList({ block }: { block: Extract<AssistantBlock, { type: "alert_list" }> }) {
  return (
    <div className="space-y-2.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className="space-y-2">
        {block.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <Badge color={severityTone(item.severity)}>{item.severity}</Badge>
                </div>
                {item.message && <SafeText text={item.message} className="mt-1 text-xs leading-relaxed text-slate-600" />}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{item.status}</span>
                  {item.createdAt && <span>· {formatDate(item.createdAt, { withTime: true })}</span>}
                </div>
                {item.actions?.length ? <div className="mt-2.5"><ActionRow actions={item.actions} compact /></div> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostBreakdown({ block }: { block: Extract<AssistantBlock, { type: "cost_breakdown" }> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {block.purchase !== undefined && (
            <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
              <span className="text-slate-500">{t("assistant.display.purchase")}</span>
              <span className="font-medium text-slate-800">{formatINR(block.purchase)}</span>
            </div>
          )}
          {block.expenses.map((expense, index) => (
            <div key={`${expense.label}-${index}`} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
              <span className="text-slate-500">{expense.label}</span>
              <span className="font-medium text-slate-800">{formatINR(expense.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-50 px-3.5 py-3 text-sm">
            <span className="font-semibold text-slate-700">{t("assistant.display.totalCost")}</span>
            <span className="font-semibold text-slate-950">{formatINR(block.total)}</span>
          </div>
          {block.profit !== undefined && block.profit !== null && (
            <div className="flex items-center justify-between px-3.5 py-3 text-sm">
              <span className="font-semibold text-slate-700">{t("assistant.display.profit")}</span>
              <span className={block.profit >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                {formatINR(block.profit)}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Timeline({ block }: { block: Extract<AssistantBlock, { type: "timeline" }> }) {
  return (
    <div className="space-y-2.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <ol className="space-y-0">
        {block.events.map((event, index) => (
          <li key={event.id ?? `${event.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            {index < block.events.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
            <span className="relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{event.label}</p>
                <time className="text-[10px] text-slate-400">{formatDate(event.at, { withTime: true })}</time>
              </div>
              {event.status && <p className="mt-0.5 text-[11px] text-slate-500">{event.status}</p>}
              {event.reason && <SafeText text={event.reason} className="mt-1 text-xs text-slate-600" />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DocumentGallery({ block }: { block: Extract<AssistantBlock, { type: "document_gallery" }> }) {
  return (
    <div className="space-y-2.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {block.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2.5">
              <FileText size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{item.status}</p>
                {item.actions?.length ? <div className="mt-2"><ActionRow actions={item.actions} compact /></div> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fieldInput(
  field: AssistantField,
  value: AssistantField["value"],
  onChange: (value: AssistantField["value"]) => void,
  t: TFunction,
) {
  const common =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100";
  if (field.type === "textarea") {
    return (
      <textarea
        rows={3}
        className={common}
        value={typeof value === "string" ? value : ""}
        disabled={field.disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        checked={Boolean(value)}
        disabled={field.disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        className={common}
        value={typeof value === "string" ? value : ""}
        disabled={field.disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("assistant.display.select")}</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "file_upload" || field.type === "party_picker") {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        {field.type === "file_upload"
          ? t("assistant.display.fileUploadUnavailable")
          : t("assistant.display.partyPickerUnavailable")}
      </div>
    );
  }
  return (
    <input
      className={common}
      type={field.type === "number" || field.type === "currency" ? "number" : field.type === "date" ? "date" : "text"}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      disabled={field.disabled}
      required={field.required}
      min={field.validation?.min}
      max={field.validation?.max}
      placeholder={field.placeholder}
      onChange={(event) =>
        onChange(
          field.type === "number" || field.type === "currency"
            ? event.target.value === ""
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

function FormBlock({ block }: { block: Extract<AssistantBlock, { type: "form" }> }) {
  const initial = useMemo(
    () => Object.fromEntries(block.fields.map((field) => [field.key, field.value ?? null])),
    [block.fields],
  );
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, AssistantField["value"]>>(initial);
  const missing = block.fields.filter((field) => field.required && (values[field.key] === null || values[field.key] === ""));
  const unsupportedField = block.fields.find((field) => field.type === "file_upload" || field.type === "party_picker");
  const unavailableReason = unsupportedField
    ? t(unsupportedField.type === "file_upload"
      ? "assistant.display.fileUploadUnavailable"
       : "assistant.display.partyPickerUnavailable")
    : block.submit.kind !== "reply" ? t("assistant.display.formSubmitUnavailable") : undefined;
  const submitSupported = block.submit.kind === "reply" && !unsupportedField;
  const replyOverride: AssistantAction | undefined =
    block.submit.kind === "reply"
      ? {
          ...block.submit,
          message: `${block.submit.message}\n\nForm values:\n${JSON.stringify(values)}`,
        }
      : undefined;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <SectionTitle>{block.title}</SectionTitle>
        {block.description && <p className="mt-1 text-xs text-slate-500">{block.description}</p>}
      </div>
      <div className="space-y-3">
        {block.fields.map((field) => (
          <label key={field.key} className={field.type === "checkbox" ? "flex items-center gap-2.5" : "block"}>
            {field.type === "checkbox" &&
              fieldInput(field, values[field.key], (value) => setValues((current) => ({ ...current, [field.key]: value })), t)}
            <span className="text-xs font-medium text-slate-700">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.type !== "checkbox" && (
              <div className="mt-1.5">
                {fieldInput(field, values[field.key], (value) =>
                  setValues((current) => ({ ...current, [field.key]: value })),
                  t,
                )}
              </div>
            )}
            {field.helpText && <span className="mt-1 block text-[10px] text-slate-400">{field.helpText}</span>}
          </label>
        ))}
      </div>
      <ActionButton
        action={block.submit}
        override={replyOverride}
        disabled={missing.length > 0 || !submitSupported}
      />
      {missing.length > 0 && <p className="text-[10px] text-amber-700">{t("assistant.display.completeRequired")}</p>}
      {unavailableReason && (
        <p role="status" className="text-[10px] text-amber-700">
          {unavailableReason}
        </p>
      )}
    </div>
  );
}

function ConfirmationBlock({ block }: { block: Extract<AssistantBlock, { type: "confirmation" }> }) {
  const { t } = useTranslation();
  const invokeRisk = block.confirm.kind === "invoke" ? block.confirm.risk : "critical";
  const effectiveRisk = stricterRisk(block.risk, invokeRisk);
  const [acknowledged, setAcknowledged] = useState(effectiveRisk === "low" || effectiveRisk === "medium");
  const needsStrongConfirmation = effectiveRisk === "high" || effectiveRisk === "critical";
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-orange-600" size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>{block.title}</SectionTitle>
            <Badge color={effectiveRisk === "critical" ? "red" : "orange"}>{effectiveRisk}</Badge>
          </div>
          <SafeText text={block.summary} className="mt-1.5 text-xs leading-relaxed text-slate-700" />
          <dl className="mt-3 space-y-2 rounded-lg border border-orange-100 bg-white/80 p-3">
            {block.changes.map((change, index) => (
              <div key={`${change.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
                <dt className="text-slate-500">{change.label}</dt>
                <dd className="text-right font-medium text-slate-900">
                  {change.from !== undefined && <span className="mr-1 text-slate-400 line-through">{formatScalar(change.from)}</span>}
                  {formatScalar(change.to)}
                </dd>
              </div>
            ))}
          </dl>
          {needsStrongConfirmation && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>{t("assistant.display.reviewedConsequences")}</span>
            </label>
          )}
          {block.expiresAt && (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
              <Clock3 size={11} />
              {t("assistant.display.confirmationExpires", { time: formatDate(block.expiresAt, { withTime: true }) })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action={block.confirm} allowInvoke disabled={!acknowledged} />
            {block.cancel && <ActionButton action={block.cancel} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionReceipt({ block }: { block: Extract<AssistantBlock, { type: "action_receipt" }> }) {
  const { t } = useTranslation();
  const icon =
    block.status === "success" ? (
      <CheckCircle2 className="text-emerald-600" size={21} />
    ) : block.status === "partial" ? (
      <AlertTriangle className="text-amber-600" size={21} />
    ) : (
      <XCircle className="text-red-600" size={21} />
    );
  return (
    <div className={`rounded-xl border p-4 ${block.status === "success" ? "border-emerald-200 bg-emerald-50" : block.status === "partial" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <SectionTitle>{block.title}</SectionTitle>
          {block.message && <SafeText text={block.message} className="mt-1 text-xs text-slate-600" />}
          <dl className="mt-3 space-y-1.5 text-xs">
            {block.details.map((detail, index) => (
              <div key={`${detail.label}-${index}`} className="flex justify-between gap-3">
                <dt className="text-slate-500">{detail.label}</dt>
                <dd className="text-right font-medium text-slate-800">{formatScalar(detail.value)}</dd>
              </div>
            ))}
          </dl>
          {block.auditId && <p className="mt-2 font-mono text-[10px] text-slate-400">{t("assistant.display.audit", { id: block.auditId })}</p>}
          {block.actions?.length ? <div className="mt-3"><ActionRow actions={block.actions} compact /></div> : null}
        </div>
      </div>
    </div>
  );
}

function ProgressBlock({ block }: { block: Extract<AssistantBlock, { type: "progress" }> }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <ol className="space-y-2">
        {block.steps.map((step, index) => {
          const icon =
            step.status === "done" ? (
              <Check size={14} className="text-emerald-600" />
            ) : step.status === "running" ? (
              <Loader2 size={14} className="animate-spin text-brand-600" />
            ) : step.status === "failed" ? (
              <XCircle size={14} className="text-red-600" />
            ) : (
              <Circle size={14} className="text-slate-300" />
            );
          return (
            <li key={`${step.label}-${index}`} className="flex items-center gap-2 text-xs text-slate-700">
              {icon}
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EmptyState({ block }: { block: Extract<AssistantBlock, { type: "empty_state" }> }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-slate-800">{block.title}</p>
      {block.explanation && <SafeText text={block.explanation} className="mx-auto mt-1 max-w-sm text-xs text-slate-500" />}
      {block.actions?.length ? <div className="mt-3 flex justify-center"><ActionRow actions={block.actions} compact /></div> : null}
    </div>
  );
}

export function AssistantBlockRenderer({ block }: { block: AssistantBlock }) {
  switch (block.type) {
    case "metric_grid":
      return <MetricGrid block={block} />;
    case "vehicle_collection":
      return <VehicleCollection block={block} />;
    case "entity_table":
      return <DataTable title={block.title} columns={block.columns} rows={block.rows} totals={block.totals} actions={block.actions} />;
    case "comparison":
      return <DataTable title={block.title} columns={block.columns} rows={block.rows} actions={block.actions} />;
    case "alert_list":
      return <AlertList block={block} />;
    case "cost_breakdown":
      return <CostBreakdown block={block} />;
    case "timeline":
      return <Timeline block={block} />;
    case "document_gallery":
      return <DocumentGallery block={block} />;
    case "form":
      return <FormBlock block={block} />;
    case "confirmation":
      return <ConfirmationBlock block={block} />;
    case "action_receipt":
      return <ActionReceipt block={block} />;
    case "progress":
      return <ProgressBlock block={block} />;
    case "empty_state":
      return <EmptyState block={block} />;
  }
}

function Provenance({ provenance }: { provenance: AssistantProvenance }) {
  const { t } = useTranslation();
  const sourceCount = provenance.sources.reduce((sum, source) => sum + (source.count ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
      <Clock3 size={11} />
      <span>{t("assistant.display.updated", { time: formatDate(provenance.asOf, { withTime: true }) })}</span>
      {provenance.sources.length > 0 && (
        <>
          <span>·</span>
          <span>
            {t("assistant.display.sources", { count: provenance.sources.length })}
            {sourceCount > 0 ? ` · ${t("assistant.display.records", { count: formatNumber(sourceCount) })}` : ""}
          </span>
        </>
      )}
      {provenance.truncated && <Badge color="amber">{t("assistant.display.partialResult")}</Badge>}
    </div>
  );
}

export function AssistantTurnView({ turn }: { turn: AssistantTurn }) {
  return (
    <div className="space-y-3">
      <div className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${toneStyles[turn.answer.tone ?? "neutral"]}`}>
        <SafeText text={turn.answer.text} />
      </div>
      {turn.blocks.map((block, index) => (
        <AssistantBlockRenderer key={block.id ?? `${block.type}-${index}`} block={block} />
      ))}
      {turn.followUps?.length ? (
        <div className="flex flex-wrap gap-2">
          {turn.followUps.map((action, index) => (
            <ActionButton key={`${action.kind}-${action.label}-${index}`} action={action} compact />
          ))}
        </div>
      ) : null}
      <Provenance provenance={turn.provenance} />
    </div>
  );
}

export function FailedMessageActions() {
  const { retryLast } = useAssistant();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => void retryLast()}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
    >
      <RotateCcw size={13} />
      {t("assistant.buttons.retry")}
    </button>
  );
}
