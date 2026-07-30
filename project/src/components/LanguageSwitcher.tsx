import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppLanguage, languageOptions, type AppLanguage } from "@/i18n";
import { fetchAppSettings } from "@/lib/queries";

interface LanguageSwitcherProps {
  variant?: "sidebar" | "mobile";
  /** The company's default language (app_settings.preferred_language). Fetched if omitted. */
  preferredLanguage?: string | null;
}

const isAppLanguage = (code: string | null | undefined): code is AppLanguage =>
  Boolean(code) && languageOptions.some((o) => o.code === code);

/**
 * Two-way toggle rather than a dropdown: English and the company's own language, both
 * visible, one tap apart. Shown only on the Dashboard — a dealer picks their language once,
 * so it does not need to follow them onto every screen.
 */
export function LanguageSwitcher({ variant = "sidebar", preferredLanguage }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [companyDefault, setCompanyDefault] = useState<AppLanguage | null>(null);
  const current = getAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    if (preferredLanguage !== undefined) return;
    let cancelled = false;
    fetchAppSettings()
      .then((s) => {
        if (!cancelled && isAppLanguage(s.preferred_language)) setCompanyDefault(s.preferred_language);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preferredLanguage]);

  const preferred = isAppLanguage(preferredLanguage) ? preferredLanguage : companyDefault;

  // English, the company's language, and whatever is active right now (so the active
  // language is always one of the visible options, even if it is neither of the first two).
  const codes = Array.from(new Set<AppLanguage>(["en", ...(preferred ? [preferred] : []), current]));
  if (codes.length < 2) return null;

  const isMobile = variant === "mobile";

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={`inline-flex items-center gap-0.5 rounded-pill p-0.5 ${
        isMobile ? "bg-white/15" : "bg-slate-100"
      }`}
    >
      {codes.map((code) => {
        const option = languageOptions.find((o) => o.code === code)!;
        const active = code === current;
        return (
          <button
            key={code}
            type="button"
            onClick={() => i18n.changeLanguage(code)}
            title={option.nativeName}
            aria-label={option.nativeName}
            aria-pressed={active}
            className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase transition-colors ${
              active
                ? isMobile
                  ? "bg-white text-mobile-navy"
                  : "bg-brand-600 text-white shadow-sm"
                : isMobile
                  ? "text-white/80 active:text-white"
                  : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
