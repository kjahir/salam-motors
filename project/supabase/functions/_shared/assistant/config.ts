
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
    confirmAction: string;
    createVehicle: string;
    completeSale: string;
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

function configuredEffort(): ReasoningEffort {
  const value = env("OPENAI_REASONING_EFFORT") ?? "low";
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? value as ReasoningEffort
    : "low";
}

export function loadAssistantConfig(): AssistantConfig {
  const supabaseUrl = env("SUPABASE_URL");
  const supabaseAnonKey = env("SUPABASE_ANON_KEY");
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
    maxToolRounds: boundedInteger("ASSISTANT_MAX_TOOL_ROUNDS", 5, 1, 8),
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
    actionTokenSecret: env("ASSISTANT_ACTION_TOKEN_SECRET") ?? null,
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
      confirmAction: env("ASSISTANT_RPC_CONFIRM_ACTION") ??
        "assistant_confirm_action",
      createVehicle: env("ASSISTANT_RPC_CREATE_VEHICLE") ??
        "assistant_create_vehicle_with_purchase",
      completeSale: env("ASSISTANT_RPC_COMPLETE_SALE") ??
        "assistant_complete_vehicle_sale",
    },
  };
}

