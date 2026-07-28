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

    const upstreamForm = new FormData();
    upstreamForm.append("file", audio, audio.name || "ask-salam.webm");
    upstreamForm.append(
      "model",
      Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") ?? "gpt-4o-mini-transcribe",
    );
    upstreamForm.append("response_format", "json");
    upstreamForm.append(
      "prompt",
      "Vehicle dealership conversation. The speaker may use English, Tamil, Hindi, or mix these languages. Transcribe exactly in the spoken language and native script.",
    );

    const response = await fetch(
      `${config.openAiBaseUrl}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.openAiApiKey}` },
        body: upstreamForm,
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      text?: unknown;
    };
    if (!response.ok) {
      console.error("assistant transcription failed", response.status);
      throw new AssistantHttpError(
        response.status === 429 ? 429 : 502,
        response.status === 429 ? "TRANSCRIPTION_BUSY" : "TRANSCRIPTION_FAILED",
        response.status === 429
          ? "Voice transcription is busy. Please try again shortly."
          : "Voice input could not be transcribed.",
        response.status >= 500 || response.status === 429,
      );
    }
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) {
      throw new AssistantHttpError(
        422,
        "TRANSCRIPTION_EMPTY",
        "No speech was detected.",
      );
    }
    return jsonResponse({ text });
  } catch (error) {
    const publicError = toPublicError(error);
    return jsonResponse(publicError.body, publicError.status);
  }
});
