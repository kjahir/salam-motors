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

describe("localization resources", () => {
  it.each([
    ["Hindi", hi],
    ["Kannada", kn],
    ["Malayalam", ml],
    ["Tamil", ta],
    ["Telugu", te],
  ])("%s has the same translation key shape as English", (_name, locale) => {
    expect(leafPaths(locale).sort()).toEqual(leafPaths(en).sort());
  });
});
