import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAppLanguage, languageOptions, type AppLanguage } from "@/i18n";

interface LanguageSwitcherProps {
  variant?: "sidebar" | "mobile";
}

export function LanguageSwitcher({ variant = "sidebar" }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const currentLanguage = getAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  const handleChange = (language: AppLanguage) => {
    i18n.changeLanguage(language);
  };

  if (variant === "mobile") {
    return (
      <label className="flex items-center gap-2 rounded-full border border-mobile-border bg-mobile-card px-3 py-1.5 text-xs font-semibold text-mobile-text">
        <Languages size={14} className="text-mobile-primary" />
        <span className="sr-only">{t("language.label")}</span>
        <select
          value={currentLanguage}
          onChange={(event) => handleChange(event.target.value as AppLanguage)}
          className="bg-transparent outline-none"
          aria-label={t("language.label")}
        >
          {languageOptions.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeName}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300">
      <Languages size={14} className="text-slate-400" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={currentLanguage}
        onChange={(event) => handleChange(event.target.value as AppLanguage)}
        className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none"
        aria-label={t("language.label")}
      >
        {languageOptions.map((language) => (
          <option key={language.code} value={language.code} className="text-slate-900">
            {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
