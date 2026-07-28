/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAI Responses payloads are validated at this boundary before use. */
// deno-lint-ignore-file no-explicit-any
import { safetyIdentifier } from "./action-token.ts";
import { actionSpecByTool } from "./actions.ts";
import {
  REASONING_EFFORTS,
  type AssistantConfig,
  type ReasoningEffort,
} from "./config.ts";
import { AssistantHttpError } from "./http.ts";
import { assistantStrings, checkScriptConformance } from "./locales.ts";
import type { AssistantPersistence } from "./persistence.ts";
import { assistantInstructions } from "./prompt.ts";
import { MODEL_TURN_FORMAT } from "./schemas.ts";
import {
  executeTool,
  toolRisk,
  toolsForPrincipal,
  type ToolExecutionContext,
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
import {
  asRecord,
  isRecord,
  normalizeModelTurn,
} from "./validation.ts";

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
]);

// Reads that surface finance or compliance data, plus every write-proposal
// tool (via actionSpecByTool), warrant more careful reasoning than a plain
// inventory lookup. Consulted per round rather than reading
// config.reasoningEffort as one static value for the whole turn.
const FINANCE_OR_COMPLIANCE_READ_TOOLS = new Set([
  "get_partner_portfolio",
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

// Safety margin (beyond one worst-case model round trip) reserved before
// deciding a round can no longer safely afford another tool round trip.
const ROUND_DEADLINE_BUFFER_MS = 2_000;

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
): Promise<ResponsesEnvelope> {
  if (!config.openAiApiKey) {
    throw new AssistantHttpError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "The AI service is not configured.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openAiTimeoutMs);
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
    const payload = await response.json().catch(() => ({})) as ResponsesEnvelope;
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
  });
  return {
    ...turn,
    provenance: {
      ...turn.provenance,
      sources,
      truncated: truncated || turn.provenance.truncated || undefined,
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

    // Once the remaining turn budget can no longer safely absorb another
    // full model round trip (or this is the last permitted round), force a
    // text-only response instead of letting the run either blow past the
    // deadline or exhaust maxToolRounds into a hard error.
    const remainingMs = deadlineAt - Date.now();
    const isLastRound = round === input.config.maxToolRounds - 1;
    const deadlineClose =
      remainingMs <= input.config.openAiTimeoutMs + ROUND_DEADLINE_BUFFER_MS;
    const forceFinal = isLastRound || deadlineClose;

    const response = await requestResponses(input.config, {
      model: input.config.model,
      reasoning: {
        effort: reasoningEffortForRound(input.config, sensitiveToolsSeen),
      },
      instructions: assistantInstructions({
        principal: input.principal,
        locale: input.request.locale,
        context: input.request.context,
        conversationId: input.conversationId,
      }),
      input: replay,
      tools: toolsForPrincipal(input.principal),
      tool_choice: forceFinal ? "none" : "auto",
      parallel_tool_calls: true,
      text: { format: MODEL_TURN_FORMAT },
      max_output_tokens: input.config.maxOutputTokens,
      safety_identifier: await safetyIdentifier(
        input.principal.userId,
        input.config.safetySalt,
      ),
      include: ["reasoning.encrypted_content"],
      store: false,
    });
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    const output = Array.isArray(response.output) ? response.output : [];
    replay.push(...output);
    // tool_choice:"none" guarantees a text-only response, but calls is also
    // forced empty defensively so a forced-final round always resolves to a
    // real (if partial) answer instead of ever re-entering tool execution.
    const calls = forceFinal ? [] : functionCalls(output);

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
        vehicleIds,
      );
      turn = canonicalizeConfirmationBlocks(turn, issuedProposals);
      turn = groundProvenance(turn, evidence, anyTruncated);

      // Language-mismatch is observability-only for now: flag and log, no
      // corrective re-prompt round.
      const conformance = checkScriptConformance(
        input.request.locale,
        turn.answer.text,
      );
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
      }

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

