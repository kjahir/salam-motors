// Ask Salam assistant endpoint. One POST route serves two deterministic
// paths: a model-orchestrated chat turn, or — when a signed action token is
// present — the confirmation executor, which never involves the model.
//
// Authorization is never decided here or by the model: the caller-scoped
// client keeps RLS in force, and confirmed writes go through transactional
// RPCs that re-verify ownership, role, argument hash, and idempotency.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticatePrincipal, bearerToken } from "../_shared/assistant/auth.ts";
import {
  loadAssistantConfig,
  type AssistantConfig,
} from "../_shared/assistant/config.ts";
import { runConfirmedAction } from "../_shared/assistant/confirmation.ts";
import {
  ASSISTANT_CORS_HEADERS,
  AssistantHttpError,
  jsonResponse,
  sseTurnResponse,
  toPublicError,
  type SseTurnResult,
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
    const outputMessageId = await persistence.saveAssistantMessage(
      conversationId,
      turn,
      config.model,
    );
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

    const callerClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
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
