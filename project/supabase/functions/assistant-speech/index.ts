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
    await authenticatePrincipal(callerClient);

    const body = await req.json() as { text?: unknown; locale?: unknown };
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
