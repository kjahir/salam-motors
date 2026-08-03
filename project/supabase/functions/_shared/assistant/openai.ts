/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAI Responses payloads are validated at this boundary before use. */
// deno-lint-ignore-file no-explicit-any
import { safetyIdentifier } from "./action-token.ts";
import { actionSpecByTool } from "./actions.ts";
import {
  type AssistantConfig,
  REASONING_EFFORTS,
  type ReasoningEffort,
} from "./config.ts";
import { AssistantHttpError } from "./http.ts";
import { modelToolNames, traceModelItems } from "./model-trace.ts";
import {
  assistantStrings,
  checkScriptConformance,
  LOCALE_LANGUAGES,
  normalizeAssistantLocale,
} from "./locales.ts";
import type { AssistantPersistence } from "./persistence.ts";
import { assistantInstructions } from "./prompt.ts";
import { MODEL_TURN_FORMAT } from "./schemas.ts";
import { AnswerTextScanner, readSseData } from "./streaming.ts";
import {
  executeTool,
  type ToolExecutionContext,
  toolRisk,
  toolsForPrincipal,
} from "./tools.ts";
import type {
  AssistantBlock,
  AssistantPrincipal,
  AssistantSource,
  AssistantTurn,
  AssistantTurnRequest,
  ConversationHistoryItem,
  IssuedProposal,
  RunUsage,
  ToolEntity,
  ToolResult,
} from "./types.ts";
import { asRecord, isRecord, normalizeModelTurn } from "./validation.ts";
import { WORKFLOW_STEP } from "./workflow.ts";

interface FunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

interface ResponsesEnvelope {
  id?: string;
  output?: unknown[];
  output_text?: string;
  status?: string;
  incomplete_details?: unknown;
  usage?: {
    input_tokens?: number;
    /** Reasoning tokens included. See output_tokens_details for the split. */
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { code?: string; message?: string };
}

export interface OpenAIRunInput {
  client: any;
  persistence: AssistantPersistence;
  principal: AssistantPrincipal;
  config: AssistantConfig;
  request: AssistantTurnRequest;
  conversationId: string;
  history: ConversationHistoryItem[];
  runId: string | null;
  onStatus?: (messageKey: string) => void;
  /**
   * Receives answer text as the model writes it. Present only on streaming (SSE) requests;
   * when absent the model call is buffered exactly as before, so the non-streaming JSON
   * endpoint is unaffected.
   */
  onAnswerDelta?: (text: string) => void;
}

export interface OpenAIRunResult {
  turn: AssistantTurn;
  usage: RunUsage;
}

const READ_ONLY_TOOLS = new Set([
  "search_inventory",
  "get_vehicle_360",
  "get_dashboard_ageing",
  "get_alerts_compliance",
  "get_partner_portfolio",
  "search_parties",
  "search_partners",
  "get_finance_overview",
  "get_operational_records",
  "get_compliance_policies",
  "get_administration_overview",
]);

// Reads that surface finance or compliance data, plus every write-proposal
// tool (via actionSpecByTool), warrant more careful reasoning than a plain
// inventory lookup. Consulted per round rather than reading
// config.reasoningEffort as one static value for the whole turn.
const FINANCE_OR_COMPLIANCE_READ_TOOLS = new Set([
  "get_partner_portfolio",
  "search_parties",
  "search_partners",
  "get_finance_overview",
  "get_compliance_policies",
  "get_administration_overview",
  "get_alerts_compliance",
]);

function roundTouchesSensitiveData(callNames: readonly string[]): boolean {
  return callNames.some((name) =>
    FINANCE_OR_COMPLIANCE_READ_TOOLS.has(name) ||
    Boolean(actionSpecByTool(name))
  );
}

const REASONING_EFFORT_RANK = new Map<ReasoningEffort, number>(
  REASONING_EFFORTS.map((effort, index) => [effort, index]),
);

function reasoningEffortForRound(
  config: AssistantConfig,
  sensitiveToolsSeen: boolean,
): ReasoningEffort {
  if (!sensitiveToolsSeen) return config.reasoningEffort;
  const floor = REASONING_EFFORT_RANK.get("medium") ?? 0;
  const current = REASONING_EFFORT_RANK.get(config.reasoningEffort) ?? 0;
  return current >= floor ? config.reasoningEffort : "medium";
}

// Keep enough of the wall-clock budget for a final, text-only response after
// tool execution. Model requests use the remaining per-round budget instead
// of the (potentially larger) global OpenAI timeout.
const MIN_FINAL_RESPONSE_RESERVE_MS = 10_000;
const MIN_TOOL_DECISION_MS = 5_000;
const DEADLINE_CLOCK_SKEW_MS = 250;

/**
 * How much of the turn budget is held back for the final answer.
 *
 * This used to be a flat 10s, which made the final response un-tunable: raising
 * ASSISTANT_MAX_TURN_MS bought the *tool* rounds more time while the answer itself stayed
 * pinned to ten seconds. Summarizing half a dozen tool results into the structured turn
 * format takes a reasoning model longer than that, so the turn reliably spent its whole
 * budget gathering evidence and then timed out writing it up — the more work a question
 * needed, the more certain it was to produce nothing.
 *
 * Writing the answer is the expensive half, not an afterthought, so the reserve scales with
 * the budget and the floor is the old constant.
 */
export function finalResponseReserveMs(maxTurnMs: number): number {
  return Math.max(MIN_FINAL_RESPONSE_RESERVE_MS, Math.round(maxTurnMs * 0.45));
}

export interface ModelRoundPlan {
  forceFinal: boolean;
  timeoutMs: number;
}

export function planModelRound(input: {
  remainingMs: number;
  configuredTimeoutMs: number;
  round: number;
  maxRounds: number;
  /** Held back for the final answer. See finalResponseReserveMs(). */
  reserveMs: number;
}): ModelRoundPlan {
  const usableMs = Math.max(1, input.remainingMs - DEADLINE_CLOCK_SKEW_MS);
  const isLastRound = input.round === input.maxRounds - 1;
  const canAffordToolRound = usableMs >= input.reserveMs + MIN_TOOL_DECISION_MS;
  const forceFinal = isLastRound || !canAffordToolRound;
  const roundBudgetMs = forceFinal
    ? usableMs
    : usableMs - input.reserveMs;

  return {
    forceFinal,
    timeoutMs: Math.max(
      1,
      Math.min(input.configuredTimeoutMs, roundBudgetMs),
    ),
  };
}

function functionCalls(output: unknown[]): FunctionCall[] {
  return output.flatMap((item) => {
    if (
      !isRecord(item) || item.type !== "function_call" ||
      typeof item.call_id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.arguments !== "string"
    ) return [];
    return [{
      type: "function_call" as const,
      call_id: item.call_id,
      name: item.name,
      arguments: item.arguments,
    }];
  });
}

function outputText(response: ResponsesEnvelope): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  for (const item of response.output ?? []) {
    if (!isRecord(item) || item.type !== "message") continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (
        isRecord(content) && content.type === "output_text" &&
        typeof content.text === "string"
      ) return content.text;
    }
  }
  return "";
}

function parseArguments(value: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    throw new Error("Tool arguments were not valid JSON");
  }
}

/**
 * Tracing variant of parseArguments: unparseable arguments are themselves worth seeing in
 * the trace, so they are returned rather than thrown. Never use this to drive execution.
 */
function safeArguments(value: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return { unparsed: value };
  }
}

/**
 * Reduces the Responses event stream into the same envelope the buffered path returns,
 * forwarding answer text to the caller as it decodes.
 *
 * `response.completed` and `response.incomplete` both carry the entire response object, so
 * the final envelope is taken wholesale from whichever arrives rather than rebuilt from
 * deltas. That keeps every downstream reader — usage totals, truncation detection, function
 * calls, the trace — working on exactly the shape it did before streaming existed.
 */
async function consumeResponseStream(
  body: ReadableStream<Uint8Array>,
  startedAt: number,
  onAnswerDelta: (text: string) => void,
): Promise<ModelCallResult> {
  const scanner = new AnswerTextScanner();
  let envelope: ResponsesEnvelope | null = null;
  let firstTokenMs: number | null = null;

  for await (const item of readSseData(body)) {
    const type = typeof item.type === "string" ? item.type : "";
    if (type === "response.output_text.delta") {
      if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
      const delta = typeof item.delta === "string" ? item.delta : "";
      if (!delta) continue;
      const text = scanner.feed(delta);
      // A tool-selection round never produces the turn document, so the scanner stays
      // silent and nothing is emitted — no need to know in advance which kind of round
      // this is.
      if (text) onAnswerDelta(text);
      continue;
    }
    if (type === "response.completed" || type === "response.incomplete") {
      const value = item.response;
      if (typeof value === "object" && value !== null) {
        envelope = value as ResponsesEnvelope;
      }
      continue;
    }
    if (type === "response.failed" || type === "error") {
      const value = item.response ?? item;
      const record = typeof value === "object" && value !== null
        ? value as ResponsesEnvelope
        : {};
      throw new AssistantHttpError(
        502,
        "MODEL_UPSTREAM_FAILED",
        record.error?.message ??
          "The AI service could not complete this request.",
        true,
      );
    }
  }

  if (!envelope) {
    // The stream ended without a terminal event: treat as an upstream failure rather than
    // silently returning an empty turn.
    throw new AssistantHttpError(
      502,
      "MODEL_UPSTREAM_FAILED",
      "The AI service ended the response stream unexpectedly.",
      true,
    );
  }
  return { envelope, firstTokenMs, streamed: true };
}

/**
 * Result of one model call, plus the streaming facts the trace needs. `firstTokenMs` is the
 * whole point of Phase 1 — without it a fast answer and a slow answer that started early
 * look identical.
 */
interface ModelCallResult {
  envelope: ResponsesEnvelope;
  firstTokenMs: number | null;
  streamed: boolean;
}

async function requestResponses(
  config: AssistantConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
  onAnswerDelta?: (text: string) => void,
): Promise<ModelCallResult> {
  if (!config.openAiApiKey) {
    throw new AssistantHttpError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "The AI service is not configured.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const streaming = typeof onAnswerDelta === "function";
  const startedAt = Date.now();
  try {
    const response = await fetch(`${config.openAiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(streaming ? { ...body, stream: true } : body),
      signal: controller.signal,
    });
    if (streaming && response.ok && response.body) {
      return await consumeResponseStream(
        response.body,
        startedAt,
        onAnswerDelta!,
      );
    }
    const payload = await response.json().catch(
      () => ({}),
    ) as ResponsesEnvelope;
    if (!response.ok) {
      console.error(
        "OpenAI Responses request failed",
        response.status,
        payload.error?.code ?? "unknown",
      );
      if (response.status === 429) {
        throw new AssistantHttpError(
          429,
          "ASSISTANT_BUSY",
          "The assistant is receiving too many requests. Please retry shortly.",
          true,
        );
      }
      throw new AssistantHttpError(
        502,
        "MODEL_UPSTREAM_FAILED",
        "The AI service could not complete this request.",
        response.status >= 500,
      );
    }
    return { envelope: payload, firstTokenMs: null, streamed: false };
  } catch (error) {
    if (error instanceof AssistantHttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AssistantHttpError(
        504,
        "MODEL_TIMEOUT",
        "The AI service took too long to respond.",
        true,
      );
    }
    throw new AssistantHttpError(
      502,
      "MODEL_UNAVAILABLE",
      "The AI service is temporarily unavailable.",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function canonicalizeConfirmationBlocks(
  turn: AssistantTurn,
  issued: IssuedProposal[],
): AssistantTurn {
  const proposals = new Map(issued.map((item) => [item.reference, item]));
  const used = new Set<string>();
  const blocks = turn.blocks.flatMap((block): AssistantBlock[] => {
    if (block.type !== "confirmation") return [block];
    if (
      block.confirm.kind !== "invoke" ||
      !proposals.has(block.confirm.actionToken)
    ) return [];
    const proposal = proposals.get(block.confirm.actionToken)!;
    used.add(proposal.reference);
    return [{
      ...block,
      risk: proposal.risk,
      changes: proposal.changes,
      confirm: {
        ...block.confirm,
        actionToken: proposal.actionToken,
        risk: proposal.risk,
      },
      expiresAt: proposal.expiresAt,
    }];
  });
  const strings = assistantStrings(turn.locale);
  for (const proposal of issued) {
    if (used.has(proposal.reference)) continue;
    blocks.push({
      type: "confirmation",
      title: proposal.title,
      summary: proposal.summary,
      risk: proposal.risk,
      changes: proposal.changes,
      confirm: {
        kind: "invoke",
        label: strings.confirmLabel,
        actionToken: proposal.actionToken,
        risk: proposal.risk,
      },
      cancel: {
        kind: "reply",
        label: strings.cancelLabel,
        message: strings.cancelProposedActionMessage,
      },
      expiresAt: proposal.expiresAt,
    });
  }
  return { ...turn, blocks };
}

function groundProvenance(
  turn: AssistantTurn,
  evidence: Map<string, ToolEntity>,
  truncated: boolean,
): AssistantTurn {
  const byType = new Map<string, ToolEntity[]>();
  for (const item of evidence.values()) {
    byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  }
  const sources = turn.provenance.sources.flatMap(
    (source): AssistantSource[] => {
      if (source.id) {
        const canonical = evidence.get(`${source.entity}:${source.id}`);
        return canonical
          ? [{
            entity: canonical.type,

            id: canonical.id,
            label: canonical.label,
          }]
          : [];
      }
      const matches = byType.get(source.entity) ?? [];
      return matches.length
        ? [{
          entity: source.entity,
          label: source.label,
          count: Math.min(source.count ?? matches.length, matches.length),
        }]
        : [];
    },
  );
  return {
    ...turn,
    provenance: {
      ...turn.provenance,
      sources,
      truncated: truncated || turn.provenance.truncated || undefined,
    },
  };
}

async function correctTurnLanguage(input: {
  turn: AssistantTurn;
  locale: string;
  principal: AssistantPrincipal;
  context: AssistantTurnRequest["context"];
  conversationId: string;
  config: AssistantConfig;
  timeoutMs: number;
  vehicleIds: ReadonlySet<string>;
}): Promise<{ turn: AssistantTurn; usage: RunUsage }> {
  const languageName = input.locale === "ta-IN"
    ? "Tamil"
    : input.locale === "hi-IN"
    ? "Hindi"
    : input.locale;
  // Not streamed: this is a repair pass over an already-delivered answer, so there is no
  // first-token latency worth chasing and the client has long since seen the text.
  const { envelope: response } = await requestResponses(input.config, {
    model: input.config.model,
    reasoning: { effort: "low" },
    instructions: `Rewrite the supplied AssistantTurn in ${languageName}.
Translate only user-facing prose: answer.text, block titles/descriptions/labels/summaries/messages, follow-up labels/messages, and confirmation display text.
Preserve the JSON structure, schemaVersion, locale, IDs, entity types, vehicle names, stock and registration numbers, money values, app status codes, dates, URLs, action tokens, risks, page names, parameter keys, and provenance exactly.
Do not add, remove, infer, or alter facts. Return exactly the AssistantTurn JSON schema.`,
    input: [{ role: "user", content: JSON.stringify(input.turn) }],
    tools: [],
    tool_choice: "none",
    parallel_tool_calls: false,
    text: { format: MODEL_TURN_FORMAT },
    max_output_tokens: input.config.maxOutputTokens,
    safety_identifier: await safetyIdentifier(
      input.principal.userId,
      input.config.safetySalt,
    ),
    store: false,
  }, input.timeoutMs);
  const rawText = outputText(response);
  if (!rawText) {
    throw new AssistantHttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "The AI service returned an incomplete translated response.",
      true,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AssistantHttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "The AI service returned an invalid translated response.",
      true,
    );
  }
  return {
    turn: normalizeModelTurn(
      parsed,
      input.conversationId,
      input.locale,
      input.principal,
      input.context,
      new Set(input.vehicleIds),
    ),
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

export async function runOpenAITurn(
  input: OpenAIRunInput,
): Promise<OpenAIRunResult> {
  if (!input.config.openAiApiKey) {
    throw new AssistantHttpError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "The AI service is not configured.",
    );
  }

  const evidence = new Map<string, ToolEntity>();
  const issuedProposals: IssuedProposal[] = [];
  const context: ToolExecutionContext = {
    client: input.client,
    principal: input.principal,
    config: input.config,
    persistence: input.persistence,
    conversationId: input.conversationId,
    runId: input.runId,
    locale: input.request.locale,
    issuedProposals,
    evidence,
    onStatus: input.onStatus,
  };
  const replay: unknown[] = [
    ...input.history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: "user", content: input.request.message },
  ];
  const usage: RunUsage = { inputTokens: 0, outputTokens: 0 };
  let totalCalls = 0;
  let anyTruncated = false;
  let sensitiveToolsSeen = false;
  const startedAt = Date.now();
  const deadlineAt = startedAt + input.config.maxTurnMs;
  /**
   * Wall-clock fenced off for writing the final answer. A tool round is therefore given
   * *less* time than the turn has left, which is why a degraded round can report more time
   * remaining than the budget it just blew — the difference is this reserve, untouched.
   */
  const reserveMs = finalResponseReserveMs(input.config.maxTurnMs);
  /**
   * Set when a tool-selection round has already burned its budget and we have fallen back
   * to spending FINAL_RESPONSE_RESERVE_MS on a text-only answer. Only ever set once: if the
   * reserved final round times out too, there is genuinely nothing left to say and the
   * MODEL_TIMEOUT propagates.
   */
  let degradedToFinal = false;

  const executeCall = async (
    call: FunctionCall,
  ): Promise<{ call: FunctionCall; result: ToolResult }> => {
    let argumentsValue: Record<string, unknown> = {};
    let result: ToolResult;
    const started = Date.now();
    await input.persistence.logTrace(input.runId, input.conversationId, {
      workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
      category: "tool",
      eventKey: "tool.execution.started",
      status: "started",
      summary: `Tool ${call.name} started.`,
      details: {
        tool_name: call.name,
        call_id: call.call_id,
        risk_level: toolRisk(call.name),
        read_only: READ_ONLY_TOOLS.has(call.name),
      },
    });
    try {
      argumentsValue = parseArguments(call.arguments);
      result = await executeTool(context, call.name, argumentsValue);
    } catch (error) {
      result = {
        ok: false,
        error: {
          code: "INVALID_TOOL_ARGUMENTS",
          message: error instanceof Error
            ? error.message.slice(0, 240)
            : "Tool arguments were invalid",
        },
      };
    }
    anyTruncated ||= result.truncated === true;
    await input.persistence.logTrace(input.runId, input.conversationId, {
      workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
      category: "tool",
      eventKey: "tool.execution.completed",
      status: result.ok ? "completed" : "failed",
      summary: result.ok
        ? `Tool ${call.name} completed.`
        : `Tool ${call.name} failed.`,
      details: {
        tool_name: call.name,
        call_id: call.call_id,
        arguments: argumentsValue,
        error_code: result.error?.code ?? null,
        error_message: result.error?.message ?? null,
        entity_count: result.entities?.length ?? 0,
        truncated: result.truncated === true,
      },
      durationMs: Date.now() - started,
    });
    await input.persistence.logToolCall(
      input.runId,
      input.conversationId,
      call.name,
      argumentsValue,
      result,
      Date.now() - started,
      toolRisk(call.name),
    );
    return { call, result };
  };

  for (let round = 0; round < input.config.maxToolRounds; round += 1) {
    input.onStatus?.("assistant.status.thinking");

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= DEADLINE_CLOCK_SKEW_MS) {
      throw new AssistantHttpError(
        504,
        "MODEL_TIMEOUT",
        "The AI service took too long to respond.",
        true,
      );
    }
    // After a degrade there is exactly one thing left worth doing: spend what remains on a
    // text-only answer. planModelRound would otherwise hand this round another tool budget
    // and re-reserve a final response that can never be reached.
    const roundPlan = degradedToFinal
      ? {
        forceFinal: true,
        timeoutMs: Math.max(1, remainingMs - DEADLINE_CLOCK_SKEW_MS),
      }
      : planModelRound({
        remainingMs,
        configuredTimeoutMs: input.config.openAiTimeoutMs,
        round,
        maxRounds: input.config.maxToolRounds,
        reserveMs,
      });

    // The degraded round writes up evidence already gathered, with tool_choice:"none" — it
    // cannot call a tool, propose an action, or reach sensitive data it has not already
    // read. The sensitive-data effort bump exists to make *tool decisions* more careful, so
    // applying it here buys nothing and spends the reserve that this round is racing. That
    // overspend is what turns "answering from evidence already gathered" into a timeout.
    const roundEffort = degradedToFinal
      ? input.config.reasoningEffort
      : reasoningEffortForRound(input.config, sensitiveToolsSeen);
    const roundTools = toolsForPrincipal(input.principal);
    // Built once so the trace records the exact instructions this round was sent, rather
    // than a reconstruction that could drift from what the model actually saw.
    const roundInstructions = assistantInstructions({
      principal: input.principal,
      locale: input.request.locale,
      context: input.request.context,
      conversationId: input.conversationId,
    });
    await input.persistence.logTrace(input.runId, input.conversationId, {
      workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
      category: "model",
      eventKey: "model.round.started",
      status: "started",
      summary: `Model orchestration round ${round + 1} started.`,
      details: {
        round: round + 1,
        max_rounds: input.config.maxToolRounds,
        model: input.config.model,
        reasoning_effort: roundEffort,
        force_final_response: roundPlan.forceFinal,
        timeout_ms: roundPlan.timeoutMs,
        replay_item_count: replay.length,
        // Promoted out of the instructions string: the mandated response language is a
        // first-order cost driver — Indic scripts cost several times the tokens of English
        // for the same answer — and reading it required scanning a 4KB prompt.
        response_locale: input.request.locale,
        response_language:
          LOCALE_LANGUAGES[normalizeAssistantLocale(input.request.locale)],
        request: {
          endpoint: "responses",
          instructions: roundInstructions,
          input_items: traceModelItems(replay),
          tool_names: modelToolNames(roundTools),
          tool_choice: roundPlan.forceFinal ? "none" : "auto",
          parallel_tool_calls: true,
          structured_output: true,
          max_output_tokens: input.config.maxOutputTokens,
          store: false,
        },
      },
    });
    const modelStarted = Date.now();
    let response: ResponsesEnvelope;
    let firstTokenMs: number | null = null;
    let streamed = false;
    try {
      const call = await requestResponses(input.config, {
        model: input.config.model,
        reasoning: {
          effort: roundEffort,
        },
        instructions: roundInstructions,
        input: replay,
        tools: roundTools,
        tool_choice: roundPlan.forceFinal ? "none" : "auto",
        parallel_tool_calls: true,
        text: { format: MODEL_TURN_FORMAT },
        max_output_tokens: input.config.maxOutputTokens,
        safety_identifier: await safetyIdentifier(
          input.principal.userId,
          input.config.safetySalt,
        ),
        include: ["reasoning.encrypted_content"],
        store: false,
      }, roundPlan.timeoutMs, input.onAnswerDelta);
      response = call.envelope;
      firstTokenMs = call.firstTokenMs;
      streamed = call.streamed;
    } catch (error) {
      // A tool-selection round that runs out of budget is what FINAL_RESPONSE_RESERVE_MS
      // was reserved for: stop asking the model which tools to call, and spend the reserve
      // answering from the tool results already gathered. Without this the reserve was
      // unreachable — the round budget always expires at (deadline - reserve), so every
      // turn whose tool phase ran long died on MODEL_TIMEOUT at a fixed ~19.75s instead of
      // degrading, no matter how much useful evidence had already been collected.
      const timedOut = error instanceof AssistantHttpError &&
        error.code === "MODEL_TIMEOUT";
      if (!timedOut || roundPlan.forceFinal || degradedToFinal) {
        // Without this the round simply stops: `model.round.started` is the last thing in
        // the step and the reader is left to infer that no response ever arrived. Said
        // explicitly, a dead round is distinguishable from one still in flight.
        // A forced-final round that dies after a degrade is the case where the run already
        // promised "answering from evidence already gathered" and then did not. Say that
        // plainly rather than reporting a bare timeout that reads as unrelated.
        const brokeThePromise = degradedToFinal && timedOut;
        await input.persistence.logTrace(input.runId, input.conversationId, {
          workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
          category: "model",
          eventKey: "model.round.failed",
          status: "failed",
          summary: brokeThePromise
            ? `Round ${
              round + 1
            } gathered ${totalCalls} tool result(s) but exceeded its ${
              Math.round(roundPlan.timeoutMs / 1000)
            }s final-answer reserve while writing them up. The turn produced no answer.`
            : `Round ${round + 1} failed before returning a response.`,
          details: {
            round: round + 1,
            budget_exceeded: timedOut
              ? (roundPlan.forceFinal ? "final_answer_reserve" : "turn")
              : null,
            error_code: error instanceof AssistantHttpError
              ? error.code
              : "MODEL_REQUEST_FAILED",
            error_message: error instanceof Error
              ? error.message
              : String(error),
            round_budget_ms: roundPlan.timeoutMs,
            round_elapsed_ms: Date.now() - modelStarted,
            final_answer_reserve_ms: reserveMs,
            turn_budget_ms: input.config.maxTurnMs,
            turn_elapsed_ms: Date.now() - startedAt,
            turn_remaining_ms: Math.max(0, deadlineAt - Date.now()),
            reasoning_effort: roundEffort,
            force_final_response: roundPlan.forceFinal,
            followed_degrade: degradedToFinal,
            tool_calls_so_far: totalCalls,
          },
          durationMs: Date.now() - modelStarted,
        });
        if (brokeThePromise) {
          throw new AssistantHttpError(
            504,
            "ANSWER_TIMEOUT",
            "The assistant gathered the information but ran out of time writing the answer. Please ask again, or narrow the question.",
            true,
          );
        }
        throw error;
      }

      degradedToFinal = true;
      const remainingMsNow = Math.max(0, deadlineAt - Date.now());
      await input.persistence.logTrace(input.runId, input.conversationId, {
        workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
        category: "model",
        eventKey: "model.round.degraded",
        status: "flagged",
        summary: `Round ${round + 1} exceeded its ${
          Math.round(roundPlan.timeoutMs / 1000)
        }s tool-selection budget without answering. Stopping tool selection and spending the ${
          Math.round(remainingMsNow / 1000)
        }s reserve on an answer from evidence already gathered.`,
        details: {
          round: round + 1,
          // Which of the three clocks ran out. Naming it matters: the round budget is
          // deliberately smaller than the turn budget, so "exceeded" without a subject
          // reads as a contradiction when remaining_ms is larger than the budget blown.
          budget_exceeded: "tool_selection_round",
          tool_selection_budget_ms: roundPlan.timeoutMs,
          tool_selection_elapsed_ms: Date.now() - modelStarted,
          // The gap between the two numbers above and turn_remaining_ms below.
          final_answer_reserve_ms: reserveMs,
          turn_budget_ms: input.config.maxTurnMs,
          turn_elapsed_ms: Date.now() - startedAt,
          turn_remaining_ms: remainingMsNow,
          reserve_intact: remainingMsNow >= reserveMs - DEADLINE_CLOCK_SKEW_MS,
          tool_calls_so_far: totalCalls,
        },
        durationMs: Date.now() - modelStarted,
      });
      continue;
    }
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    const output = Array.isArray(response.output) ? response.output : [];
    replay.push(...output);
    // tool_choice:"none" guarantees a text-only response, but calls is also
    // forced empty defensively so a forced-final round always resolves to a
    // real (if partial) answer instead of ever re-entering tool execution.
    const calls = roundPlan.forceFinal ? [] : functionCalls(output);
    await input.persistence.logTrace(input.runId, input.conversationId, {
      workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
      category: "model",
      eventKey: "model.round.completed",
      status: "completed",
      summary: calls.length > 0
        ? `Model round ${
          round + 1
        } requested ${calls.length} tool operation(s).`
        : `Model round ${round + 1} produced a final response candidate.`,
      details: {
        round: round + 1,
        response_id: response.id ?? null,
        response_status: response.status ?? null,
        streamed,
        // Time to the model's first token, not to the finished turn. This is the number
        // Phase 1 exists to move; total duration_ms cannot distinguish a fast answer from
        // a slow one that started promptly.
        time_to_first_token_ms: firstTokenMs,
        output_item_count: output.length,
        tool_call_count: calls.length,
        tool_names: calls.map((call) => call.name),
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        response: {
          id: response.id ?? null,
          status: response.status ?? null,
          output_text: outputText(response),
          // output_tokens counts reasoning *and* visible text against max_output_tokens, so
          // a turn can exhaust the cap without the answer ever getting long. Without the
          // split, "output_tokens: 3200" cannot tell you whether to raise the cap or spend
          // less on reasoning — opposite fixes.
          reasoning_tokens: response.usage?.output_tokens_details
            ?.reasoning_tokens ?? null,
          visible_output_tokens: response.usage?.output_tokens != null
            ? response.usage.output_tokens -
              (response.usage.output_tokens_details?.reasoning_tokens ?? 0)
            : null,
          max_output_tokens: input.config.maxOutputTokens,
          hit_output_cap: (response.usage?.output_tokens ?? 0) >=
            input.config.maxOutputTokens,
          incomplete_details: response.incomplete_details ?? null,
          output_items: traceModelItems(output),
          tool_calls: calls.map((call) => ({
            call_id: call.call_id,
            name: call.name,
            arguments: safeArguments(call.arguments),
          })),
          incomplete: response.incomplete_details != null,
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      },
      durationMs: Date.now() - modelStarted,
    });

    if (!calls.length) {
      const rawText = outputText(response);
      /*
      Our own ceiling, not a misbehaving model. When max_output_tokens stops generation
      mid-JSON the parse below fails, and reporting that as "the AI service returned an
      invalid structured response" sends the reader looking at OpenAI for a limit we set
      here. Raised as a distinct failure so the trace names the real constraint.
      */
      const hitOutputCap = (response.usage?.output_tokens ?? 0) >=
        input.config.maxOutputTokens;
      const truncate = async (): Promise<never> => {
        await input.persistence.logTrace(input.runId, input.conversationId, {
          workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
          category: "model",
          eventKey: "model.output.truncated",
          status: "failed",
          summary:
            `The answer was cut off at the ${input.config.maxOutputTokens}-token output cap, leaving incomplete JSON. Reasoning and visible text share this cap.`,
          details: {
            round: round + 1,
            max_output_tokens: input.config.maxOutputTokens,
            output_tokens: response.usage?.output_tokens ?? 0,
            reasoning_tokens: response.usage?.output_tokens_details
              ?.reasoning_tokens ?? null,
            incomplete_details: response.incomplete_details ?? null,
            recovered_characters: rawText.length,
            evidence_entity_count: evidence.size,
          },
        });
        throw new AssistantHttpError(
          502,
          "ANSWER_TOO_LONG",
          "The assistant's answer was longer than it can return in one turn. Please narrow the question.",
          true,
        );
      };

      if (!rawText) {
        if (hitOutputCap) await truncate();
        throw new AssistantHttpError(
          502,
          "MODEL_OUTPUT_INVALID",
          "The AI service returned an incomplete response.",
          true,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        if (hitOutputCap) await truncate();
        throw new AssistantHttpError(
          502,
          "MODEL_OUTPUT_INVALID",
          "The AI service returned an invalid structured response.",
          true,
        );
      }
      await input.persistence.logTrace(input.runId, input.conversationId, {
        workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
        category: "validation",
        eventKey: "response.structured_json.parsed",
        status: "completed",
        summary: "Model output parsed as structured AssistantTurn JSON.",
        details: { round: round + 1 },
      });
      const vehicleIds = new Set(
        [...evidence.values()]
          .filter((item) => item.type === "vehicle")
          .map((item) => item.id),
      );
      let turn = normalizeModelTurn(
        parsed,
        input.conversationId,
        input.request.locale,
        input.principal,
        input.request.context,
      );
      await input.persistence.logTrace(input.runId, input.conversationId, {
        workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
        category: "validation",
        eventKey: "response.schema.normalized",
        status: "completed",
        summary:
          "Response schema, permissions, navigation, and entity references validated.",
        details: {
          block_count: turn.blocks.length,
          requested_locale: input.request.locale,
          evidence_entity_count: evidence.size,
        },
      });
      let conformance = checkScriptConformance(
        input.request.locale,
        turn.answer.text,
      );
      await input.persistence.logTrace(input.runId, input.conversationId, {
        workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
        category: "validation",
        eventKey: "response.language.checked",
        status: conformance.mismatch ? "flagged" : "completed",
        summary: conformance.mismatch
          ? "Response language script did not match the requested locale."
          : "Response language check passed or was not required.",
        details: {
          locale: input.request.locale,
          checked: conformance.checked,
          script_match_ratio: conformance.ratio,
        },
      });
      if (conformance.checked && conformance.mismatch) {
        console.warn("assistant language mismatch detected", {
          locale: input.request.locale,
          scriptMatchRatio: conformance.ratio,
        });
        await input.persistence.logLanguageMismatch(
          input.runId,
          input.conversationId,
          input.request.locale,
          conformance.ratio ?? 0,
        );
        input.onStatus?.("assistant.status.finalizing");
        const remainingForCorrection = Math.min(
          input.config.openAiTimeoutMs,
          deadlineAt - Date.now() - DEADLINE_CLOCK_SKEW_MS,
        );
        if (remainingForCorrection > 1_000) {
          await input.persistence.logTrace(input.runId, input.conversationId, {
            workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
            category: "model",
            eventKey: "response.language_correction.started",
            status: "started",
            summary:
              "A corrective model pass started for the requested language.",
            details: {
              locale: input.request.locale,
              timeout_ms: remainingForCorrection,
            },
          });
          const correctionStarted = Date.now();
          const corrected = await correctTurnLanguage({
            turn,
            locale: input.request.locale,
            principal: input.principal,
            context: input.request.context,
            conversationId: input.conversationId,
            config: input.config,
            timeoutMs: remainingForCorrection,
            vehicleIds,
          });
          usage.inputTokens += corrected.usage.inputTokens;
          usage.outputTokens += corrected.usage.outputTokens;
          turn = corrected.turn;
          conformance = checkScriptConformance(
            input.request.locale,
            turn.answer.text,
          );
          await input.persistence.logTrace(input.runId, input.conversationId, {
            workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
            category: "validation",
            eventKey: "response.language_correction.completed",
            status: conformance.mismatch ? "failed" : "completed",
            summary: conformance.mismatch
              ? "Corrective language pass still failed script validation."
              : "Corrective language pass completed successfully.",
            details: {
              locale: input.request.locale,
              input_tokens: corrected.usage.inputTokens,
              output_tokens: corrected.usage.outputTokens,
              script_match_ratio: conformance.ratio,
            },
            durationMs: Date.now() - correctionStarted,
          });
          if (conformance.checked && conformance.mismatch) {
            throw new AssistantHttpError(
              502,
              "MODEL_LANGUAGE_MISMATCH",
              "The AI service could not produce an answer in the selected language.",
              true,
            );
          }
        }
      }

      turn = canonicalizeConfirmationBlocks(turn, issuedProposals);
      turn = groundProvenance(turn, evidence, anyTruncated);
      await input.persistence.logTrace(input.runId, input.conversationId, {
        workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
        category: "validation",
        eventKey: "response.grounding.completed",
        status: "completed",
        summary:
          "Confirmation blocks were canonicalized and provenance was grounded in tool evidence.",
        details: {
          issued_proposal_count: issuedProposals.length,
          evidence_entity_count: evidence.size,
          provenance_source_count: turn.provenance.sources.length,
          truncated: anyTruncated,
        },
      });

      return { turn, usage };
    }

    if (totalCalls + calls.length > input.config.maxToolCalls) {
      throw new AssistantHttpError(
        422,
        "TOOL_LIMIT_REACHED",
        "This request requires too many application operations. Please narrow it.",
      );
    }
    totalCalls += calls.length;
    sensitiveToolsSeen ||= roundTouchesSensitiveData(
      calls.map((call) => call.name),
    );

    // Only independent, read-only calls run concurrently. Every immediate
    // write and confirmation proposal is deliberately serialized.
    const reads = calls.filter((call) => READ_ONLY_TOOLS.has(call.name));
    const writes = calls.filter((call) => !READ_ONLY_TOOLS.has(call.name));
    await input.persistence.logTrace(input.runId, input.conversationId, {
      workflowStep: WORKFLOW_STEP.CLASSIFY_AND_TOOLS,
      category: "tool",
      eventKey: "tool.batch.planned",
      status: "completed",
      summary:
        `Planned ${reads.length} parallel read(s) and ${writes.length} serialized write/proposal(s).`,
      details: {
        round: round + 1,
        read_tool_names: reads.map((call) => call.name),
        write_tool_names: writes.map((call) => call.name),
        // The names alone never explained the batch. The call_id ties each planned call to
        // the tool.execution.* events that follow it and to the model output item that
        // requested it, so the chain from prompt to result is followable end to end.
        planned_calls: calls.map((call) => ({
          call_id: call.call_id,
          name: call.name,
          read_only: READ_ONLY_TOOLS.has(call.name),
          risk_level: toolRisk(call.name),
          arguments: safeArguments(call.arguments),
        })),
        total_tool_calls_so_far: totalCalls,
        sensitive_data_path: sensitiveToolsSeen,
      },
    });
    const completed = new Map<
      string,
      { call: FunctionCall; result: ToolResult }
    >();
    for (const item of await Promise.all(reads.map(executeCall))) {
      completed.set(item.call.call_id, item);
    }
    for (const call of writes) {
      const item = await executeCall(call);
      completed.set(call.call_id, item);
    }
    for (const call of calls) {
      const item = completed.get(call.call_id)!;
      replay.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(item.result),
      });
    }
  }

  // Unreachable under normal operation: round `maxToolRounds - 1` always
  // sets forceFinal, which forces tool_choice:"none" and returns a
  // (possibly partial) real answer above instead of looping here. Kept as a
  // defensive fallback rather than an infinite loop if that invariant is
  // ever violated upstream.
  throw new AssistantHttpError(
    422,
    "TOOL_ROUND_LIMIT_REACHED",
    "This request needs more steps than the assistant can safely perform at once.",
  );
}

export function isProposalTool(name: string): boolean {
  return Boolean(actionSpecByTool(name));
}
