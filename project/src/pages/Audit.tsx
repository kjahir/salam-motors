import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText, AlertTriangle, ChevronDown, ChevronRight, ChevronLeft, X, Bot, Activity, FileJson2 } from "lucide-react";
import { PageHeader, Tabs, Spinner, Select } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { elapsedMilliseconds, formatDate, formatDurationSeconds } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import {
  fetchAuditLogs,
  fetchAssistantTurns,
  fetchAssistantToolCallsForRun,
  fetchAssistantTraceForRun,
  type AuditLogFilters,
} from "@/lib/queries";
import type {
  AuditLog,
  AssistantAuditTurn,
  AssistantAuditToolCall,
  AssistantTraceEvent,
  ToolEntitySummary,
} from "@/lib/types";

const ENTITY_TYPE_OPTIONS = [
  "vehicle",
  "vehicles",
  "purchase",
  "purchases",
  "purchase_payments",
  "sale",
  "sales",
  "expense",
  "expenses",
  "listing",
  "listings",
  "party",
  "parties",
  "partner",
  "partners",
  "compliance_policies",
  "vehicle_documents",
  "vehicle_media",
  "profit_distributions",
];

const ACTION_OPTIONS = ["created", "updated", "deleted", "sold"];

const ACTION_COLOR: Record<string, "emerald" | "blue" | "red" | "amber" | "slate"> = {
  created: "emerald",
  updated: "blue",
  deleted: "red",
  sold: "amber",
};

const SOURCE_COLOR: Record<string, "slate" | "purple" | "brand" | "orange"> = {
  app: "slate",
  trigger: "purple",
  assistant: "brand",
  system: "orange",
};

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface AuditRowGroup {
  txid: number | null;
  rows: AuditLog[];
}

function groupByTxid(rows: AuditLog[]): AuditRowGroup[] {
  const groups: AuditRowGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (row.db_txid !== null && last && last.txid === row.db_txid) {
      last.rows.push(row);
    } else {
      groups.push({ txid: row.db_txid, rows: [row] });
    }
  }
  return groups;
}

export function Audit() {
  const { t } = useTranslation();
  const { orgId } = useAuth();
  const [tab, setTab] = useState("business");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title={t("auditPage.title")} description={t("auditPage.description")} icon={<ScrollText size={20} />} />

      <Tabs
        tabs={[
          { key: "business", label: t("auditPage.tabs.business") },
          { key: "assistant", label: t("auditPage.tabs.assistant") },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === "business" && <BusinessActivityTab />}
        {tab === "assistant" && <AssistantActivityTab orgId={orgId} />}
      </div>
    </div>
  );
}

function BusinessActivityTab() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 25;

  const filters: AuditLogFilters = useMemo(
    () => ({
      entityType: entityType || undefined,
      action: action || undefined,
      actor: actor || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
    }),
    [entityType, action, actor, dateFrom, dateTo],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAuditLogs(filters, page, pageSize);
      setLogs(result.rows);
      setCount(result.count);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auditPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [filters, page, t]);

  useEffect(() => {
    setPage(0);
  }, [filters]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setEntityType("");
    setAction("");
    setActor("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = Boolean(entityType || action || actor || dateFrom || dateTo);
  const groups = useMemo(() => groupByTxid(logs), [logs]);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Select
            value={entityType}
            onChange={setEntityType}
            placeholder={t("auditPage.filters.allEntities")}
            options={ENTITY_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
          />
          <Select
            value={action}
            onChange={setAction}
            placeholder={t("auditPage.filters.allActions")}
            options={ACTION_OPTIONS.map((v) => ({ value: v, label: t(`auditPage.actions.${v}`, { defaultValue: v }) }))}
          />
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder={t("auditPage.filters.actor")}
            className="input"
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" aria-label={t("auditPage.filters.dateFrom")} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" aria-label={t("auditPage.filters.dateTo")} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost btn-sm mt-3">
            <X size={14} /> {t("auditPage.filters.clear")}
          </button>
        )}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <Card className="p-6">
          <EmptyState icon={<AlertTriangle size={24} />} title={t("auditPage.failedToLoad")} description={error} />
        </Card>
      ) : logs.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<ScrollText size={20} />} title={t("auditPage.empty.business")} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {groups.map((group, groupIndex) => (
              <div key={group.rows[0].id} className={group.rows.length > 1 ? "bg-slate-50/60" : undefined}>
                {group.rows.length > 1 && (
                  <div className="px-4 pt-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                    {t("auditPage.batch", { count: group.rows.length })}
                  </div>
                )}
                {group.rows.map((row) => {
                  const isExpanded = expanded.has(row.id);
                  const hasDiff = Boolean(row.changed_fields?.length);
                  return (
                    <div key={row.id} className="px-4 py-3">
                      <div
                        className={`flex items-center gap-3 flex-wrap ${hasDiff ? "cursor-pointer" : ""}`}
                        onClick={() => hasDiff && toggleExpanded(row.id)}
                      >
                        {hasDiff ? (
                          isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <Badge color={ACTION_COLOR[row.action] ?? "slate"}>{t(`auditPage.actions.${row.action}`, { defaultValue: row.action })}</Badge>
                        <span className="text-sm font-medium text-slate-900">{row.entity_type}</span>
                        {row.entity_id && <span className="text-xs text-slate-400 font-mono">{row.entity_id.slice(0, 8)}</span>}
                        <Badge color={SOURCE_COLOR[row.source] ?? "slate"}>{t(`auditPage.sources.${row.source}`, { defaultValue: row.source })}</Badge>
                        <span className="text-xs text-slate-500 ml-auto">{row.performed_by ?? "—"}</span>
                        <span className="text-xs text-slate-400">{formatDate(row.performed_at, { withTime: true })}</span>
                      </div>
                      {row.reason && <p className="text-xs text-slate-500 mt-1 ml-6">{row.reason}</p>}
                      {isExpanded && hasDiff && (
                        <div className="mt-2 ml-6 rounded-lg border border-slate-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-left text-slate-500">
                                <th className="px-3 py-1.5 font-medium">{t("auditPage.columns.field")}</th>
                                <th className="px-3 py-1.5 font-medium">{t("auditPage.columns.before")}</th>
                                <th className="px-3 py-1.5 font-medium">{t("auditPage.columns.after")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {row.changed_fields?.map((field) => (
                                <tr key={field}>
                                  <td className="px-3 py-1.5 font-medium text-slate-700">{field}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{formatDiffValue(row.old_value?.[field])}</td>
                                  <td className="px-3 py-1.5 text-slate-900">{formatDiffValue(row.new_value?.[field])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupIndex < groups.length - 1 && group.rows.length > 1 && <div />}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && !error && logs.length > 0 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

function AssistantActivityTab({ orgId }: { orgId: string | null }) {
  const { t } = useTranslation();
  const [turns, setTurns] = useState<AssistantAuditTurn[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [toolCallsByRun, setToolCallsByRun] = useState<Record<string, AssistantAuditToolCall[]>>({});
  const [traceByRun, setTraceByRun] = useState<Record<string, AssistantTraceEvent[]>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const pageSize = 20;

  const reload = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const rows = await fetchAssistantTurns(orgId, page, pageSize);
      setTurns(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auditPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [orgId, page, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleExpanded = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!toolCallsByRun[runId] || !traceByRun[runId]) {
      setLoadingRunId(runId);
      try {
        const [calls, trace] = await Promise.all([
          fetchAssistantToolCallsForRun(runId),
          fetchAssistantTraceForRun(runId),
        ]);
        setToolCallsByRun((prev) => ({ ...prev, [runId]: calls }));
        setTraceByRun((prev) => ({ ...prev, [runId]: trace }));
      } catch {
        setToolCallsByRun((prev) => ({ ...prev, [runId]: [] }));
        setTraceByRun((prev) => ({ ...prev, [runId]: [] }));
      } finally {
        setLoadingRunId(null);
      }
    }
  };

  if (!orgId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <EmptyState icon={<AlertTriangle size={24} />} title={t("auditPage.failedToLoad")} description={error} />
      </Card>
    );
  }

  if (turns.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState icon={<Bot size={20} />} title={t("auditPage.empty.assistant")} />
      </Card>
    );
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {turns.map((turn) => {
            const isExpanded = expandedRunId === turn.run_id;
            const calls = toolCallsByRun[turn.run_id];
            const trace = traceByRun[turn.run_id];
            return (
              <div key={turn.run_id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => toggleExpanded(turn.run_id)}>
                  {isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <span className="text-sm font-medium text-slate-900">{turn.conversation_title ?? t("auditPage.assistantTurn.untitled")}</span>
                  <Badge color={turn.status === "completed" ? "emerald" : turn.status === "failed" ? "red" : "amber"}>
                    {t(`auditPage.assistantTurn.status.${turn.status}`, { defaultValue: turn.status })}
                  </Badge>
                  {turn.tool_call_count > 0 && <Badge color="slate">{t("auditPage.assistantTurn.toolCallCount", { count: turn.tool_call_count })}</Badge>}
                  {turn.proposal_status && (
                    <Badge color={turn.proposal_status === "completed" ? "emerald" : turn.proposal_status === "rejected" ? "red" : "amber"}>
                      {t(`auditPage.assistantTurn.proposalStatus.${turn.proposal_status}`, { defaultValue: turn.proposal_status })}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500 ml-auto">{turn.requested_by_email ?? "—"}</span>
                  <span className="text-xs text-slate-400">{formatDate(turn.created_at, { withTime: true })}</span>
                </div>

                {isExpanded && (
                  <div className="mt-3 ml-6 space-y-3">
                    <TurnStage
                      label={t("auditPage.assistantTurn.query")}
                      text={turn.user_message_text}
                      timestamp={turn.started_at ?? turn.created_at}
                      elapsedMs={0}
                    />

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Activity size={14} className="text-brand-600" />
                        <p className="text-xs font-semibold text-slate-700">
                          {t("auditPage.assistantTurn.executionTrace")}
                        </p>
                        {trace && <Badge color="slate">{trace.length}</Badge>}
                      </div>
                      {loadingRunId === turn.run_id ? (
                        <Spinner size={18} />
                      ) : trace && trace.length > 0 ? (
                        <div className="border-l border-slate-200 pl-3">
                          {trace.map((event, index) => (
                            <TraceEventRow
                              key={event.id}
                              event={event}
                              isLast={index === trace.length - 1}
                              runStartedAt={turn.started_at ?? turn.created_at}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {t("auditPage.assistantTurn.noTrace")}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">{t("auditPage.assistantTurn.toolCalls")}</p>
                      {loadingRunId === turn.run_id ? (
                        <Spinner size={18} />
                      ) : calls && calls.length > 0 ? (
                        <div className="space-y-1.5">
                          {calls.map((call) => {
                            const entities = (call.result_redacted?.entities as ToolEntitySummary[] | undefined) ?? [];
                            return (
                              <div key={call.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-medium text-slate-800">{call.tool_name}</span>
                                  <Badge color={call.status === "completed" ? "emerald" : "red"}>{call.status}</Badge>
                                  <Badge color="slate">{call.risk_level}</Badge>
                                  <span className="text-slate-400 ml-auto">{formatDate(call.created_at, { withTime: true })}</span>
                                </div>
                                {entities.length > 0 && (
                                  <p className="text-slate-500 mt-1">
                                    {t("auditPage.assistantTurn.entities")}: {entities.map((e) => e.label).join(", ")}
                                  </p>
                                )}
                                {call.error_message && <p className="text-red-600 mt-1">{call.error_message}</p>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">{t("auditPage.assistantTurn.noToolCalls")}</p>
                      )}
                    </div>

                    {turn.proposal_action_type && (
                      <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{t("auditPage.assistantTurn.proposal")}</p>
                        <p className="text-slate-500 mt-0.5">
                          {turn.proposal_action_type} · {t(`auditPage.assistantTurn.proposalStatus.${turn.proposal_status}`, { defaultValue: turn.proposal_status })}
                          {turn.proposal_risk_level ? ` · ${turn.proposal_risk_level}` : ""}
                        </p>
                      </div>
                    )}

                    <TurnStage
                      label={t("auditPage.assistantTurn.reply")}
                      text={turn.assistant_message_text}
                      timestamp={turn.completed_at}
                      elapsedMs={elapsedMilliseconds(
                        turn.started_at ?? turn.created_at,
                        turn.completed_at,
                      )}
                    />

                    {turn.error_message && <p className="text-xs text-red-600">{turn.error_message}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost btn-sm disabled:opacity-40">
          <ChevronLeft size={14} /> {t("auditPage.pagination.previous")}
        </button>
        <button onClick={() => setPage((p) => p + 1)} disabled={turns.length < pageSize} className="btn-ghost btn-sm disabled:opacity-40">
          {t("auditPage.pagination.next")} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function TraceEventRow({
  event,
  isLast,
  runStartedAt,
}: {
  event: AssistantTraceEvent;
  isLast: boolean;
  runStartedAt: string;
}) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const statusColor = event.status === "failed"
    ? "red"
    : event.status === "flagged"
      ? "amber"
      : event.status === "completed"
        ? "emerald"
        : "slate";
  const details = Object.keys(event.details_redacted ?? {}).length > 0
    ? event.details_redacted
    : null;
  const elapsedMs = elapsedMilliseconds(runStartedAt, event.occurred_at);

  return (
    <div className={`relative pb-3 ${isLast ? "" : ""}`}>
      <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full border-2 border-white bg-brand-500 ring-1 ring-slate-200" />
      <div className="rounded border border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-semibold text-slate-700">
            {event.event_key}
          </span>
          <Badge color={statusColor}>{event.status}</Badge>
          <Badge color="slate">{event.category}</Badge>
          {details && event.category === "model" && (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-brand-700 hover:bg-brand-50"
              onClick={() => setShowDetails((visible) => !visible)}
              title={t("auditPage.assistantTurn.traceDetails")}
              aria-label={t("auditPage.assistantTurn.traceDetails")}
              aria-expanded={showDetails}
            >
              <FileJson2 size={14} />
            </button>
          )}
          {event.duration_ms !== null && (
            <span className="ml-auto font-mono text-[10px] text-slate-400">
              {formatDurationSeconds(event.duration_ms)}
            </span>
          )}
          <span className="font-mono text-[10px] text-slate-500">
            +{formatDurationSeconds(elapsedMs)}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatDate(event.occurred_at, { withTime: true, withSeconds: true })}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-700">{event.summary}</p>
        {details && event.category !== "model" && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[10px] font-medium text-brand-700">
              {t("auditPage.assistantTurn.traceDetails")}
            </summary>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-600">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>
        )}
        {details && event.category === "model" && showDetails && (
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-slate-100 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-600">
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function TurnStage({
  label,
  text,
  timestamp,
  elapsedMs,
}: {
  label: string;
  text: string | null;
  timestamp?: string | null;
  elapsedMs?: number | null;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {elapsedMs !== undefined && elapsedMs !== null && (
          <span className="font-mono text-[10px] text-slate-500">
            +{formatDurationSeconds(elapsedMs)}
          </span>
        )}
        {timestamp && (
          <span className="font-mono text-[10px] text-slate-400">
            {formatDate(timestamp, { withTime: true, withSeconds: true })}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{text || t("auditPage.assistantTurn.noText")}</p>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mt-4">
      <button onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost btn-sm disabled:opacity-40">
        <ChevronLeft size={14} /> {t("auditPage.pagination.previous")}
      </button>
      <span className="text-xs text-slate-500">{t("auditPage.pagination.pageOf", { page: page + 1, total: totalPages })}</span>
      <button onClick={() => onChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="btn-ghost btn-sm disabled:opacity-40">
        {t("auditPage.pagination.next")} <ChevronRight size={14} />
      </button>
    </div>
  );
}
