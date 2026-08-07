/**
 * Pieces needed to turn OpenAI's Responses stream into user-visible words while the model
 * is still writing.
 *
 * Before this existed, `sseTurnResponse` awaited the entire turn and then chopped the
 * finished string into chunks — the `delta` events were cosmetic, and time-to-first-word
 * equalled total turn time (~16s). The client (`src/assistant/api.ts`) already consumed a
 * real event stream; only the server was pretending.
 */

/** One `data:` payload from an SSE stream, already JSON-parsed. */
export type SseData = Record<string, unknown>;

/**
 * Yields parsed `data:` payloads from an SSE body.
 *
 * Dispatch is on the payload's own `type` field rather than the `event:` line: both are
 * sent by the Responses API, but only `type` is guaranteed to survive a proxy that
 * normalizes event names.
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseData> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line. A frame split across reads stays in the
      // buffer until its terminator arrives.
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const payload = frameData(frame);
        if (payload !== null) yield payload;
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function frameData(frame: string): SseData | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return null;
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null
      ? parsed as SseData
      : null;
  } catch {
    return null;
  }
}

const UNESCAPE: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/**
 * Pulls `answer.text` out of a structured-output JSON document as it arrives, character by
 * character.
 *
 * This is deliberately not a streaming JSON parser. We need exactly one field, it is known
 * to arrive early — `answer` is the 5th property in MODEL_TURN_SCHEMA and strict structured
 * outputs generate properties in schema order — and everything after it is handled by the
 * ordinary full parse once the response completes. A scanner that finds one string and
 * decodes it is enough, and is far easier to reason about than a general parser.
 *
 * Chunk boundaries can fall anywhere, including inside a `\uXXXX` escape, so decoding stops
 * at any incomplete escape and resumes when the rest arrives.
 */
export class AnswerTextScanner {
  #raw = "";
  #cursor: number | null = null;
  #done = false;

  /** True once the closing quote of answer.text has been consumed. */
  get done(): boolean {
    return this.#done;
  }

  /** True once the field has been located; useful to distinguish "no answer in this round". */
  get started(): boolean {
    return this.#cursor !== null;
  }

  /**
   * Feeds a chunk of the JSON document and returns whatever new answer text became
   * decodable. Returns "" when the chunk contained nothing renderable yet.
   */
  feed(chunk: string): string {
    if (this.#done) return "";
    this.#raw += chunk;
    if (this.#cursor === null) {
      const start = locateAnswerText(this.#raw);
      if (start === null) return "";
      this.#cursor = start;
    }

    let out = "";
    while (this.#cursor < this.#raw.length) {
      const char = this.#raw[this.#cursor];
      if (char === '"') {
        this.#done = true;
        this.#cursor += 1;
        break;
      }
      if (char !== "\\") {
        out += char;
        this.#cursor += 1;
        continue;
      }
      const next = this.#raw[this.#cursor + 1];
      // Incomplete escape at the edge of the buffer: stop and wait for the rest.
      if (next === undefined) break;
      if (next === "u") {
        if (this.#cursor + 6 > this.#raw.length) break;
        const code = Number.parseInt(
          this.#raw.slice(this.#cursor + 2, this.#cursor + 6),
          16,
        );
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        this.#cursor += 6;
        continue;
      }
      out += UNESCAPE[next] ?? next;
      this.#cursor += 2;
    }
    return out;
  }
}

/**
 * Index of the first character inside the answer.text string literal, or null while the
 * document has not reached it yet.
 */
function locateAnswerText(raw: string): number | null {
  const answerAt = raw.indexOf('"answer"');
  if (answerAt < 0) return null;
  const textAt = raw.indexOf('"text"', answerAt);
  if (textAt < 0) return null;
  const colon = raw.indexOf(":", textAt + '"text"'.length);
  if (colon < 0) return null;
  const quote = raw.indexOf('"', colon + 1);
  return quote < 0 ? null : quote + 1;
}
