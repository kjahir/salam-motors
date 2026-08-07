import { detectSpokenLocale } from "./language.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, received ${actual}`);
  }
}

Deno.test("detects Tamil, Hindi, and English speech transcripts", () => {
  assertEquals(
    detectSpokenLocale(
      "\u0bb5\u0bbe\u0b95\u0ba9\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1",
    ),
    "ta-IN",
  );
  assertEquals(
    detectSpokenLocale(
      "\u0917\u093e\u0921\u093c\u093f\u092f\u093e\u0902 \u0926\u093f\u0916\u093e\u0913",
    ),
    "hi-IN",
  );
  assertEquals(detectSpokenLocale("Show available vehicles"), "en-IN");
});

Deno.test("uses the dominant supported script for mixed transcripts", () => {
  assertEquals(
    detectSpokenLocale(
      "Honda \u0b95\u0bbe\u0bb0\u0bcd \u0bb5\u0bbe\u0b95\u0ba9\u0bae\u0bcd",
    ),
    "ta-IN",
  );
  assertEquals(
    detectSpokenLocale(
      "Honda \u0915\u093e\u0930 \u0926\u093f\u0916\u093e\u0913",
    ),
    "hi-IN",
  );
});
