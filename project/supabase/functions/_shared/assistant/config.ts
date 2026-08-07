export const REASONING_EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface AssistantConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string | null;
  openAiApiKey: string | null;
  openAiBaseUrl: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  /** Effort for a round with no evidence gathered yet. See the assignment in loadConfig. */
  routingEffort: ReasoningEffort;
  maxToolRounds: number;
  maxToolCalls: number;
  maxOutputTokens: number;
  openAiTimeoutMs: number;
  /**
   * Wall-clock deadline shared across every tool-calling round of a single
   * turn (runOpenAITurn). When the remaining budget is too small to safely
   * afford another round, the next model call is forced to tool_choice:
   * "none" so it produces a graceful final answer instead of the run
   * continuing until maxToolRounds x openAiTimeoutMs.
   */
  maxTurnMs: number;
  actionTokenSecret: string | null;
  actionTtlSeconds: number;
  safetySalt: string;
  rpc: {
    createProposal: string;
    confirmAndCreateVehicle: string;
    confirmAndCompleteSale: string;
  };
}

function env(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(env(name));
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function configuredEffort(
  name = "OPENAI_REASONING_EFFORT",
  fallback: ReasoningEffort = "low",
): ReasoningEffort {
  const value = env(name) ?? fallback;
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? value as ReasoningEffort
    : fallback;
}

export function usableActionTokenSecret(
  value: string | undefined,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (new TextEncoder().encode(normalized).byteLength < 32) {
    return null;
  }
  return normalized;
}

export function loadAssistantConfig(): AssistantConfig {
  const supabaseUrl = env("SUPABASE_URL");
  const supabaseAnonKey = env("SUPABASE_ANON_KEY");
  const configuredActionSecret = env("ASSISTANT_ACTION_TOKEN_SECRET");
  const actionTokenSecret = usableActionTokenSecret(configuredActionSecret);
  if (configuredActionSecret && !actionTokenSecret) {
    console.error(
      "ASSISTANT_ACTION_TOKEN_SECRET must contain at least 32 bytes; assistant writes are disabled",
    );
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for assistant-turn",
    );
  }
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY") ?? null,
    openAiApiKey: env("OPENAI_API_KEY") ?? null,
    openAiBaseUrl: (env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1")
      .replace(/\/+$/, ""),
    model: env("OPENAI_MODEL") ?? "gpt-5.6-terra",
    reasoningEffort: configuredEffort(),
    /*
    Effort for a round that has no evidence yet — round 0, whose usual job is to name a
    tool. Choosing between seven tools does not need the reasoning budget that writing a
    grounded answer does.

    Tunable, and reversible without a deploy, because round 0 is not *always* routing: a
    greeting or a question needing no dealership data is answered there directly, and that
    answer is written at this effort. If direct answers start reading thin, raise
    ASSISTANT_ROUTING_EFFORT before suspecting anything else.
    */
    routingEffort: configuredEffort("ASSISTANT_ROUTING_EFFORT", "none"),
    /*
    Rounds are not the lever they look like. The last round always runs with
    tool_choice:"none", so N rounds buy at most N-1 that can call a tool, and
    planModelRound forces the text-only answer long before the count runs out anyway: on
    the default turn budget, a tool round costing 6s leaves room for exactly two. The old
    default of 5 advertised a depth the wall clock has never permitted, which made it the
    first thing people reached for when a turn ran out of time — and it never helped.

    3 is the honest ceiling: two tool rounds plus the guaranteed final answer. To actually
    buy depth, raise ASSISTANT_MAX_TURN_MS. See openai_test.ts, which pins both properties.
    */
    maxToolRounds: boundedInteger("ASSISTANT_MAX_TOOL_ROUNDS", 3, 1, 8),
    maxToolCalls: boundedInteger("ASSISTANT_MAX_TOOL_CALLS", 10, 1, 16),
    maxOutputTokens: boundedInteger(
      "ASSISTANT_MAX_OUTPUT_TOKENS",
      3_200,
      800,
      8_000,
    ),
    openAiTimeoutMs: boundedInteger(
      "OPENAI_TIMEOUT_MS",
      45_000,
      5_000,
      90_000,
    ),
    maxTurnMs: boundedInteger(
      "ASSISTANT_MAX_TURN_MS",
      30_000,
      10_000,
      60_000,
    ),
    actionTokenSecret,
    actionTtlSeconds: boundedInteger(
      "ASSISTANT_ACTION_TTL_SECONDS",
      600,
      60,
      3_600,
    ),
    safetySalt: env("ASSISTANT_SAFETY_SALT") ??
      "salam-motors-assistant-v1",
    rpc: {
      createProposal: env("ASSISTANT_RPC_CREATE_PROPOSAL") ??
        "assistant_create_action_proposal",
      confirmAndCreateVehicle:
        env("ASSISTANT_RPC_CONFIRM_AND_CREATE_VEHICLE") ??
          "assistant_confirm_and_create_vehicle_with_purchase",
      confirmAndCompleteSale: env("ASSISTANT_RPC_CONFIRM_AND_COMPLETE_SALE") ??
        "assistant_confirm_and_complete_vehicle_sale",
    },
  };
}
