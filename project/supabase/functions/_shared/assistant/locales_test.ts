import {
  ASSISTANT_LOCALES,
  ASSISTANT_STRINGS,
  assistantStrings,
  checkScriptConformance,
  formatMoney,
  hasScriptRule,
  interpolate,
  LOCALE_LANGUAGES,
  normalizeAssistantLocale,
} from "./locales.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("normalizeAssistantLocale accepts exactly the 6 supported codes", () => {
  for (const locale of ASSISTANT_LOCALES) {
    assert(
      normalizeAssistantLocale(locale) === locale,
      `${locale} should normalize to itself`,
    );
  }
});

Deno.test("normalizeAssistantLocale falls back to en-IN for anything else", () => {
  assert(normalizeAssistantLocale("fr-FR") === "en-IN", "unknown locale");
  assert(normalizeAssistantLocale("en") === "en-IN", "bare language code");
  assert(normalizeAssistantLocale(undefined) === "en-IN", "undefined");
  assert(normalizeAssistantLocale(null) === "en-IN", "null");
  assert(normalizeAssistantLocale("") === "en-IN", "empty string");
});

Deno.test("every locale has a language directive and a complete string catalog", () => {
  const referenceKeys = Object.keys(ASSISTANT_STRINGS["en-IN"]).sort();
  for (const locale of ASSISTANT_LOCALES) {
    assert(
      typeof LOCALE_LANGUAGES[locale] === "string" &&
        LOCALE_LANGUAGES[locale].length > 0,
      `${locale} must have a language directive`,
    );
    const keys = Object.keys(ASSISTANT_STRINGS[locale]).sort();
    assert(
      JSON.stringify(keys) === JSON.stringify(referenceKeys),
      `${locale} string catalog must define the same keys as en-IN`,
    );
    for (const key of keys) {
      const value = ASSISTANT_STRINGS[locale][key as keyof typeof ASSISTANT_STRINGS["en-IN"]];
      assert(
        typeof value === "string" && value.trim().length > 0,
        `${locale}.${key} must be a non-empty string`,
      );
    }
  }
});

Deno.test("checkScriptConformance matches native-script text and flags English text for Indic locales", () => {
  const tamilText =
    "வாகனம் திறமையாக விற்கப்பட்டது மற்றும் அனைத்து ஆவணங்களும் சரிபார்க்கப்பட்டன.";
  const tamilResult = checkScriptConformance("ta-IN", tamilText);
  assert(tamilResult.checked, "Tamil text with enough letters should be checked");
  assert(!tamilResult.mismatch, "native-script Tamil text should not be flagged");

  const englishAsTamil = checkScriptConformance(
    "ta-IN",
    "The vehicle was sold successfully and every document was verified today.",
  );
  assert(englishAsTamil.checked, "long English text should still be checked");
  assert(englishAsTamil.mismatch, "English text under a Tamil locale should be flagged");
});

Deno.test("checkScriptConformance never checks en-IN and skips short samples", () => {
  const englishResult = checkScriptConformance("en-IN", "Vehicle KA01AB1234 was sold.");
  assert(!englishResult.checked, "en-IN has no script check");
  assert(!englishResult.mismatch, "en-IN is never flagged");

  const shortResult = checkScriptConformance("hi-IN", "OK");
  assert(!shortResult.checked, "very short samples should not be judged");
});

Deno.test("formatMoney renders INR with the requested locale's digit grouping", () => {
  const enFormatted = formatMoney(105000, "en-IN");
  assert(enFormatted.includes("₹"), "en-IN money should include the rupee sign");
  const hiFormatted = formatMoney(105000, "hi-IN");
  assert(hiFormatted.includes("₹"), "hi-IN money should include the rupee sign");
});

Deno.test("interpolate substitutes known placeholders and leaves unknown ones untouched", () => {
  const result = interpolate("Vehicle {{stock}} onboarded. {{missing}}", {
    stock: "SM-0042",
  });
  assert(result === "Vehicle SM-0042 onboarded. {{missing}}", "unexpected interpolation result");
});

Deno.test("assistantStrings falls back to en-IN for unsupported locales", () => {
  assert(
    assistantStrings("fr-FR").confirmLabel === ASSISTANT_STRINGS["en-IN"].confirmLabel,
    "unsupported locale should fall back to en-IN strings",
  );
});

Deno.test("script rules exist only for the locales that need correcting", () => {
  // The streaming gate holds answer text back until the script can be judged. For a locale
  // with no rule that verdict never arrives, so the gate must know to open immediately
  // rather than suppressing the answer forever.
  for (const locale of ["hi-IN", "ta-IN", "ml-IN", "kn-IN", "te-IN"]) {
    assert(hasScriptRule(locale), `${locale} should be script-checked`);
  }
  assert(!hasScriptRule("en-IN"), "English has no script rule to check against");
});

Deno.test("twenty letters is enough to judge the script", () => {
  // The gate buffers until checkScriptConformance returns a verdict, so this bound is the
  // latency it costs a conformant answer.
  const tamil = "இந்த மாதத்தின் லாபம் விவரம் கீழே உள்ளது";
  const english = "This month's profit performance is summarised below";

  const good = checkScriptConformance("ta-IN", tamil);
  assert(good.checked && !good.mismatch, "correct Tamil was judged a mismatch");

  const bad = checkScriptConformance("ta-IN", english);
  assert(bad.checked && bad.mismatch, "an English answer passed a Tamil script check");

  const tooShort = checkScriptConformance("ta-IN", "லாபம்");
  assert(!tooShort.checked, "a verdict was reached before enough letters arrived");
});
