import { UserCog, Plus, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader, Field, Select, Spinner, Tabs } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { fetchMemberships, fetchAppSettings, updateCompanyPreferences } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { languageOptions } from "@/i18n";
import type { AppSettings, Membership, Role } from "@/lib/types";

const emptyForm = {
  email: "",
  display_name: "",
  role: "sales_executive" as Role,
};

export function Team() {
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"team" | "company">("team");
  const [orgName, setOrgName] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    preferred_language: "en",
    instagram_handle: "",
    twitter_handle: "",
    whatsapp_business_number: "",
    website_url: "",
    google_business_handle: "",
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const { toast } = useToast();
  const { orgId, role: myRole, user } = useAuth();
  const { t } = useTranslation();
  const roleLabel = (role: Role) => t("roles." + role, { defaultValue: ROLE_LABELS[role] });
  const isOwner = myRole === "owner";
  const canEditCompany = myRole === "owner" || myRole === "manager";

  const reload = useCallback(async () => {
    try {
      const m = await fetchMemberships();
      setMembers(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("teamPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const reloadCompany = useCallback(async () => {
    if (!orgId) return;
    const [{ data: orgRow }, appSettings] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      fetchAppSettings(),
    ]);
    setOrgName(orgRow?.name ?? "");
    setSettings(appSettings);
    setCompanyForm({
      name: orgRow?.name ?? "",
      preferred_language: appSettings.preferred_language ?? "en",
      instagram_handle: appSettings.instagram_handle ?? "",
      twitter_handle: appSettings.twitter_handle ?? "",
      whatsapp_business_number: appSettings.whatsapp_business_number ?? "",
      website_url: appSettings.website_url ?? "",
      google_business_handle: appSettings.google_business_handle ?? "",
    });
  }, [orgId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    reloadCompany();
  }, [reloadCompany]);

  const handleSaveCompany = async () => {
    if (!user) return;
    setSavingCompany(true);
    try {
      const trimmedName = companyForm.name.trim();
      if (isOwner && trimmedName && trimmedName !== orgName) {
        const { error: nameError } = await supabase
          .from("organizations")
          .update({ name: trimmedName })
          .eq("id", orgId);
        if (nameError) throw nameError;
      }
      await updateCompanyPreferences(
        {
          preferred_language: companyForm.preferred_language || null,
          instagram_handle: companyForm.instagram_handle.trim().replace(/^@/, "") || null,
          twitter_handle: companyForm.twitter_handle.trim().replace(/^@/, "") || null,
          whatsapp_business_number: companyForm.whatsapp_business_number.trim() || null,
          website_url: companyForm.website_url.trim() || null,
          google_business_handle: companyForm.google_business_handle.trim().replace(/^@/, "") || null,
        },
        user.email ?? user.id,
      );
      toast(t("teamPage.company.saved"), "success");
      await reloadCompany();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("teamPage.company.saveFailed"), "error");
    } finally {
      setSavingCompany(false);
    }
  };

  const resetForm = () => {
    setShowInvite(false);
    setForm(emptyForm);
  };

  const handleInvite = async () => {
    if (!form.email.trim()) {
      toast(t("teamPage.enterEmail"), "error");
      return;
    }
    if (!orgId) {
      toast(t("teamPage.noOrg"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          org_id: orgId,
          email: form.email.trim(),
          role: form.role,
          display_name: form.display_name.trim() || null,
          kind: "staff",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(t("teamPage.inviteSent"), "success");
      resetForm();
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("teamPage.inviteFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (m: Membership, role: Role) => {
    try {
      const { error } = await supabase.from("memberships").update({ role }).eq("id", m.id);
      if (error) throw error;
      toast(t("teamPage.roleUpdated"), "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("teamPage.roleFailed"), "error");
    }
  };

  const handleToggleSuspend = async (m: Membership) => {
    const nextStatus = m.status === "suspended" ? "active" : "suspended";
    try {
      const { error } = await supabase.from("memberships").update({ status: nextStatus }).eq("id", m.id);
      if (error) throw error;
      toast(nextStatus === "suspended" ? t("teamPage.accessSuspended") : t("teamPage.accessRestored"), "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("teamPage.statusFailed"), "error");
    }
  };

  const statusColor = (s: string) => (s === "active" ? "green" : s === "invited" ? "amber" : "slate") as "green" | "amber" | "slate";

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("teamPage.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("teamPage.title")} />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("teamPage.failedToLoadShort")} description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title={t("teamPage.title")}
        description={t("teamPage.description")}
        icon={<UserCog size={20} />}
        actions={
          isOwner && tab === "team" ? (
            <button onClick={() => setShowInvite(true)} className="btn-primary">
              <Plus size={16} /> {t("teamPage.inviteMember")}
            </button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: "team", label: t("teamPage.tabs.team") },
            { key: "company", label: t("teamPage.tabs.company") },
          ]}
          active={tab}
          onChange={(k) => setTab(k as "team" | "company")}
        />
      </div>

      {tab === "company" ? (
        <Card className="p-5 space-y-4">
          <Field label={t("teamPage.company.dealershipName")}>
            <input
              className="input"
              value={companyForm.name}
              disabled={!isOwner}
              maxLength={120}
              onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
            />
            {!isOwner && <p className="text-xs text-slate-400 mt-1">{t("teamPage.company.ownerOnlyName")}</p>}
          </Field>
          <Field label={t("teamPage.company.preferredLanguage")}>
            <Select
              value={companyForm.preferred_language}
              onChange={(v) => setCompanyForm((f) => ({ ...f, preferred_language: v }))}
              options={languageOptions.map((option) => ({ value: option.code, label: option.nativeName }))}
              className={canEditCompany ? "" : "pointer-events-none opacity-60"}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("teamPage.company.instagramHandle")}>
              <input
                className="input"
                value={companyForm.instagram_handle}
                disabled={!canEditCompany}
                onChange={(e) => setCompanyForm((f) => ({ ...f, instagram_handle: e.target.value }))}
                placeholder="dealername"
              />
            </Field>
            <Field label={t("teamPage.company.twitterHandle")}>
              <input
                className="input"
                value={companyForm.twitter_handle}
                disabled={!canEditCompany}
                onChange={(e) => setCompanyForm((f) => ({ ...f, twitter_handle: e.target.value }))}
                placeholder="dealername"
              />
            </Field>
            <Field label={t("teamPage.company.whatsappNumber")}>
              <input
                className="input"
                value={companyForm.whatsapp_business_number}
                disabled={!canEditCompany}
                onChange={(e) => setCompanyForm((f) => ({ ...f, whatsapp_business_number: e.target.value }))}
              />
            </Field>
            <Field label={t("teamPage.company.websiteUrl")}>
              <input
                className="input"
                value={companyForm.website_url}
                disabled={!canEditCompany}
                onChange={(e) => setCompanyForm((f) => ({ ...f, website_url: e.target.value }))}
                placeholder="https://"
              />
            </Field>
            <Field label={t("teamPage.company.googleBusinessHandle", { defaultValue: "Google Business Profile Handle" })}>
              <input
                className="input"
                value={companyForm.google_business_handle}
                disabled={!canEditCompany}
                onChange={(e) => setCompanyForm((f) => ({ ...f, google_business_handle: e.target.value }))}
                placeholder="dealername"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t("teamPage.company.googleBusinessHandleHint", {
                  defaultValue: "Set this to also cross-post every listed vehicle to your own Google Business Profile, in addition to the shared VahanExchange listing feed.",
                })}
              </p>
            </Field>
          </div>
          {settings?.updated_at && (
            <p className="text-xs text-slate-400">{new Date(settings.updated_at).toLocaleString()}</p>
          )}
          {canEditCompany && (
            <div className="flex justify-end">
              <button onClick={handleSaveCompany} disabled={savingCompany} className="btn-primary">
                {savingCompany ? <Spinner size={14} /> : null} {t("teamPage.company.save")}
              </button>
            </div>
          )}
        </Card>
      ) : members.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<UserCog size={24} />} title={t("teamPage.noMembers")} description={t("teamPage.noMembersDescription")} />
        </Card>
      ) : (
        <Card className="p-5">
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{m.display_name || m.email}</span>
                    <Badge color={statusColor(m.status)}>{t("status." + m.status, { defaultValue: m.status })}</Badge>
                    {m.user_id === user?.id && <Badge color="slate">{t("teamPage.you")}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && m.role !== "owner" ? (
                    <Select
                      value={m.role}
                      onChange={(v) => handleRoleChange(m, v as Role)}
                      options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: roleLabel(r) }))}
                      className="w-44"
                    />
                  ) : (
                    <span className="text-sm text-slate-600 w-44 text-right">{roleLabel(m.role)}</span>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <button
                      onClick={() => handleToggleSuspend(m)}
                      className="text-slate-400 hover:text-red-600 p-1.5"
                      title={m.status === "suspended" ? t("teamPage.restoreAccess") : t("teamPage.suspendAccess")}
                    >
                      {m.status === "suspended" ? <RotateCcw size={14} /> : <Ban size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={showInvite}
        onClose={resetForm}
        title={t("teamPage.inviteMember")}
        footer={
          <>
            <button onClick={resetForm} className="btn-secondary"> {t("teamPage.cancel")}</button>
            <button onClick={handleInvite} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} {t("teamPage.sendInvite")}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("teamPage.email")} required>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="teammate@example.com"
            />
          </Field>
          <Field label={t("teamPage.name")}>
            <input className="input" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder={t("teamPage.optional")} />
          </Field>
          <Field label={t("teamPage.role")} required>
            <Select
              value={form.role}
              onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
              options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: roleLabel(r) }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
