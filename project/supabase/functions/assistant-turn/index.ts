// Ask Salam assistant endpoint. One POST route serves two deterministic
// paths: a model-orchestrated chat turn, or — when a signed action token is
// present — the confirmation executor, which never involves the model.
//
// Authorization is never decided here or by the model: the caller-scoped
// client keeps RLS in force, and confirmed writes go through transactional
// RPCs that re-verify ownership, role, argument hash, and idempotency.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticatePrincipal,
  bearerToken,
} from "../_shared/assistant/auth.ts";
import { capabilitiesFor } from "../_shared/assistant/capabilities.ts";
import {
  type AssistantConfig,
  loadAssistantConfig,
} from "../_shared/assistant/config.ts";
import { runConfirmedAction } from "../_shared/assistant/confirmation.ts";
import {
  ASSISTANT_CORS_HEADERS,
  AssistantHttpError,
  jsonResponse,
  sseTurnResponse,
  type SseTurnResult,
  toPublicError,
} from "../_shared/assistant/http.ts";
import { runOpenAITurn } from "../_shared/assistant/openai.ts";
import { AssistantPersistence } from "../_shared/assistant/persistence.ts";
import type {
  AssistantPrincipal,
  AssistantTurnRequest,
  SupabaseClientLike,
} from "../_shared/assistant/types.ts";
import {
  parseAssistantTurnRequest,
  RequestValidationError,
} from "../_shared/assistant/validation.ts";
import { WORKFLOW_STEP } from "../_shared/assistant/workflow.ts";

interface TurnContext {
  client: SupabaseClientLike;
  persistence: AssistantPersistence;
  principal: AssistantPrincipal;
  config: AssistantConfig;
  request: AssistantTurnRequest;
  onStatus?: (messageKey: string) => void;
}

async function runChatTurn(context: TurnContext): Promise<SseTurnResult> {
  const { client, persistence, principal, config, request, onStatus } = context;
  const conversationId = await persistence.ensureConversation(
    request.conversationId,
    request.locale,
    request.message,
  );
  const history = await persistence.loadHistory(conversationId);
  const inputMessageId = await persistence.saveUserMessage(
    conversationId,
    request.message,
    request.locale,
    { surface: request.context.surface },
  );
  const runId = await persistence.startRun(
    conversationId,
    config.model,
    inputMessageId,
    { surface: request.context.surface, page: request.context.page ?? null },
  );

  const started = Date.now();
  await persistence.logTrace(runId, conversationId, {
    workflowStep: WORKFLOW_STEP.AUTHENTICATE,
    category: "request",
    eventKey: "turn.request.accepted",
    status: "completed",
    summary: "Authenticated user request accepted and run context created.",
    details: {
      locale: request.locale,
      surface: request.context.surface,
      page: request.context.page ?? null,
      history_message_count: history.length,
      user_message_persisted: inputMessageId !== null,
      model: config.model,
      stream: request.stream,
    },
  });

  // The single most useful thing in the whole trace when answering "why did the
  // assistant refuse / why did it not do X": the role it resolved the caller to, and
  // the exact set of tools that role unlocked. Everything the model is allowed to do
  // downstream is decided here, so it belongs on the timeline explicitly rather than
  // being inferred from which tools happened to be called.
  const capabilities = capabilitiesFor(principal);
  await persistence.logTrace(runId, conversationId, {
    workflowStep: WORKFLOW_STEP.AUTHENTICATE,
    category: "context",
    eventKey: "context.role.resolved",
    status: "completed",
    summary:
      `Caller resolved as ${principal.role}; ${capabilities.length} capabilities unlocked.`,
    details: {
      role: principal.role,
      capability_count: capabilities.length,
      tools_available: capabilities.map((capability) => capability.toolName),
      confirmation_required_tools: capabilities
        .filter((capability) => capability.risk === "confirmation_required")
        .map((capability) => capability.toolName),
      write_tools: capabilities
        .filter((capability) => capability.risk === "low_risk_write")
        .map((capability) => capability.toolName),
    },
  });

  await persistence.logTrace(runId, conversationId, {
    workflowStep: WORKFLOW_STEP.AUTHENTICATE,
    category: "context",
    eventKey: "context.history.loaded",
    status: history.length > 0 ? "completed" : "skipped",
    summary: history.length > 0
      ? `Loaded ${history.length} earlier message(s) as conversation context.`
      : "No earlier messages; this is the first turn of the conversation.",
    details: {
      history_message_count: history.length,
      conversation_continued: request.conversationId !== null,
    },
  });

  // Step 2 is reported by the client rather than traced inside assistant-transcribe:
  // transcription runs as its own function before this run exists, so it has no run to
  // attach to. Recording it here also lets the timeline state plainly that the step was
  // skipped for typed input, instead of the step silently having no evidence either way.
  const voice = request.context.voice;
  await persistence.logTrace(runId, conversationId, {
    workflowStep: WORKFLOW_STEP.TRANSCRIBE,
    category: "context",
    eventKey: "voice.transcription.completed",
    status: voice ? "completed" : "skipped",
    summary: voice
      ? `Spoken input transcribed by ${voice.provider ?? "the speech service"}.`
      : "Input was typed; speech transcription not used.",
    details: voice
      ? {
        transcribed: true,
        provider: voice.provider ?? null,
        detected_locale: voice.detectedLocale ?? null,
        audio_duration_ms: voice.audioDurationMs ?? null,
        transcript_character_count: request.message.length,
      }
      : { transcribed: false },
  });
  try {
    const result = await runOpenAITurn({
      client,
      persistence,
      principal,
      config,
      request,
      conversationId,
      history,
      runId,
      onStatus,
    });
    const turn = { ...result.turn, conversationId };
    await persistence.logTrace(runId, conversationId, {
      workflowStep: WORKFLOW_STEP.GROUND_ANSWER,
      category: "response",
      eventKey: "turn.response.generated",
      status: "completed",
      summary: "Final structured assistant response generated.",
      details: {
        locale: turn.locale,
        block_count: turn.blocks.length,
        block_types: turn.blocks.map((block) => block.type),
        source_count: turn.provenance.sources.length,
        provenance_truncated: turn.provenance.truncated === true,
        answer_character_count: turn.answer.text.length,
      },
      durationMs: Date.now() - started,
    });
    const outputMessageId = await persistence.saveAssistantMessage(
      conversationId,
      turn,
      config.model,
    );
    await persistence.logTrace(runId, conversationId, {
      workflowStep: WORKFLOW_STEP.RECORD,
      category: "persistence",
      eventKey: "turn.response.persisted",
      status: outputMessageId ? "completed" : "skipped",
      summary: outputMessageId
        ? "Final assistant message persisted and linked to the run."
        : "Final assistant message persistence was unavailable.",
      details: { output_message_persisted: outputMessageId !== null },
    });
    await persistence.logTrace(runId, conversationId, {
      workflowStep: WORKFLOW_STEP.RECORD,
      category: "response",
      eventKey: "turn.completed",
      status: "completed",
      summary: "Ask Salam turn completed successfully.",
      details: {
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
      },
      durationMs: Date.now() - started,
    });
    await persistence.finishRun(runId, {
      status: "completed",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: Date.now() - started,
      outputMessageId,
      errorCode: null,
      errorMessage: null,
    });
    return { conversationId, turn, runId };
  } catch (error) {
    await persistence.logTrace(runId, conversationId, {
      // Attributed to the step that was in flight, not to this catch block. Hard-coding
      // RECORD here made every failure read as "failed while recording the trace", which
      // is never where the problem is — a turn that dies mid tool-selection was showing
      // step 3 as complete and step 7 as the culprit.
      workflowStep: persistence.currentWorkflowStep ?? WORKFLOW_STEP.RECORD,
      category: "error",
      eventKey: "turn.failed",
      status: "failed",
      summary: "Ask Salam turn failed before a final response was completed.",
      details: {
        error_code: error instanceof AssistantHttpError
          ? error.code
          : "ASSISTANT_FAILED",
        retryable: error instanceof AssistantHttpError ? error.retryable : true,
      },
      durationMs: Date.now() - started,
    });
    await persistence.finishRun(runId, {
      status: "failed",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
      outputMessageId: null,
      errorCode: error instanceof AssistantHttpError
        ? error.code
        : "ASSISTANT_FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    });
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: ASSISTANT_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only POST is supported.",
          retryable: false,
        },
      },
      405,
    );
  }

  try {
    const config = loadAssistantConfig();
    bearerToken(req);
    const body = await req.json();
    const request = parseAssistantTurnRequest(
      body,
      req.headers.get("accept") ?? "",
    );

    const callerClient = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );
    const serverClient = config.supabaseServiceRoleKey
      ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
      : null;

    const principal = await authenticatePrincipal(callerClient);
    const persistence = new AssistantPersistence(
      callerClient,
      serverClient,
      principal,
    );

    const run = (
      onStatus?: (messageKey: string) => void,
    ): Promise<SseTurnResult> =>
      request.action
        ? runConfirmedAction({
          client: callerClient,
          persistence,
          principal,
          config,
          request,
          onStatus,
        })
        : runChatTurn({
          client: callerClient,
          persistence,
          principal,
          config,
          request,
          onStatus,
        });

    if (request.stream) {
      return sseTurnResponse((emitStatus) => run(emitStatus));
    }
    return jsonResponse(await run());
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonResponse(
        {
          error: {
            code: error.code,
            message: error.message,
            retryable: false,
          },
        },
        400,
      );
    }
    const { status, body } = toPublicError(error);
    return jsonResponse(body, status);
  }
});
