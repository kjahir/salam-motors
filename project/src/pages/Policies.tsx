import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, Trash2, Pencil, AlertTriangle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { fetchCompliancePolicies } from "@/lib/queries";
import { syncAllVehiclesCompliance } from "@/lib/compliance";
import { translateCompliancePolicyDescription, translateCompliancePolicyTitle } from "@/lib/i18nText";
import { supabase } from "@/lib/supabase";
import {
  DOCUMENT_TYPES,
  DOCUMENT_VERIFICATION_STATUSES,
  ALERT_SEVERITIES,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_RULE_TYPES,
  COMPLIANCE_RULE_TYPE_LABELS,
  COMPLIANCE_EVIDENCE_ENTITIES,
  COMPLIANCE_EVIDENCE_ENTITY_LABELS,
  COMPLIANCE_RESOLUTION_MODES,
  COMPLIANCE_RESOLUTION_MODE_LABELS,
  DEFAULT_COMPLIANCE_POLICIES,
} from "@/lib/constants";
import type { CompliancePolicy } from "@/lib/types";

const emptyForm = {
  name: "",
  description: "",
  category: "document" as (typeof COMPLIANCE_CATEGORIES)[number],
  rule_type: "document_required" as (typeof COMPLIANCE_RULE_TYPES)[number],
  document_type: DOCUMENT_TYPES[0],
  accepted_statuses: ["Verified", "Uploaded"] as string[],
  entity: COMPLIANCE_EVIDENCE_ENTITIES[0] as string,
  tolerance: "0.01",
  severity: "Warning",
  resolution_mode: "auto_only" as (typeof COMPLIANCE_RESOLUTION_MODES)[number],
  is_active: true,
};

function paramsForForm(form: typeof emptyForm): Record<string, unknown> {
  if (form.rule_type === "document_required") {
    return { document_type: form.document_type, accepted_statuses: form.accepted_statuses };
  }
  if (form.rule_type === "evidence_required") {
    return { entity: form.entity };
  }
  return { target: "purchase_payments_vs_purchase_price", tolerance: Number(form.tolerance) || 0.01 };
}

function formFromPolicy(p: CompliancePolicy): typeof emptyForm {
  return {
    name: p.name,
    description: p.description ?? "",
    category: (p.category as (typeof COMPLIANCE_CATEGORIES)[number]) ?? "document",
    rule_type: (p.rule_type as (typeof COMPLIANCE_RULE_TYPES)[number]) ?? "document_required",
    document_type: (p.params.document_type as string) ?? DOCUMENT_TYPES[0],
    accepted_statuses: (p.params.accepted_statuses as string[]) ?? ["Verified", "Uploaded"],
    entity: (p.params.entity as string) ?? COMPLIANCE_EVIDENCE_ENTITIES[0],
    tolerance: p.params.tolerance !== undefined ? String(p.params.tolerance) : "0.01",
    severity: p.severity,
    resolution_mode: (p.resolution_mode as (typeof COMPLIANCE_RESOLUTION_MODES)[number]) ?? "manual",
    is_active: p.is_active,
  };
}

export function Policies() {
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CompliancePolicy | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  const translateStatic = useCallback((value: string) => t("status." + value, { defaultValue: value }), [t]);
  const translateCategory = useCallback((category: string) => t("status." + COMPLIANCE_CATEGORY_LABELS[category], { defaultValue: COMPLIANCE_CATEGORY_LABELS[category] }), [t]);
  const translateRuleType = useCallback((ruleType: string) => t("status." + COMPLIANCE_RULE_TYPE_LABELS[ruleType], { defaultValue: COMPLIANCE_RULE_TYPE_LABELS[ruleType] }), [t]);
  const translateEntity = useCallback((entity: string) => t("status." + COMPLIANCE_EVIDENCE_ENTITY_LABELS[entity], { defaultValue: COMPLIANCE_EVIDENCE_ENTITY_LABELS[entity] }), [t]);
  const translateResolutionMode = useCallback((mode: string) => t("status." + COMPLIANCE_RESOLUTION_MODE_LABELS[mode], { defaultValue: COMPLIANCE_RESOLUTION_MODE_LABELS[mode] }), [t]);

  const reload = useCallback(async () => {
    try {
      const p = await fetchCompliancePolicies();
      setPolicies(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("policiesPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, CompliancePolicy[]>();
    for (const cat of COMPLIANCE_CATEGORIES) byCategory.set(cat, []);
    for (const p of policies) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }
    return byCategory;
  }, [policies]);

  const afterMutation = async () => {
    await syncAllVehiclesCompliance().catch(() => {});
    await reload();
  };

  const resetForm = () => {
    setShowAdd(false);
    setEditingPolicy(null);
    setForm(emptyForm);
  };

  const openAdd = () => {
    setEditingPolicy(null);
    setForm(emptyForm);
    setShowAdd(true);
  };

  const openEdit = (p: CompliancePolicy) => {
    setEditingPolicy(p);
    setForm(formFromPolicy(p));
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast(t("policiesPage.enterName"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        rule_type: form.rule_type,
        params: paramsForForm(form),
        severity: form.severity,
        resolution_mode: form.resolution_mode,
        is_active: form.is_active,
      };
      if (editingPolicy) {
        const { error } = await supabase.from("compliance_policies").update(payload).eq("id", editingPolicy.id);
        if (error) throw error;
        toast(t("policiesPage.policyUpdated"), "success");
      } else {
        const { error } = await supabase.from("compliance_policies").insert(payload);
        if (error) throw error;
        toast(t("policiesPage.policyAdded"), "success");
      }
      resetForm();
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("policiesPage.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: CompliancePolicy) => {
    const policyName = translateCompliancePolicyTitle(t, p.name);
    if (!confirm(t("policiesPage.deleteConfirm", { name: policyName }))) return;
    try {
      const { error } = await supabase
        .from("compliance_policies")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({
          entity_type: "compliance_policy",
          entity_id: p.id,
          action: "deleted",
          performed_by: user?.email ?? "Unknown",
          reason: t("policiesPage.deletedReason", { name: policyName }),
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log policy deletion", auditErr);
        });
      toast(t("policiesPage.policyRemoved"), "success");
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("policiesPage.deleteFailed"), "error");
    }
  };

  const handleToggleActive = async (p: CompliancePolicy) => {
    try {
      const { error } = await supabase.from("compliance_policies").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("policiesPage.updateFailed"), "error");
    }
  };

  const handleLoadDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const existingKeys = new Set(policies.map((p) => `${p.rule_type}:${JSON.stringify(p.params)}`));
      const toInsert = DEFAULT_COMPLIANCE_POLICIES.filter(
        (d) => !existingKeys.has(`${d.rule_type}:${JSON.stringify(d.params)}`),
      );
      if (toInsert.length === 0) {
        toast(t("policiesPage.defaultsAlready"), "info");
        return;
      }
      const { error } = await supabase.from("compliance_policies").insert(toInsert);
      if (error) throw error;
      toast(t("policiesPage.defaultsAdded", { count: toInsert.length }), "success");
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("policiesPage.defaultsFailed"), "error");
    } finally {
      setLoadingDefaults(false);
    }
  };

  const severityColor = (s: string) => (s === "Critical" ? "red" : s === "High" ? "orange" : s === "Warning" ? "amber" : "slate") as "red" | "orange" | "amber" | "slate";

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("policiesPage.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("policiesPage.title")} />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("policiesPage.failedToLoadShort")} description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("policiesPage.title")}
        description={t("policiesPage.description")}
        icon={<ShieldCheck size={20} />}
        actions={
          <>
            <button onClick={handleLoadDefaults} disabled={loadingDefaults} className="btn-secondary">
              {loadingDefaults ? <Spinner size={14} /> : <Sparkles size={16} />} {t("policiesPage.loadDefaults")}
            </button>
            <button onClick={openAdd} className="btn-primary"><Plus size={16} /> {t("policiesPage.addPolicy")}</button>
          </>
        }
      />

      {policies.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title={t("policiesPage.noPolicies")}
            description={t("policiesPage.emptyDescription")}
            action={<button onClick={handleLoadDefaults} className="btn-primary"><Sparkles size={16} /> {t("policiesPage.loadDefaults")}</button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {COMPLIANCE_CATEGORIES.map((cat) => {
            const list = grouped.get(cat) ?? [];
            if (list.length === 0) return null;
            return (
              <Card key={cat} className="p-5">
                <h3 className="font-semibold text-slate-900 mb-3">{translateCategory(cat)}</h3>
                <div className="space-y-2">
                  {list.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 ${p.is_active ? "" : "opacity-60"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{translateCompliancePolicyTitle(t, p.name)}</span>
                          <Badge color={severityColor(p.severity)}>{translateStatic(p.severity)}</Badge>
                          {p.resolution_mode === "auto_only" && <Badge color="purple">{t("policiesPage.requiresAction")}</Badge>}
                          {!p.is_active && <Badge color="slate">{t("policiesPage.disabled")}</Badge>}
                        </div>
                        {p.description && <p className="text-xs text-slate-500 mt-0.5">{translateCompliancePolicyDescription(t, p.description, p.name)}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggleActive(p)} className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2">
                          {p.is_active ? t("policiesPage.disable") : t("policiesPage.enable")}
                        </button>
                        <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-brand-600 p-1.5"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(p)} className="text-slate-400 hover:text-red-600 p-1.5"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={resetForm}
        title={editingPolicy ? t("policiesPage.editPolicy") : t("policiesPage.addTitle")}
        size="lg"
        footer={<>
          <button onClick={resetForm} className="btn-secondary">{t("policiesPage.cancel")}</button>
          <button onClick={handleSave} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} {t("policiesPage.save")}</button>
        </>}
      >
        <div className="space-y-4">
          <Field label={t("policiesPage.name")} required>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("policiesPage.namePlaceholder")} />
          </Field>
          <Field label={t("policiesPage.descriptionLabel")}>
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("policiesPage.descriptionPlaceholder")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("policiesPage.category")} required>
              <Select
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
                options={COMPLIANCE_CATEGORIES.map((c) => ({ value: c, label: translateCategory(c) }))}
              />
            </Field>
            <Field label={t("policiesPage.ruleType")} required>
              <Select
                value={form.rule_type}
                onChange={(v) => setForm((f) => ({ ...f, rule_type: v as typeof f.rule_type }))}
                options={COMPLIANCE_RULE_TYPES.map((r) => ({ value: r, label: translateRuleType(r) }))}
              />
            </Field>
          </div>

          {form.rule_type === "document_required" && (
            <>
              <Field label={t("policiesPage.documentType")} required>
                <Select value={form.document_type} onChange={(v) => setForm((f) => ({ ...f, document_type: v }))} options={DOCUMENT_TYPES.map((documentType) => ({ value: documentType, label: translateStatic(documentType) }))} />
              </Field>
              <Field label={t("policiesPage.acceptedStatuses")} hint={t("policiesPage.acceptedStatusesHint")}>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_VERIFICATION_STATUSES.map((s) => (
                    <label key={s} className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-slate-200 px-2.5 py-1.5">
                      <input
                        type="checkbox"
                        checked={form.accepted_statuses.includes(s)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            accepted_statuses: e.target.checked ? [...f.accepted_statuses, s] : f.accepted_statuses.filter((x) => x !== s),
                          }))
                        }
                        className="rounded border-slate-300"
                      />
                      {translateStatic(s)}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {form.rule_type === "evidence_required" && (
            <Field label={t("policiesPage.appliesTo")} required>
              <Select
                value={form.entity}
                onChange={(v) => setForm((f) => ({ ...f, entity: v }))}
                options={COMPLIANCE_EVIDENCE_ENTITIES.map((e) => ({ value: e, label: translateEntity(e) }))}
              />
            </Field>
          )}

          {form.rule_type === "amount_reconciliation" && (
            <Field label={t("policiesPage.tolerance")} hint={t("policiesPage.toleranceHint")}>
              <input className="input" type="number" step="0.01" value={form.tolerance} onChange={(e) => setForm((f) => ({ ...f, tolerance: e.target.value }))} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label={t("policiesPage.severity")}>
              <Select value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} options={ALERT_SEVERITIES.map((severity) => ({ value: severity, label: translateStatic(severity) }))} />
            </Field>
            <Field label={t("policiesPage.status")}>
              <label className="flex items-center gap-2 mt-2.5">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300" />
                <span className="text-sm">{t("policiesPage.active")}</span>
              </label>
            </Field>
          </div>
          <Field label={t("policiesPage.resolution")} hint={t("policiesPage.resolutionHint")}>
            <Select
              value={form.resolution_mode}
              onChange={(v) => setForm((f) => ({ ...f, resolution_mode: v as typeof f.resolution_mode }))}
              options={COMPLIANCE_RESOLUTION_MODES.map((m) => ({ value: m, label: translateResolutionMode(m) }))}
            />
            {form.resolution_mode === "auto_only" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1.5 flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t("policiesPage.autoOnlyWarning")}
              </p>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
