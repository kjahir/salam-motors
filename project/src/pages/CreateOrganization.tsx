import { useState } from "react";
import { Building2, LogOut, ArrowRight, ArrowLeft, Loader2, Users, PlusCircle, Mail } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { getAppLanguage, languageOptions, type AppLanguage } from "@/i18n";

type Step = "choice" | "join" | "create";

const emailBold = <span className="font-semibold text-slate-700" />;

export function CreateOrganization() {
  const { user, signOut, refreshAccess } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>("choice");
  const [name, setName] = useState("");
  // English is the implicit default, so the dropdown only ever needs to hold
  // a real value once the dealer has actually picked something else.
  const [preferredLanguage, setPreferredLanguage] = useState<AppLanguage | "">(() => {
    const detected = getAppLanguage();
    return detected === "en" ? "" : detected;
  });
  const [submitting, setSubmitting] = useState(false);

  // English is pinned on (see the checkbox render below); a dealer can add
  // exactly one more, not a growing set - checking a second option here
  // replaces whichever was checked before rather than adding to it. Adding
  // more languages later is a Team > Company settings feature, not onboarding.
  const handleLanguageToggle = (code: AppLanguage) => {
    if (code === "en") return;
    const next = preferredLanguage === code ? "" : code;
    setPreferredLanguage(next);
    // Live preview: the whole screen (this one included) switches immediately,
    // since the person setting this up is also its first reader.
    void i18n.changeLanguage(next || "en");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast(t("organizationPage.enterName"), "error");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 120) {
      toast(t("organizationPage.nameLength"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_organization", {
        p_name: trimmed,
        p_preferred_language: preferredLanguage || "en",
      });
      if (error) throw error;
      toast(t("organizationPage.created"), "success");
      await refreshAccess();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("organizationPage.failed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 mb-4">
              <Building2 size={24} />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">{t("organizationPage.title")}</h1>
            <p className="text-sm text-slate-500 mt-1">
              <Trans i18nKey="organizationPage.description" values={{ email: user?.email }} components={{ bold: emailBold }} />
            </p>
          </div>

          {/* Visible on every step, not just the create form: a dealer who doesn't read
              English needs this before they can even understand the choice below. */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-1.5"> {t("organizationPage.preferredLanguage")}</label>
            <div className="flex flex-wrap gap-2">
              {languageOptions.map((option) => {
                const locked = option.code === "en";
                const checked = locked || preferredLanguage === option.code;
                return (
                  <label
                    key={option.code}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"
                    } ${locked ? "cursor-default opacity-70" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={checked}
                      disabled={locked}
                      onChange={() => handleLanguageToggle(option.code)}
                    />
                    {option.nativeName}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{t("organizationPage.languageHint")}</p>
          </div>

          {step === "choice" && (
            <div>
              <p className="text-sm text-slate-600 text-center mb-4">{t("organizationPage.choiceQuestion")}</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("join")}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Users size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{t("organizationPage.joinOption")}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{t("organizationPage.joinOptionHint")}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep("create")}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <PlusCircle size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{t("organizationPage.createOption")}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{t("organizationPage.createOptionHint")}</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === "join" && (
            <div>
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 mb-4"
              >
                <ArrowLeft size={14} /> {t("organizationPage.back")}
              </button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col items-center text-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Mail size={18} />
                </span>
                <p className="text-sm font-semibold text-slate-900">{t("organizationPage.joinTitle")}</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <Trans i18nKey="organizationPage.joinHint" values={{ email: user?.email }} components={{ bold: emailBold }} />
                </p>
              </div>
            </div>
          )}

          {step === "create" && (
            <div>
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 mb-4"
              >
                <ArrowLeft size={14} /> {t("organizationPage.back")}
              </button>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5"> {t("organizationPage.dealershipName")}</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("organizationPage.placeholder")}
                    maxLength={120}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <>{t("organizationPage.create")} <ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}

          <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mt-6">
            <LogOut size={14} /> {t("organizationPage.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
