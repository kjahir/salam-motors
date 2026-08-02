import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticatePrincipal,
  bearerToken,
} from "../_shared/assistant/auth.ts";
import { loadAssistantConfig } from "../_shared/assistant/config.ts";
import {
  ASSISTANT_CORS_HEADERS,
  AssistantHttpError,
  jsonResponse,
  toPublicError,
} from "../_shared/assistant/http.ts";
import { AssistantPersistence } from "../_shared/assistant/persistence.ts";
import { WORKFLOW_STEP } from "../_shared/assistant/workflow.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

const MAX_SPEECH_CHARACTERS = 4_096;
const SPOKEN_LOCALES = ["en-IN", "ta-IN", "hi-IN"] as const;
type SpokenLocale = (typeof SPOKEN_LOCALES)[number];

function languageInstructions(locale: SpokenLocale): string {
  if (locale === "ta-IN") {
    return "Speak naturally and clearly in Tamil, with a warm professional Indian vehicle-dealership assistant tone. Pronounce vehicle names, registration numbers, and amounts carefully.";
  }
  if (locale === "hi-IN") {
    return "Speak naturally and clearly in Hindi, with a warm professional Indian vehicle-dealership assistant tone. Pronounce vehicle names, registration numbers, and amounts carefully.";
  }
  return "Speak naturally and clearly in Indian English, with a warm professional vehicle-dealership assistant tone. Pronounce vehicle names, registration numbers, and amounts carefully.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: ASSISTANT_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST is supported.",
        retryable: false,
      },
    }, 405);
  }

  try {
    const config = loadAssistantConfig();
    if (!config.openAiApiKey) {
      throw new AssistantHttpError(
        503,
        "SPEECH_UNAVAILABLE",
        "Voice responses are not configured.",
      );
    }
    const token = bearerToken(req);
    const callerClient = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const principal = await authenticatePrincipal(callerClient);

    const body = await req.json() as {
      text?: unknown;
      locale?: unknown;
      conversationId?: unknown;
      runId?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const locale = SPOKEN_LOCALES.includes(body.locale as SpokenLocale)
      ? body.locale as SpokenLocale
      : null;
    if (!text) {
      throw new AssistantHttpError(
        400,
        "SPEECH_TEXT_REQUIRED",
        "Speech text is required.",
      );
    }
    if (text.length > MAX_SPEECH_CHARACTERS) {
      throw new AssistantHttpError(
        413,
        "SPEECH_TEXT_TOO_LONG",
        "The response is too long to read aloud.",
      );
    }
    if (!locale) {
      throw new AssistantHttpError(
        400,
        "SPEECH_LOCALE_UNSUPPORTED",
        "The spoken language is not supported.",
      );
    }

    // Step 8 of the workflow. Synthesis happens after the turn has already returned, so
    // this function is a separate call and the client hands back the run it belongs to;
    // without both ids there is no run to attach to and the trace is simply skipped
    // rather than invented. Best-effort throughout: a trace failure must never cost the
    // user their spoken answer.
    const conversationId = uuidOrNull(body.conversationId);
    const runId = uuidOrNull(body.runId);
    const serverClient = config.supabaseServiceRoleKey
      ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
      : null;
    const trace = conversationId && runId && serverClient
      ? new AssistantPersistence(callerClient, serverClient, principal)
      : null;
    const startedAt = Date.now();

    const response = await fetch(`${config.openAiBaseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts",
        voice: Deno.env.get("OPENAI_TTS_VOICE") ?? "marin",
        input: text,
        instructions: languageInstructions(locale),
        response_format: "pcm",
      }),
    });
    if (!response.ok) {
      console.error("assistant speech generation failed", response.status);
      await trace?.logTrace(runId, conversationId!, {
        workflowStep: WORKFLOW_STEP.SYNTHESIZE_SPEECH,
        category: "error",
        eventKey: "voice.speech.synthesized",
        status: "failed",
        summary: "The assistant answer could not be read aloud.",
        details: {
          provider_status: response.status,
          locale,
          character_count: text.length,
        },
        durationMs: Date.now() - startedAt,
      }).catch(() => {});
      throw new AssistantHttpError(
        response.status === 429 ? 429 : 502,
        response.status === 429 ? "SPEECH_BUSY" : "SPEECH_FAILED",
        response.status === 429
          ? "Voice responses are busy. Please try again shortly."
          : "The assistant response could not be spoken.",
        response.status === 429 || response.status >= 500,
      );
    }
    if (!response.body) {
      throw new AssistantHttpError(
        502,
        "SPEECH_EMPTY",
        "The speech service returned no audio.",
        true,
      );
    }
    await trace?.logTrace(runId, conversationId!, {
      workflowStep: WORKFLOW_STEP.SYNTHESIZE_SPEECH,
      category: "response",
      eventKey: "voice.speech.synthesized",
      status: "completed",
      summary: `Assistant answer synthesized as ${locale} speech.`,
      details: {
        locale,
        character_count: text.length,
        model: Deno.env.get("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts",
        // Time to first byte: the response body is a stream that has not finished yet.
        time_to_first_byte_ms: Date.now() - startedAt,
      },
      durationMs: Date.now() - startedAt,
    }).catch(() => {});

    return new Response(response.body, {
      status: 200,
      headers: {
        ...ASSISTANT_CORS_HEADERS,
        "Content-Type": "audio/pcm",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const publicError = toPublicError(error);
    return jsonResponse(publicError.body, publicError.status);
  }
});
