import { useState } from "react";
import { Building2, LogOut, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";

export function CreateOrganization() {
  const { user, signOut, refreshAccess } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast(t("organizationPage.enterName"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_organization", { p_name: name.trim() });
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
            <h1 className="text-lg font-semibold text-slate-900"> {t("organizationPage.title")}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {t("organizationPage.description", { email: user?.email })}
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5"> {t("organizationPage.dealershipName")}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("organizationPage.placeholder")}
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

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400"> {t("organizationPage.or")}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="text-xs text-slate-500 text-center">
            {t("organizationPage.joinHint", { email: user?.email })}
          </p>

          <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mt-5">
            <LogOut size={14} /> {t("organizationPage.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
