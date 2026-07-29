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
      category: "persistence",
      eventKey: "turn.response.persisted",
      status: outputMessageId ? "completed" : "skipped",
      summary: outputMessageId
        ? "Final assistant message persisted and linked to the run."
        : "Final assistant message persistence was unavailable.",
      details: { output_message_persisted: outputMessageId !== null },
    });
    await persistence.logTrace(runId, conversationId, {
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
    return { conversationId, turn };
  } catch (error) {
    await persistence.logTrace(runId, conversationId, {
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
