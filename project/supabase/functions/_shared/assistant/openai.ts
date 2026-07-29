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
import { assistantStrings, checkScriptConformance } from "./locales.ts";
import type { AssistantPersistence } from "./persistence.ts";
import { assistantInstructions } from "./prompt.ts";
import { MODEL_TURN_FORMAT } from "./schemas.ts";
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
    output_tokens?: number;
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
const FINAL_RESPONSE_RESERVE_MS = 10_000;
const MIN_TOOL_DECISION_MS = 5_000;
const DEADLINE_CLOCK_SKEW_MS = 250;

export interface ModelRoundPlan {
  forceFinal: boolean;
  timeoutMs: number;
}

export function planModelRound(input: {
  remainingMs: number;
  configuredTimeoutMs: number;
  round: number;
  maxRounds: number;
}): ModelRoundPlan {
  const usableMs = Math.max(1, input.remainingMs - DEADLINE_CLOCK_SKEW_MS);
  const isLastRound = input.round === input.maxRounds - 1;
  const canAffordToolRound =
    usableMs >= FINAL_RESPONSE_RESERVE_MS + MIN_TOOL_DECISION_MS;
  const forceFinal = isLastRound || !canAffordToolRound;
  const roundBudgetMs = forceFinal
    ? usableMs
    : usableMs - FINAL_RESPONSE_RESERVE_MS;

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

async function requestResponses(
  config: AssistantConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<ResponsesEnvelope> {
  if (!config.openAiApiKey) {
    throw new AssistantHttpError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "The AI service is not configured.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.openAiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
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
    return payload;
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
  const response = await requestResponses(input.config, {
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
  const deadlineAt = Date.now() + input.config.maxTurnMs;

  const executeCall = async (
    call: FunctionCall,
  ): Promise<{ call: FunctionCall; result: ToolResult }> => {
    let argumentsValue: Record<string, unknown> = {};
    let result: ToolResult;
    const started = Date.now();
    await input.persistence.logTrace(input.runId, input.conversationId, {
      category: "tool",
      eventKey: "tool.execution.started",
      status: "started",
      summary: `Tool ${call.name} started.`,
      details: {
        tool_name: call.name,
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
      category: "tool",
      eventKey: "tool.execution.completed",
      status: result.ok ? "completed" : "failed",
      summary: result.ok
        ? `Tool ${call.name} completed.`
        : `Tool ${call.name} failed.`,
      details: {
        tool_name: call.name,
        error_code: result.error?.code ?? null,
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
    const roundPlan = planModelRound({
      remainingMs,
      configuredTimeoutMs: input.config.openAiTimeoutMs,
      round,
      maxRounds: input.config.maxToolRounds,
    });

    const roundEffort = reasoningEffortForRound(
      input.config,
      sensitiveToolsSeen,
    );
    await input.persistence.logTrace(input.runId, input.conversationId, {
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
      },
    });
    const modelStarted = Date.now();
    const response = await requestResponses(input.config, {
      model: input.config.model,
      reasoning: {
        effort: roundEffort,
      },
      instructions: assistantInstructions({
        principal: input.principal,
        locale: input.request.locale,
        context: input.request.context,
        conversationId: input.conversationId,
      }),
      input: replay,
      tools: toolsForPrincipal(input.principal),
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
    }, roundPlan.timeoutMs);
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    const output = Array.isArray(response.output) ? response.output : [];
    replay.push(...output);
    // tool_choice:"none" guarantees a text-only response, but calls is also
    // forced empty defensively so a forced-final round always resolves to a
    // real (if partial) answer instead of ever re-entering tool execution.
    const calls = roundPlan.forceFinal ? [] : functionCalls(output);
    await input.persistence.logTrace(input.runId, input.conversationId, {
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
        output_item_count: output.length,
        tool_call_count: calls.length,
        tool_names: calls.map((call) => call.name),
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
      durationMs: Date.now() - modelStarted,
    });

    if (!calls.length) {
      const rawText = outputText(response);
      if (!rawText) {
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
        throw new AssistantHttpError(
          502,
          "MODEL_OUTPUT_INVALID",
          "The AI service returned an invalid structured response.",
          true,
        );
      }
      await input.persistence.logTrace(input.runId, input.conversationId, {
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
      category: "tool",
      eventKey: "tool.batch.planned",
      status: "completed",
      summary:
        `Planned ${reads.length} parallel read(s) and ${writes.length} serialized write/proposal(s).`,
      details: {
        round: round + 1,
        read_tool_names: reads.map((call) => call.name),
        write_tool_names: writes.map((call) => call.name),
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
