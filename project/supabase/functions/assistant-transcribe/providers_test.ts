import { transcribeWithGemini, transcribeWithOpenAI } from "./providers.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Gemini transcription sends audio and returns its detected locale", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (_input, init) => {
    requestedUrl = String(_input);
    assert(typeof init?.body === "string", "Gemini request body was not sent");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  text:
                    "\u0bb5\u0bbe\u0b95\u0ba9\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1",
                  locale: "ta-IN",
                }),
              }],
            },
          }],
        }),
        { status: 200 },
      ),
    );
  };

  try {
    const result = await transcribeWithGemini({
      audio: new File([new Uint8Array([1, 2, 3])], "speech.webm", {
        type: "audio/webm",
      }),
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
    });
    assert(
      requestedUrl.endsWith(
        "/models/gemini-3.5-flash-lite:generateContent",
      ),
      "the configured Gemini model was not requested",
    );
    assert(result.locale === "ta-IN", "Gemini locale was not preserved");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("OpenAI fallback derives locale from the transcript script", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          text:
            "\u0917\u093e\u0921\u093c\u093f\u092f\u093e\u0902 \u0926\u093f\u0916\u093e\u0913",
        }),
        { status: 200 },
      ),
    );

  try {
    const result = await transcribeWithOpenAI({
      audio: new File([new Uint8Array([1])], "speech.webm", {
        type: "audio/webm",
      }),
      apiKey: "test-key",
      model: "gpt-4o-mini-transcribe",
      baseUrl: "https://api.openai.com/v1",
    });
    assert(result.locale === "hi-IN", "Hindi locale was not derived");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
