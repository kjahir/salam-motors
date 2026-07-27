import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/common.json";
import hi from "./locales/hi/common.json";
import ta from "./locales/ta/common.json";
import ml from "./locales/ml/common.json";
import kn from "./locales/kn/common.json";
import te from "./locales/te/common.json";

export type AppLanguage = "en" | "hi" | "ta" | "ml" | "kn" | "te";
export type AppLocale = "en-IN" | "hi-IN" | "ta-IN" | "ml-IN" | "kn-IN" | "te-IN";

export const defaultLanguage: AppLanguage = "en";

export const languageOptions: { code: AppLanguage; locale: AppLocale; nativeName: string; translationKey: string }[] = [
  { code: "en", locale: "en-IN", nativeName: "English", translationKey: "language.english" },
  { code: "hi", locale: "hi-IN", nativeName: "हिन्दी", translationKey: "language.hindi" },
  { code: "ta", locale: "ta-IN", nativeName: "தமிழ்", translationKey: "language.tamil" },
  { code: "ml", locale: "ml-IN", nativeName: "മലയാളം", translationKey: "language.malayalam" },
  { code: "kn", locale: "kn-IN", nativeName: "ಕನ್ನಡ", translationKey: "language.kannada" },
  { code: "te", locale: "te-IN", nativeName: "తెలుగు", translationKey: "language.telugu" }
];

const resources = {
  en: { common: en },
  hi: { common: hi },
  ta: { common: ta },
  ml: { common: ml },
  kn: { common: kn },
  te: { common: te }
} satisfies Record<AppLanguage, { common: typeof en }>;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: languageOptions.map((language) => language.code),
    ns: ["common"],
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "salam-motors-language",
      caches: ["localStorage"]
    },
    interpolation: {
      escapeValue: false
    },
    returnEmptyString: false
  });

export function getAppLanguage(language = i18n.resolvedLanguage ?? i18n.language): AppLanguage {
  const normalized = language.split("-")[0] as AppLanguage;
  return languageOptions.some((option) => option.code === normalized) ? normalized : defaultLanguage;
}

export function getAppLocale(language = i18n.resolvedLanguage ?? i18n.language): AppLocale {
  return languageOptions.find((option) => option.code === getAppLanguage(language))?.locale ?? "en-IN";
}

export default i18n;