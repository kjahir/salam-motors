import { describe, expect, it } from "vitest";
import en from "./locales/en/common.json";
import hi from "./locales/hi/common.json";
import kn from "./locales/kn/common.json";
import ml from "./locales/ml/common.json";
import ta from "./locales/ta/common.json";
import te from "./locales/te/common.json";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

// Unlike leafPaths (which treats arrays as opaque leaves, for the shape check above),
// this recurses into arrays element-by-element so every individual string value — e.g.
// each item in assistant.starters.*.prompts — gets its own path and can be checked for
// translation completeness / interpolation placeholders below.
function flattenStrings(value: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === "string") {
    out[prefix] = value;
  } else if (Array.isArray(value)) {
    value.forEach((child, i) => Object.assign(out, flattenStrings(child, `${prefix}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      Object.assign(out, flattenStrings(child, prefix ? `${prefix}.${key}` : key));
    }
  }
  return out;
}

function placeholdersIn(value: string): Set<string> {
  return new Set(Array.from(value.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]));
}

const ALL_LOCALES: { name: string; code: string; data: unknown }[] = [
  { name: "Hindi", code: "hi", data: hi },
  { name: "Kannada", code: "kn", data: kn },
  { name: "Malayalam", code: "ml", data: ml },
  { name: "Tamil", code: "ta", data: ta },
  { name: "Telugu", code: "te", data: te },
];

// hi/ta are held to a "must actually be translated" bar. kn/ml/te are known-incomplete
// stubs (a separate, larger follow-up translation pass) and are intentionally excluded
// here so this check doesn't fail on their known state — they still get the shape check
// above and the interpolation-placeholder check below.
const LOCALES_REQUIRING_TRANSLATION = new Set(["hi", "ta"]);

// Keys intentionally left in English across every locale (product name, an abbreviation
// commonly kept in Latin script, etc).
const ALLOWED_ENGLISH_KEYS = new Set(["app.brand", "status.UPI", "auditPage.sources.assistant"]);

describe("localization resources", () => {
  it.each(ALL_LOCALES.map(({ name, data }) => [name, data] as const))(
    "%s has the same translation key shape as English",
    (_name, locale) => {
      expect(leafPaths(locale).sort()).toEqual(leafPaths(en).sort());
    },
  );

  const enFlat = flattenStrings(en);

  it.each(ALL_LOCALES.filter((l) => LOCALES_REQUIRING_TRANSLATION.has(l.code)).map(({ name, data }) => [name, data] as const))(
    "%s has no leaf value left untranslated (byte-identical to English)",
    (_name, locale) => {
      const localeFlat = flattenStrings(locale);
      const untranslated = Object.keys(enFlat).filter(
        (path) => !ALLOWED_ENGLISH_KEYS.has(path) && localeFlat[path] === enFlat[path],
      );
      expect(untranslated).toEqual([]);
    },
  );

  it.each(ALL_LOCALES.map(({ name, data }) => [name, data] as const))(
    "%s preserves every {{variable}} interpolation placeholder from English",
    (_name, locale) => {
      const localeFlat = flattenStrings(locale);
      const mismatches: string[] = [];
      for (const path of Object.keys(enFlat)) {
        const localeValue = localeFlat[path];
        if (localeValue === undefined) continue; // shape mismatches are caught separately
        const enPh = placeholdersIn(enFlat[path]);
        const localePh = placeholdersIn(localeValue);
        const missing = [...enPh].filter((p) => !localePh.has(p));
        const extra = [...localePh].filter((p) => !enPh.has(p));
        if (missing.length > 0 || extra.length > 0) {
          mismatches.push(`${path}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
        }
      }
      expect(mismatches).toEqual([]);
    },
  );
});
