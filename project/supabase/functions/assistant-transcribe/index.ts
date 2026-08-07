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
import {
  transcribeWithGemini,
  transcribeWithOpenAI,
  TranscriptionProviderError,
} from "./providers.ts";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")?.trim() ?? "";
    if (!geminiApiKey && !config.openAiApiKey) {
      throw new AssistantHttpError(
        503,
        "TRANSCRIPTION_UNAVAILABLE",
        "Voice transcription is not configured.",
      );
    }
    const token = bearerToken(req);
    const callerClient = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
    await authenticatePrincipal(callerClient);

    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      throw new AssistantHttpError(
        400,
        "AUDIO_REQUIRED",
        "An audio recording is required.",
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      throw new AssistantHttpError(
        413,
        "AUDIO_TOO_LARGE",
        "The recording is too large.",
      );
    }
    if (!audio.type.startsWith("audio/") && audio.type !== "video/webm") {
      throw new AssistantHttpError(
        415,
        "AUDIO_TYPE_UNSUPPORTED",
        "The recording format is not supported.",
      );
    }

    // Reported back so the turn that follows can record which service actually did the
    // transcription in its step-2 trace entry — the fallback below means it is not
    // predictable from configuration alone.
    let provider = geminiApiKey ? "gemini" : "openai";
    let result;
    try {
      result = geminiApiKey
        ? await transcribeWithGemini({
          audio,
          apiKey: geminiApiKey,
          model: Deno.env.get("GEMINI_TRANSCRIPTION_MODEL") ??
            "gemini-3.5-flash-lite",
          baseUrl: Deno.env.get("GEMINI_BASE_URL"),
        })
        : await transcribeWithOpenAI({
          audio,
          apiKey: config.openAiApiKey!,
          model: Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") ??
            "gpt-4o-mini-transcribe",
          baseUrl: config.openAiBaseUrl,
        });
    } catch (error) {
      if (
        geminiApiKey && config.openAiApiKey &&
        error instanceof TranscriptionProviderError
      ) {
        console.warn("Gemini transcription failed; using OpenAI fallback", {
          status: error.status,
        });
        provider = "openai";
        result = await transcribeWithOpenAI({
          audio,
          apiKey: config.openAiApiKey,
          model: Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") ??
            "gpt-4o-mini-transcribe",
          baseUrl: config.openAiBaseUrl,
        });
      } else {
        throw error;
      }
    }
    return jsonResponse({ ...result, provider });
  } catch (error) {
    if (error instanceof TranscriptionProviderError) {
      console.error("assistant transcription failed", {
        provider: error.provider,
        status: error.status,
      });
      const busy = error.status === 429;
      const empty = error.status === 422;
      const publicError = new AssistantHttpError(
        empty ? 422 : busy ? 429 : 502,
        empty
          ? "TRANSCRIPTION_EMPTY"
          : busy
          ? "TRANSCRIPTION_BUSY"
          : "TRANSCRIPTION_FAILED",
        empty
          ? "No speech was detected."
          : busy
          ? "Voice transcription is busy. Please try again shortly."
          : "Voice input could not be transcribed.",
        busy || error.status >= 500,
      );
      const response = toPublicError(publicError);
      return jsonResponse(response.body, response.status);
    }
    const publicError = toPublicError(error);
    return jsonResponse(publicError.body, publicError.status);
  }
});
