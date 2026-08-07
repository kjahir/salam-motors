import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppLanguage, languageOptions, type AppLanguage } from "@/i18n";
import { fetchAppSettings } from "@/lib/queries";

interface LanguageSwitcherProps {
  variant?: "sidebar" | "mobile";
  /** The languages the company offers (app_settings.preferred_languages). Fetched if omitted. */
  preferredLanguages?: string[] | null;
}

const isAppLanguage = (code: string | null | undefined): code is AppLanguage =>
  Boolean(code) && languageOptions.some((o) => o.code === code);

/**
 * A pill per language the company has switched on, all visible, one tap apart, rather
 * than a dropdown. Shown only on the Dashboard - a dealer picks their language once, so
 * it does not need to follow them onto every screen.
 */
export function LanguageSwitcher({ variant = "sidebar", preferredLanguages }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [companyLanguages, setCompanyLanguages] = useState<AppLanguage[] | null>(null);
  const current = getAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    if (preferredLanguages !== undefined) return;
    let cancelled = false;
    fetchAppSettings()
      .then((s) => {
        if (!cancelled) setCompanyLanguages((s.preferred_languages ?? []).filter(isAppLanguage));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preferredLanguages]);

  const preferred = (preferredLanguages ?? companyLanguages ?? []).filter(isAppLanguage);

  // English (the i18n fallback, and always part of the stored set), everything the company
  // switched on, and whatever is active right now - so the active language is always one of
  // the visible options even if the company has since turned it off.
  const codes = Array.from(new Set<AppLanguage>(["en", ...preferred, current]));
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
            // No `uppercase` here: the labels are native-script letters (த, ಕ, …), which have
            // no case, and forcing it would only ever affect the Latin one.
            className={`flex h-7 min-w-7 items-center justify-center rounded-pill px-2.5 text-sm font-semibold leading-none transition-colors ${
              active
                ? isMobile
                  ? "bg-white text-mobile-navy"
                  : "bg-brand-600 text-white shadow-sm"
                : isMobile
                  ? "text-white/80 active:text-white"
                  : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
