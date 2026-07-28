import { verifyActionToken } from "./action-token.ts";
import { actionSpecByType, parseCanonicalProposalArguments } from "./actions.ts";
import type { AssistantConfig } from "./config.ts";
import { AssistantHttpError, type SseTurnResult } from "./http.ts";
import type { AssistantPersistence } from "./persistence.ts";
import type {
  ActionTokenPayload,
  AssistantBlock,
  AssistantPrincipal,
  AssistantTurn,
  AssistantTurnRequest,
  StoredActionProposal,
  SupabaseClientLike,
  SupabaseErrorLike,
} from "./types.ts";
import { isRecord } from "./validation.ts";

export interface ConfirmedActionInput {
  client: SupabaseClientLike;
  persistence: AssistantPersistence;
  principal: AssistantPrincipal;
  config: AssistantConfig;
  request: AssistantTurnRequest;
  onStatus?: (messageKey: string) => void;
}

async function verifyToken(
  token: string,
  config: AssistantConfig,
): Promise<ActionTokenPayload> {
  if (!config.actionTokenSecret) {
    throw new AssistantHttpError(
      503,
      "ACTIONS_NOT_CONFIGURED",
      "Assistant actions are not enabled on this deployment.",
    );
  }
  try {
    return await verifyActionToken(token, config.actionTokenSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/expired/i.test(message)) {
      throw new AssistantHttpError(
        410,
        "ACTION_EXPIRED",
        "This confirmation has expired. Ask the assistant to propose the action again.",
      );
    }
    throw new AssistantHttpError(
      401,
      "ACTION_TOKEN_INVALID",
      "This confirmation is no longer valid. Ask the assistant to propose the action again.",
    );
  }
}

function assertBinding(
  payload: ActionTokenPayload,
  principal: AssistantPrincipal,
  request: AssistantTurnRequest,
): void {
  if (payload.orgId !== principal.orgId || payload.userId !== principal.userId) {
    throw new AssistantHttpError(
      403,
      "ACTION_PRINCIPAL_MISMATCH",
      "This confirmation belongs to a different user or organization.",
    );
  }
  if (request.conversationId && request.conversationId !== payload.conversationId) {
    throw new AssistantHttpError(
      409,
      "ACTION_CONVERSATION_MISMATCH",
      "This confirmation belongs to a different conversation.",
    );
  }
}

function assertProposal(
  proposal: StoredActionProposal,
  payload: ActionTokenPayload,
): void {
  if (proposal.actionType !== payload.actionType) {
    throw new AssistantHttpError(
      409,
      "ACTION_MISMATCH",
      "The proposed action no longer matches this confirmation.",
    );
  }
  if (proposal.status !== "proposed") {
    throw new AssistantHttpError(
      409,
      "ACTION_ALREADY_PROCESSED",
      "This action was already confirmed or is no longer pending. Check the vehicle before retrying.",
    );
  }
  if (Date.parse(proposal.expiresAt) <= Date.now()) {
    throw new AssistantHttpError(
      410,
      "ACTION_EXPIRED",
      "This confirmation has expired. Ask the assistant to propose the action again.",
    );
  }
  if (proposal.argumentHash !== payload.argumentHash) {
    throw new AssistantHttpError(
      409,
      "ACTION_ARGUMENTS_CHANGED",
      "The action details changed after this confirmation was issued. Ask the assistant to propose it again.",
    );
  }
}

function rpcError(
  error: SupabaseErrorLike,
  phase: "confirm" | "execute",
): AssistantHttpError {
  const detail = (error.message ?? "").slice(0, 300);
  switch (error.code) {
    case "28000":
      return new AssistantHttpError(
        401,
        "AUTH_REQUIRED",
        detail || "Your session is no longer valid.",
      );
    case "42501":
      return new AssistantHttpError(
        403,
        "ACTION_FORBIDDEN",
        detail || "You are not allowed to perform this action.",
      );
    case "55000":
      return new AssistantHttpError(
        409,
        "ACTION_ALREADY_PROCESSED",
        "This action was already confirmed or is no longer pending. Check the vehicle before retrying.",
      );
    case "57014":
      return new AssistantHttpError(
        410,
        "ACTION_EXPIRED",
        "This confirmation has expired. Ask the assistant to propose the action again.",
      );
    case "22023":
      return phase === "confirm"
        ? new AssistantHttpError(
          409,
          "ACTION_ARGUMENTS_CHANGED",
          detail || "The action details no longer match this confirmation.",
        )
        : new AssistantHttpError(
          400,
          "ACTION_PAYLOAD_INVALID",
          detail || "The stored action details are invalid.",
        );
    case "23505":
      return new AssistantHttpError(
        409,
        "ACTION_DUPLICATE",
        detail || "A matching record already exists.",
      );
    default:
      if (phase === "execute") {
        return new AssistantHttpError(
          422,
          "ACTION_EXECUTION_FAILED",
          detail || "The action could not be completed.",
        );
      }
      console.error("assistant confirmation rpc failed", error.code, detail);
      return new AssistantHttpError(
        500,
        "ACTION_FAILED",
        "The action could not be completed. Verify the record before retrying.",
        true,
      );
  }
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function resultRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function resultString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function resultNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = Number(record[key]);
  return record[key] !== null && record[key] !== undefined &&
      Number.isFinite(value)
    ? value
    : null;
}

interface ReceiptContent {
  title: string;
  answerText: string;
  tone: "success" | "warning";
  status: "success" | "partial";
  details: Array<{ label: string; value: string | number }>;
  vehicleId: string | null;
  sourceLabel: string;
  navigateTab?: string;
}

function createVehicleReceipt(result: Record<string, unknown>): ReceiptContent {
  const stockNumber = resultString(result, "stock_number");
  const vehicleId = resultString(result, "vehicle_id");
  const status = resultString(result, "status");
  const listingId = resultString(result, "listing_id");
  const paymentId = resultString(result, "purchase_payment_id");
  const complete = Boolean(stockNumber && vehicleId && status);
  return {
    title: "Vehicle onboarded",
    answerText: `Vehicle ${stockNumber ?? "—"} was onboarded with its purchase${
      paymentId ? " and payment" : ""
    } recorded${listingId ? " and a draft listing created" : ""}.`,
    tone: "success",
    status: complete ? "success" : "partial",
    details: [
      { label: "Stock number", value: stockNumber ?? "—" },
      { label: "Vehicle status", value: status ?? "—" },
      { label: "Purchase payment", value: paymentId ? "Recorded" : "Not recorded" },
      { label: "Listing", value: listingId ? "Draft created" : "Not created" },
    ],
    vehicleId,
    sourceLabel: stockNumber ?? vehicleId ?? "vehicle",
  };
}

function completeSaleReceipt(result: Record<string, unknown>): ReceiptContent {
  const vehicleId = resultString(result, "vehicle_id");
  const saleId = resultString(result, "sale_id");
  const status = resultString(result, "status");
  const netRevenue = resultNumber(result, "net_revenue");
  const totalCost = resultNumber(result, "total_vehicle_cost");
  const grossProfit = resultNumber(result, "gross_profit");
  const distributionCount = resultNumber(result, "distribution_count");
  const unallocatedProfit = resultNumber(result, "unallocated_profit");
  const complete = Boolean(vehicleId && status && netRevenue !== null);
  const loss = grossProfit !== null && grossProfit < 0;
  const details: Array<{ label: string; value: string | number }> = [
    { label: "Vehicle status", value: status ?? "—" },
    { label: "Net revenue", value: netRevenue === null ? "—" : money(netRevenue) },
    {
      label: "Total vehicle cost",
      value: totalCost === null ? "—" : money(totalCost),
    },
    {
      label: "Gross profit",
      value: grossProfit === null ? "—" : money(grossProfit),
    },
    { label: "Partner distributions", value: distributionCount ?? 0 },
  ];
  if (distributionCount !== null && distributionCount > 0) {
    details.push({
      label: "Unallocated profit",
      value: unallocatedProfit === null ? "—" : money(unallocatedProfit),
    });
  }
  return {
    title: "Sale completed",
    answerText: netRevenue === null || grossProfit === null
      ? "The sale is complete. Review the vehicle for the final figures."
      : `The sale is complete. Net revenue ${money(netRevenue)}, ${
        loss ? "gross loss" : "gross profit"
      } ${money(Math.abs(grossProfit))}.`,
    tone: loss ? "warning" : "success",
    status: complete ? "success" : "partial",
    details,
    vehicleId,
    sourceLabel: saleId ? `Sale ${saleId.slice(0, 8)}` : vehicleId ?? "vehicle",
    navigateTab: "sale",
  };
}

function receiptTurn(
  payload: ActionTokenPayload,
  proposal: StoredActionProposal,
  result: Record<string, unknown>,
  conversationId: string,
  locale: string,
): AssistantTurn {
  const content = payload.actionType === "vehicle.create_with_purchase"
    ? createVehicleReceipt(result)
    : completeSaleReceipt(result);
  const block: AssistantBlock = {
    type: "action_receipt",
    status: content.status,
    title: content.title,
    details: content.details,
    auditId: proposal.id,
    actions: content.vehicleId
      ? [{
        kind: "navigate",
        label: "Open vehicle",
        page: "vehicle",
        params: {
          vehicleId: content.vehicleId,
          ...(content.navigateTab ? { tab: content.navigateTab } : {}),
        },
      }]
      : [],
  };
  return {
    schemaVersion: "1.0",
    turnId: crypto.randomUUID(),
    conversationId,
    locale,
    answer: { text: content.answerText, tone: content.tone },
    blocks: [block],
    provenance: {
      asOf: new Date().toISOString(),
      sources: [{
        entity: "vehicle",
        ...(content.vehicleId ? { id: content.vehicleId } : {}),
        label: content.sourceLabel,
      }],
    },
  };
}

/**
 * Executes a user-confirmed action deterministically. The model is never
 * involved: the signed token, the stored proposal, and the transactional
 * RPCs are the only inputs, and every check fails closed.
 */
export async function runConfirmedAction(
  input: ConfirmedActionInput,
): Promise<SseTurnResult> {
  const { client, persistence, principal, config, request, onStatus } = input;
  const token = request.action?.token;
  if (!token) {
    throw new AssistantHttpError(
      400,
      "ACTION_TOKEN_REQUIRED",
      "No confirmation token was provided.",
    );
  }

  // Token verification and principal binding run before any write so a
  // forged or replayed token cannot create conversations or runs.
  const payload = await verifyToken(token, config);
  assertBinding(payload, principal, request);

  const conversationId = await persistence.ensureConversation(
    payload.conversationId,
    request.locale,
    request.message,
  );
  const inputMessageId = await persistence.saveUserMessage(
    conversationId,
    request.message,
    request.locale,
    { action_proposal_id: payload.proposalId },
  );
  const runId = await persistence.startRun(
    conversationId,
    "confirmation-executor",
    inputMessageId,
    {
      mode: "confirm",
      action_type: payload.actionType,
      proposal_id: payload.proposalId,
    },
  );

  const started = Date.now();
  try {
    onStatus?.("assistant.status.revalidating");
    const proposal = await persistence.loadActionProposal(payload.proposalId);
    assertProposal(proposal, payload);

    const spec = actionSpecByType(payload.actionType);
    if (!spec) {
      throw new AssistantHttpError(
        400,
        "ACTION_UNSUPPORTED",
        "This action type is not supported.",
      );
    }
    if (!spec.roles.includes(principal.role)) {
      throw new AssistantHttpError(
        403,
        "ACTION_ROLE_DENIED",
        "Your role is not allowed to perform this action.",
      );
    }

    // Stored arguments are dispatched verbatim: the command RPC recomputes
    // the argument hash from them, so any re-derivation would break it.
    let parsed: ReturnType<typeof parseCanonicalProposalArguments>;
    try {
      parsed = parseCanonicalProposalArguments(
        payload.actionType,
        proposal.arguments,
      );
    } catch {
      throw new AssistantHttpError(
        409,
        "ACTION_ARGUMENTS_INVALID",
        "The stored action details are no longer valid. Ask the assistant to propose the action again.",
      );
    }

    const { error: confirmError } = await client.rpc(config.rpc.confirmAction, {
      p_proposal_id: payload.proposalId,
      p_confirmation_token: payload.confirmationToken,
      p_expected_argument_hash: payload.argumentHash,
    });
    if (confirmError) throw rpcError(confirmError, "confirm");

    onStatus?.("assistant.status.executing");
    const { data, error } = payload.actionType === "vehicle.create_with_purchase"
      ? await client.rpc(config.rpc.createVehicle, {
        p_org_id: parsed.orgId,
        p_action_proposal_id: proposal.id,
        p_idempotency_key: proposal.idempotencyKey,
        p_vehicle: parsed.vehicle,
        p_purchase: parsed.purchase,
        p_payment: parsed.payment,
        p_listing: parsed.listing,
      })
      : await client.rpc(config.rpc.completeSale, {
        p_org_id: parsed.orgId,
        p_action_proposal_id: proposal.id,
        p_idempotency_key: proposal.idempotencyKey,
        p_vehicle_id: parsed.vehicleId,
        p_sale: parsed.sale,
      });
    if (error) throw rpcError(error, "execute");

    const turn = receiptTurn(
      payload,
      proposal,
      resultRecord(data),
      conversationId,
      request.locale,
    );
    const outputMessageId = await persistence.saveAssistantMessage(
      conversationId,
      turn,
      "confirmation-executor",
    );
    await persistence.finishRun(runId, {
      status: "completed",
      inputTokens: 0,
      outputTokens: 0,
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
      errorCode: error instanceof AssistantHttpError ? error.code : "ACTION_FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    });
    throw error;
  }
}
