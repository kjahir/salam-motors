import { sha256Hex } from "./action-token.ts";
import { AssistantHttpError } from "./http.ts";
import type {
  AssistantPrincipal,
  AssistantRisk,
  AssistantTurn,
  ConversationHistoryItem,
  StoredActionProposal,
  SupabaseClientLike,
  SupabaseErrorLike,
  ToolResult,
} from "./types.ts";

function isOptionalSchemaError(error: SupabaseErrorLike | null): boolean {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return ["PGRST204", "PGRST205", "42P01", "42703"].includes(code) ||
    /does not exist|schema cache|could not find/i.test(message);
}

function messageText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (
    typeof content === "object" && content !== null &&
    typeof (content as { text?: unknown }).text === "string"
  ) {
    return (content as { text: string }).text;
  }
  return null;
}

/*
Per-tool allow-list of raw argument fields that are safe to keep in
`assistant_tool_calls.arguments_redacted` in the clear (alongside the
existing argument_hash). These are all filter/id/flag values, never free
text a user typed (search query text, notes, addresses, etc.) - so this
list intentionally excludes fields like `search_inventory.query` or the
free-text fields inside the two proposal tools' vehicle/purchase/sale
objects.
*/
const ARGUMENT_ALLOW_LIST: Readonly<Record<string, readonly string[]>> = {
  search_inventory: ["status", "category", "min_price", "max_price", "include_sold"],
  get_vehicle_360: ["vehicle_id"],
  get_dashboard_ageing: ["include_sold", "ageing_threshold_days"],
  get_alerts_compliance: ["vehicle_id", "status", "severity", "alert_type"],
  get_partner_portfolio: ["partner_id", "include_settled"],
  acknowledge_alert: ["alert_id"],
  propose_complete_vehicle_sale: ["vehicle_id"],
};

function redactedArguments(
  toolName: string,
  argumentsValue: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = ARGUMENT_ALLOW_LIST[toolName] ?? [];
  const safeFields: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(argumentsValue, key)) {
      safeFields[key] = argumentsValue[key];
    }
  }
  return safeFields;
}

export class AssistantPersistence {
  readonly callerClient: SupabaseClientLike;
  readonly serverClient: SupabaseClientLike | null;
  readonly principal: AssistantPrincipal;
  #conversationAvailable: boolean | undefined;

  constructor(
    callerClient: SupabaseClientLike,
    serverClient: SupabaseClientLike | null,
    principal: AssistantPrincipal,
  ) {
    this.callerClient = callerClient;
    this.serverClient = serverClient;
    this.principal = principal;
  }

  get persisted(): boolean {
    return this.#conversationAvailable === true &&
      this.serverClient !== null;
  }

  async ensureConversation(
    requestedId: string | undefined,
    locale: string,
    titleSeed: string,
  ): Promise<string> {
    if (requestedId) {
      const { data, error } = await this.callerClient
        .from("assistant_conversations")
        .select("id")
        .eq("id", requestedId)
        .eq("org_id", this.principal.orgId)
        .eq("created_by_user_id", this.principal.userId)
        .eq("status", "active")
        .maybeSingle();
      if (error && isOptionalSchemaError(error)) {
        this.#conversationAvailable = false;
        return requestedId;
      }
      if (error || !data?.id) {
        throw new AssistantHttpError(
          404,
          "CONVERSATION_NOT_FOUND",
          "That assistant conversation is not available.",
        );
      }
      this.#conversationAvailable = true;
      return data.id as string;
    }

    const id = crypto.randomUUID();
    const { error } = await this.callerClient
      .from("assistant_conversations")
      .insert({
        id,
        org_id: this.principal.orgId,
        created_by_user_id: this.principal.userId,
        partner_id: this.principal.partnerId,
        title: titleSeed.trim().slice(0, 120) || "New conversation",
        locale,
        status: "active",
        metadata: {},
        last_message_at: new Date().toISOString(),
      });
    if (error && isOptionalSchemaError(error)) {
      this.#conversationAvailable = false;
      return id;
    }
    if (error) {
      throw new AssistantHttpError(
        500,
        "CONVERSATION_CREATE_FAILED",
        "The assistant conversation could not be created.",
        true,
      );
    }
    this.#conversationAvailable = true;
    return id;
  }

  async loadHistory(
    conversationId: string,
    limit = 12,
  ): Promise<ConversationHistoryItem[]> {
    if (this.#conversationAvailable !== true) return [];
    const { data, error } = await this.callerClient
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("org_id", this.principal.orgId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (Array.isArray(data) ? data : []).reverse().flatMap(
      (row: { role?: unknown; content?: unknown }) => {
        const text = messageText(row.content);
        return text && (row.role === "user" || row.role === "assistant")
          ? [{ role: row.role, content: text.slice(0, 4_000) }]
          : [];
      },
    );
  }

  async saveUserMessage(
    conversationId: string,
    text: string,
    locale: string,
    metadata: Record<string, unknown>,
  ): Promise<string | null> {
    if (this.#conversationAvailable !== true) return null;
    const id = crypto.randomUUID();
    const { error } = await this.callerClient
      .from("assistant_messages")
      .insert({
        id,
        org_id: this.principal.orgId,
        conversation_id: conversationId,
        role: "user",
        content: { text, ...metadata },
        language: locale,
        created_by_user_id: this.principal.userId,
        safety_labels: {},
      });
    if (error) return null;
    await this.touchConversation(conversationId);
    return id;
  }

  async saveAssistantMessage(
    conversationId: string,
    turn: AssistantTurn,
    model: string,
  ): Promise<string | null> {
    if (this.#conversationAvailable !== true || !this.serverClient) return null;
    const id = crypto.randomUUID();
    const { error } = await this.serverClient
      .from("assistant_messages")
      .insert({
        id,
        org_id: this.principal.orgId,
        conversation_id: conversationId,
        role: "assistant",
        // Do not persist confirmation tokens or raw dynamic blocks.
        content: {
          text: turn.answer.text,
          tone: turn.answer.tone ?? "neutral",
          schema_version: turn.schemaVersion,
          block_types: turn.blocks.map((block) => block.type),
          source_count: turn.provenance.sources.length,
        },
        language: turn.locale,
        created_by_user_id: this.principal.userId,
        model,
        safety_labels: {},
      });
    if (error) return null;
    await this.touchConversation(conversationId);
    return id;
  }

  async startRun(
    conversationId: string,
    model: string,
    inputMessageId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<string | null> {
    if (this.#conversationAvailable !== true || !this.serverClient) return null;
    const id = crypto.randomUUID();
    const { error } = await this.serverClient.from("assistant_runs").insert({
      id,
      org_id: this.principal.orgId,
      conversation_id: conversationId,
      requested_by_user_id: this.principal.userId,
      input_message_id: inputMessageId,
      output_message_id: null,
      status: "running",
      model,
      trace_id: crypto.randomUUID(),
      idempotency_key: null,
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      usage: {},
      metadata,
    });
    return error ? null : id;
  }

  async finishRun(
    runId: string | null,
    input: {
      status: "completed" | "failed";
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      outputMessageId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    },
  ): Promise<void> {
    if (!runId || !this.serverClient) return;
    await this.serverClient
      .from("assistant_runs")
      .update({
        status: input.status,
        output_message_id: input.outputMessageId,
        completed_at: new Date().toISOString(),
        error_code: input.errorCode,
        error_message: input.errorMessage?.slice(0, 500) ?? null,
        usage: {
          input_tokens: input.inputTokens,
          output_tokens: input.outputTokens,
          latency_ms: input.latencyMs,
        },
      })
      .eq("id", runId)
      .eq("org_id", this.principal.orgId)
      .eq("requested_by_user_id", this.principal.userId);
  }

  async logToolCall(
    runId: string | null,
    conversationId: string,
    toolName: string,
    argumentsValue: Record<string, unknown>,
    result: ToolResult,
    latencyMs: number,
    riskLevel: AssistantRisk = "low",
  ): Promise<void> {
    if (!runId || !this.serverClient) return;
    const argumentHash = await sha256Hex(argumentsValue);
    const id = crypto.randomUUID();
    // Entities are already redaction-safe: each is a {type, id, label}
    // triple built server-side from authorized rows (see tools.ts), never
    // raw tool arguments or full record payloads.
    const entities = (result.entities ?? []).slice(0, 100);
    const { error } = await this.serverClient
      .from("assistant_tool_calls")
      .insert({
        id,
        org_id: this.principal.orgId,
        conversation_id: conversationId,
        run_id: runId,
        requested_by_user_id: this.principal.userId,
        tool_name: toolName,
        status: result.ok ? "completed" : "failed",
        risk_level: riskLevel,
        arguments_redacted: {
          argument_hash: argumentHash,
          safe_fields: redactedArguments(toolName, argumentsValue),
        },
        result_redacted: {
          ok: result.ok,
          error_code: result.error?.code ?? null,
          entity_count: entities.length,
          truncated: result.truncated === true,
          entities,
        },
        authorization_decision: {
          allowed: true,
          principal_kind: this.principal.kind,
          role: this.principal.role,
        },
        idempotency_key: null,
        started_at: new Date(Date.now() - latencyMs).toISOString(),
        completed_at: new Date().toISOString(),
        error_code: result.error?.code ?? null,
        error_message: result.error?.message.slice(0, 300) ?? null,
      });
    if (error) {
      console.warn("assistant tool-call persistence failed", error.code);
    }

    // Best-effort: a complete per-turn security record for every tool
    // call (not just confirmed writes), independent of whether the
    // assistant_tool_calls insert above succeeded.
    const primaryEntity = entities[0];
    const { error: auditError } = await this.serverClient.rpc(
      "assistant_write_security_audit",
      {
        p_org_id: this.principal.orgId,
        p_event_type: "tool_call",
        p_action: toolName,
        p_outcome: result.ok ? "completed" : "failed",
        p_context: {
          actor_user_id: this.principal.userId,
          conversation_id: conversationId,
          run_id: runId,
          tool_call_id: id,
          target_type: primaryEntity?.type ?? null,
          target_id: primaryEntity?.id ?? null,
          decision_reason: result.error?.code ?? null,
          details_redacted: {
            risk_level: riskLevel,
            entity_count: entities.length,
            latency_ms: latencyMs,
          },
        },
      },
    );
    if (auditError) {
      console.warn("assistant tool-call security audit failed", auditError.code);
    }
  }

  async loadActionProposal(
    proposalId: string,
  ): Promise<StoredActionProposal> {
    const { data, error } = await this.callerClient
      .from("assistant_action_proposals")
      .select(
        "id, org_id, conversation_id, requested_by_user_id, action_type, target_type, target_id, arguments, argument_hash, idempotency_key, risk_level, status, expires_at, outcome",
      )
      .eq("id", proposalId)
      .eq("org_id", this.principal.orgId)
      .eq("requested_by_user_id", this.principal.userId)
      .maybeSingle();
    if (error || !data) {
      throw new AssistantHttpError(
        404,
        "ACTION_NOT_FOUND",
        "That proposed action is no longer available.",
      );
    }
    return {
      id: data.id,
      orgId: data.org_id,
      conversationId: data.conversation_id,
      requestedByUserId: data.requested_by_user_id,
      actionType: data.action_type,
      targetType: data.target_type,
      targetId: data.target_id,
      arguments: data.arguments,
      argumentHash: data.argument_hash,
      idempotencyKey: data.idempotency_key,
      riskLevel: data.risk_level,
      status: data.status,
      expiresAt: data.expires_at,
      outcome: data.outcome,
    } as StoredActionProposal;
  }

  private async touchConversation(conversationId: string): Promise<void> {
    await this.callerClient
      .from("assistant_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("org_id", this.principal.orgId)
      .eq("created_by_user_id", this.principal.userId);
  }
}

