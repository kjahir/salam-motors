import { signActionToken } from "./action-token.ts";
import type { AssistantConfig } from "./config.ts";
import { runConfirmedAction } from "./confirmation.ts";
import { AssistantHttpError } from "./http.ts";
import type { AssistantPersistence } from "./persistence.ts";
import type {
  ActionTokenPayload,
  AssistantPrincipal,
  AssistantTurnRequest,
  StoredActionProposal,
} from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SECRET = "test-secret-at-least-32-bytes-long";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "55555555-5555-4555-8555-555555555555";

const principal: AssistantPrincipal = {
  kind: "staff",
  userId: USER_ID,
  orgId: ORG_ID,
  role: "owner",
  partnerId: null,
};

const config = {
  supabaseUrl: "http://localhost",
  supabaseAnonKey: "anon",
  supabaseServiceRoleKey: null,
  openAiApiKey: null,
  openAiBaseUrl: "http://localhost",
  model: "test",
  reasoningEffort: "low",
  maxToolRounds: 5,
  maxToolCalls: 10,
  maxOutputTokens: 3200,
  openAiTimeoutMs: 45000,
  actionTokenSecret: SECRET,
  actionTtlSeconds: 600,
  safetySalt: "test",
  rpc: {
    createProposal: "assistant_create_action_proposal",
    confirmAction: "assistant_confirm_action",
    createVehicle: "assistant_create_vehicle_with_purchase",
    completeSale: "assistant_complete_vehicle_sale",
  },
} as AssistantConfig;

const saleArguments = {
  org_id: ORG_ID,
  vehicle_id: VEHICLE_ID,
  sale: {
    buyer_party_id: "66666666-6666-4666-8666-666666666666",
    sale_price: 500000,
    discount: 0,
    buyer_charges: 5000,
    payment_status: "Paid",
    delivery_status: "Delivered",
    payment_method: "Bank transfer",
    expected_vehicle_updated_at: "2026-07-27T00:00:00.000Z",
    expected_total_vehicle_cost: 400000,
    expected_gross_profit: 105000,
  },
};

function salePayload(): ActionTokenPayload {
  return {
    version: 1,
    proposalId: PROPOSAL_ID,
    conversationId: CONVERSATION_ID,
    orgId: ORG_ID,
    userId: USER_ID,
    actionType: "vehicle.complete_sale",
    argumentHash: "hash-1",
    confirmationToken: "raw-confirmation-token-value",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

function saleProposal(
  overrides: Partial<StoredActionProposal> = {},
): StoredActionProposal {
  return {
    id: PROPOSAL_ID,
    orgId: ORG_ID,
    conversationId: CONVERSATION_ID,
    requestedByUserId: USER_ID,
    actionType: "vehicle.complete_sale",
    targetType: "vehicle",
    targetId: VEHICLE_ID,
    arguments: saleArguments,
    argumentHash: "hash-1",
    idempotencyKey: "idempotency-key-0001",
    riskLevel: "critical",
    status: "proposed",
    expiresAt: "2099-01-01T00:00:00.000Z",
    outcome: null,
    ...overrides,
  };
}

interface StubState {
  rpcCalls: Array<{ name: string; params: Record<string, unknown> }>;
  writes: string[];
  finishRunInputs: Array<Record<string, unknown>>;
}

function stubs(options: {
  proposal?: StoredActionProposal;
  confirmError?: { code: string; message: string };
  executeError?: { code: string; message: string };
  executeResult?: Record<string, unknown>;
}): {
  state: StubState;
  client: { rpc: (name: string, params: Record<string, unknown>) => unknown };
  persistence: AssistantPersistence;
} {
  const state: StubState = { rpcCalls: [], writes: [], finishRunInputs: [] };
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      state.rpcCalls.push({ name, params });
      if (name === config.rpc.confirmAction) {
        return Promise.resolve(
          options.confirmError
            ? { data: null, error: options.confirmError }
            : { data: [{ proposal_status: "confirmed" }], error: null },
        );
      }
      return Promise.resolve(
        options.executeError
          ? { data: null, error: options.executeError }
          : { data: options.executeResult ?? {}, error: null },
      );
    },
  };
  const persistence = {
    ensureConversation(requestedId: string | undefined) {
      state.writes.push("ensureConversation");
      return Promise.resolve(requestedId ?? CONVERSATION_ID);
    },
    saveUserMessage() {
      state.writes.push("saveUserMessage");
      return Promise.resolve("input-message-id");
    },
    startRun() {
      state.writes.push("startRun");
      return Promise.resolve("run-id");
    },
    loadActionProposal() {
      if (!options.proposal) {
        return Promise.reject(
          new AssistantHttpError(404, "ACTION_NOT_FOUND", "missing"),
        );
      }
      return Promise.resolve(options.proposal);
    },
    saveAssistantMessage() {
      state.writes.push("saveAssistantMessage");
      return Promise.resolve("output-message-id");
    },
    finishRun(_runId: string | null, input: Record<string, unknown>) {
      state.finishRunInputs.push(input);
      return Promise.resolve();
    },
  } as unknown as AssistantPersistence;
  return { state, client, persistence };
}

function request(token: string): AssistantTurnRequest {
  return {
    conversationId: CONVERSATION_ID,
    message: "Execute the confirmed action.",
    locale: "en-IN",
    context: { surface: "desktop" },
    stream: true,
    action: { token },
  };
}

async function expectHttpError(
  run: () => Promise<unknown>,
  status: number,
  code: string,
): Promise<AssistantHttpError> {
  try {
    await run();
  } catch (error) {
    assert(
      error instanceof AssistantHttpError,
      `expected AssistantHttpError, got ${error}`,
    );
    assert(
      error.status === status && error.code === code,
      `expected ${status} ${code}, got ${error.status} ${error.code}`,
    );
    return error;
  }
  throw new Error(`expected ${status} ${code} to be thrown`);
}

Deno.test("principal mismatch fails before any persistence write", async () => {
  const token = await signActionToken(
    { ...salePayload(), userId: "99999999-9999-4999-8999-999999999999" },
    SECRET,
  );
  const { state, client, persistence } = stubs({ proposal: saleProposal() });
  await expectHttpError(
    () =>
      runConfirmedAction({
        client,
        persistence,
        principal,
        config,
        request: request(token),
      }),
    403,
    "ACTION_PRINCIPAL_MISMATCH",
  );
  assert(state.writes.length === 0, "no persistence writes should happen");
  assert(state.rpcCalls.length === 0, "no RPC should be called");
});

Deno.test("already-processed proposal is rejected", async () => {
  const token = await signActionToken(salePayload(), SECRET);
  const { state, client, persistence } = stubs({
    proposal: saleProposal({ status: "confirmed" }),
  });
  await expectHttpError(
    () =>
      runConfirmedAction({
        client,
        persistence,
        principal,
        config,
        request: request(token),
      }),
    409,
    "ACTION_ALREADY_PROCESSED",
  );
  assert(state.rpcCalls.length === 0, "no RPC should be called");
  assert(
    state.finishRunInputs[0]?.status === "failed",
    "run should be marked failed",
  );
});

Deno.test("argument hash drift is rejected", async () => {
  const token = await signActionToken(salePayload(), SECRET);
  const { state, client, persistence } = stubs({
    proposal: saleProposal({ argumentHash: "hash-2" }),
  });
  await expectHttpError(
    () =>
      runConfirmedAction({
        client,
        persistence,
        principal,
        config,
        request: request(token),
      }),
    409,
    "ACTION_ARGUMENTS_CHANGED",
  );
  assert(state.rpcCalls.length === 0, "no RPC should be called");
});

Deno.test("confirm RPC permission failure maps to 403", async () => {
  const token = await signActionToken(salePayload(), SECRET);
  const { state, client, persistence } = stubs({
    proposal: saleProposal(),
    confirmError: { code: "42501", message: "Step-up authentication required" },
  });
  const error = await expectHttpError(
    () =>
      runConfirmedAction({
        client,
        persistence,
        principal,
        config,
        request: request(token),
      }),
    403,
    "ACTION_FORBIDDEN",
  );
  assert(
    error.message.includes("Step-up"),
    "database message should surface",
  );
  assert(state.rpcCalls.length === 1, "execution must not run after 42501");
});

Deno.test("sale completion dispatches stored arguments verbatim", async () => {
  const token = await signActionToken(salePayload(), SECRET);
  const { state, client, persistence } = stubs({
    proposal: saleProposal(),
    executeResult: {
      vehicle_id: VEHICLE_ID,
      sale_id: "77777777-7777-4777-8777-777777777777",
      status: "SOLD",
      net_revenue: 505000,
      total_vehicle_cost: 400000,
      gross_profit: 105000,
      distribution_count: 2,
      allocation_total_pct: 100,
      unallocated_profit: 0,
    },
  });
  const result = await runConfirmedAction({
    client,
    persistence,
    principal,
    config,
    request: request(token),
  });

  assert(state.rpcCalls.length === 2, "confirm then execute");
  const execute = state.rpcCalls[1];
  assert(execute.name === config.rpc.completeSale, "wrong execute RPC");
  assert(execute.params.p_org_id === ORG_ID, "org must come from stored args");
  assert(execute.params.p_vehicle_id === VEHICLE_ID, "vehicle id mismatch");
  assert(
    execute.params.p_idempotency_key === "idempotency-key-0001",
    "idempotency key must come from the proposal",
  );
  const sale = execute.params.p_sale as Record<string, unknown>;
  assert(
    sale.expected_total_vehicle_cost === 400000 &&
      sale.expected_vehicle_updated_at === "2026-07-27T00:00:00.000Z",
    "sale guard fields must pass through verbatim",
  );

  assert(result.turn.schemaVersion === "1.0", "turn schema version");
  assert(result.conversationId === CONVERSATION_ID, "conversation binding");
  const block = result.turn.blocks[0];
  assert(block.type === "action_receipt", "receipt block expected");
  assert(block.status === "success", "receipt should be success");
  assert(block.auditId === PROPOSAL_ID, "audit id should be the proposal id");
  assert(
    block.details.some((detail) =>
      typeof detail.value === "string" && detail.value.includes("₹")
    ),
    "receipt should include INR-formatted amounts",
  );
  assert(
    state.finishRunInputs[0]?.status === "completed",
    "run should complete",
  );
  assert(
    state.writes.includes("saveAssistantMessage"),
    "receipt should be persisted",
  );
});

Deno.test("vehicle onboarding dispatches stored arguments verbatim", async () => {
  const createArguments = {
    org_id: ORG_ID,
    vehicle: { registration_number: "KA01AB1234", manufacturer: "Honda" },
    purchase: { agreed_price: 300000 },
    payment: { payment_method: "Cash" },
    listing: null,
  };
  const payload: ActionTokenPayload = {
    ...salePayload(),
    actionType: "vehicle.create_with_purchase",
  };
  const token = await signActionToken(payload, SECRET);
  const { state, client, persistence } = stubs({
    proposal: saleProposal({
      actionType: "vehicle.create_with_purchase",
      targetType: null,
      targetId: null,
      arguments: createArguments,
    }),
    executeResult: {
      vehicle_id: VEHICLE_ID,
      stock_number: "SM-0042",
      purchase_id: "88888888-8888-4888-8888-888888888888",
      purchase_payment_id: "99999999-9999-4999-8999-999999999999",
      listing_id: null,
      status: "PURCHASED",
    },
  });
  const result = await runConfirmedAction({
    client,
    persistence,
    principal,
    config,
    request: request(token),
  });

  const execute = state.rpcCalls[1];
  assert(execute.name === config.rpc.createVehicle, "wrong execute RPC");
  assert(
    JSON.stringify(execute.params.p_vehicle) ===
      JSON.stringify(createArguments.vehicle),
    "vehicle arguments must pass through verbatim",
  );
  assert(execute.params.p_listing === null, "null listing must pass through");

  const block = result.turn.blocks[0];
  assert(block.type === "action_receipt", "receipt block expected");
  assert(block.status === "success", "receipt should be success");
  assert(
    block.details.some((detail) => detail.value === "SM-0042"),
    "receipt should include the stock number",
  );
});
