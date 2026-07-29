import { detectSpokenLocale, type SpokenLocale } from "./language.ts";

export interface TranscriptionResult {
  text: string;
  locale: SpokenLocale;
}

export class TranscriptionProviderError extends Error {
  constructor(
    readonly provider: "gemini" | "openai",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TranscriptionProviderError";
  }
}

const TRANSCRIPTION_PROMPT =
  "Transcribe this vehicle dealership conversation exactly as spoken. " +
  "The speaker may use English, Tamil, Hindi, or mix these languages. " +
  "Preserve native scripts, vehicle names, registration numbers, money values, " +
  "and English words. Do not translate or answer. Return the transcript and " +
  "the dominant spoken locale.";

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)),
    );
  }
  return btoa(chunks.join(""));
}

function normalize(
  textValue: unknown,
  localeValue?: unknown,
): TranscriptionResult | null {
  const text = typeof textValue === "string" ? textValue.trim() : "";
  if (!text) return null;
  const locale = localeValue === "ta-IN" || localeValue === "hi-IN" ||
      localeValue === "en-IN"
    ? localeValue
    : detectSpokenLocale(text);
  return { text, locale };
}

export async function transcribeWithGemini(input: {
  audio: File;
  apiKey: string;
  model: string;
  baseUrl?: string;
}): Promise<TranscriptionResult> {
  const baseUrl = (input.baseUrl ??
    "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const bytes = new Uint8Array(await input.audio.arrayBuffer());
  const response = await fetch(
    `${baseUrl}/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: TRANSCRIPTION_PROMPT },
            {
              inlineData: {
                mimeType: input.audio.type || "audio/webm",
                data: encodeBase64(bytes),
              },
            },
          ],
        }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: "minimal" },
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING" },
              locale: {
                type: "STRING",
                enum: ["en-IN", "ta-IN", "hi-IN"],
              },
            },
            required: ["text", "locale"],
          },
        },
      }),
    },
  );
  const payload = await response.json().catch(() => ({})) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
    }>;
  };
  if (!response.ok) {
    throw new TranscriptionProviderError(
      "gemini",
      response.status,
      "Gemini transcription request failed.",
    );
  }
  const raw = payload.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
  let parsed: { text?: unknown; locale?: unknown };
  try {
    parsed = JSON.parse(raw ?? "") as { text?: unknown; locale?: unknown };
  } catch {
    throw new TranscriptionProviderError(
      "gemini",
      502,
      "Gemini returned an invalid transcription.",
    );
  }
  const result = normalize(parsed.text, parsed.locale);
  if (!result) {
    throw new TranscriptionProviderError(
      "gemini",
      422,
      "Gemini did not detect speech.",
    );
  }
  return result;
}

export async function transcribeWithOpenAI(input: {
  audio: File;
  apiKey: string;
  model: string;
  baseUrl: string;
}): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append("file", input.audio, input.audio.name || "ask-salam.webm");
  form.append("model", input.model);
  form.append("response_format", "json");
  form.append("prompt", TRANSCRIPTION_PROMPT);
  const response = await fetch(`${input.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as {
    text?: unknown;
  };
  if (!response.ok) {
    throw new TranscriptionProviderError(
      "openai",
      response.status,
      "OpenAI transcription request failed.",
    );
  }
  const result = normalize(payload.text);
  if (!result) {
    throw new TranscriptionProviderError(
      "openai",
      422,
      "OpenAI did not detect speech.",
    );
  }
  return result;
}
