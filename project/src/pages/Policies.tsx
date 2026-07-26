import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, Trash2, Pencil, AlertTriangle, Sparkles } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { fetchCompliancePolicies } from "@/lib/queries";
import { syncAllVehiclesCompliance } from "@/lib/compliance";
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

  const reload = async () => {
    try {
      const p = await fetchCompliancePolicies();
      setPolicies(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

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
      toast("Enter a policy name", "error");
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
        toast("Policy updated", "success");
      } else {
        const { error } = await supabase.from("compliance_policies").insert(payload);
        if (error) throw error;
        toast("Policy added", "success");
      }
      resetForm();
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save policy", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: CompliancePolicy) => {
    if (!confirm(`Delete policy "${p.name}"? Any open alerts it created will be resolved.`)) return;
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
          reason: `Deleted policy "${p.name}"`,
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log policy deletion", auditErr);
        });
      toast("Policy removed", "success");
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const handleToggleActive = async (p: CompliancePolicy) => {
    try {
      const { error } = await supabase.from("compliance_policies").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "error");
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
        toast("All recommended defaults are already present", "info");
        return;
      }
      const { error } = await supabase.from("compliance_policies").insert(toInsert);
      if (error) throw error;
      toast(`${toInsert.length} default polic${toInsert.length === 1 ? "y" : "ies"} added`, "success");
      await afterMutation();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load defaults", "error");
    } finally {
      setLoadingDefaults(false);
    }
  };

  const severityColor = (s: string) => (s === "Critical" ? "red" : s === "High" ? "orange" : s === "Warning" ? "amber" : "slate") as "red" | "orange" | "amber" | "slate";

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Compliance Policies" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Compliance Policies" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Compliance Policies"
        description="Document and financial-evidence rules enforced across every vehicle"
        icon={<ShieldCheck size={20} />}
        actions={
          <>
            <button onClick={handleLoadDefaults} disabled={loadingDefaults} className="btn-secondary">
              {loadingDefaults ? <Spinner size={14} /> : <Sparkles size={16} />} Load Recommended Defaults
            </button>
            <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Policy</button>
          </>
        }
      />

      {policies.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title="No policies yet"
            description="Load the recommended defaults or add your own to start enforcing document and financial-evidence rules."
            action={<button onClick={handleLoadDefaults} className="btn-primary"><Sparkles size={16} /> Load Recommended Defaults</button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {COMPLIANCE_CATEGORIES.map((cat) => {
            const list = grouped.get(cat) ?? [];
            if (list.length === 0) return null;
            return (
              <Card key={cat} className="p-5">
                <h3 className="font-semibold text-slate-900 mb-3">{COMPLIANCE_CATEGORY_LABELS[cat]}</h3>
                <div className="space-y-2">
                  {list.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 ${p.is_active ? "" : "opacity-60"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{p.name}</span>
                          <Badge color={severityColor(p.severity)}>{p.severity}</Badge>
                          {p.resolution_mode === "auto_only" && <Badge color="purple">Requires action</Badge>}
                          {!p.is_active && <Badge color="slate">Disabled</Badge>}
                        </div>
                        {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggleActive(p)} className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2">
                          {p.is_active ? "Disable" : "Enable"}
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
        title={editingPolicy ? "Edit Policy" : "Add Policy"}
        size="lg"
        footer={<>
          <button onClick={resetForm} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Save</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="RC book required" />
          </Field>
          <Field label="Description">
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional context for other staff" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required>
              <Select
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
                options={COMPLIANCE_CATEGORIES.map((c) => ({ value: c, label: COMPLIANCE_CATEGORY_LABELS[c] }))}
              />
            </Field>
            <Field label="Rule Type" required>
              <Select
                value={form.rule_type}
                onChange={(v) => setForm((f) => ({ ...f, rule_type: v as typeof f.rule_type }))}
                options={COMPLIANCE_RULE_TYPES.map((r) => ({ value: r, label: COMPLIANCE_RULE_TYPE_LABELS[r] }))}
              />
            </Field>
          </div>

          {form.rule_type === "document_required" && (
            <>
              <Field label="Document Type" required>
                <Select value={form.document_type} onChange={(v) => setForm((f) => ({ ...f, document_type: v }))} options={DOCUMENT_TYPES} />
              </Field>
              <Field label="Accepted Statuses" hint="A document in one of these statuses satisfies the policy">
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
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {form.rule_type === "evidence_required" && (
            <Field label="Applies To" required>
              <Select
                value={form.entity}
                onChange={(v) => setForm((f) => ({ ...f, entity: v }))}
                options={COMPLIANCE_EVIDENCE_ENTITIES.map((e) => ({ value: e, label: COMPLIANCE_EVIDENCE_ENTITY_LABELS[e] }))}
              />
            </Field>
          )}

          {form.rule_type === "amount_reconciliation" && (
            <Field label="Tolerance (₹)" hint="Purchase payments may differ from the agreed price by up to this much before it's flagged">
              <input className="input" type="number" step="0.01" value={form.tolerance} onChange={(e) => setForm((f) => ({ ...f, tolerance: e.target.value }))} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Severity">
              <Select value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} options={ALERT_SEVERITIES} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 mt-2.5">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300" />
                <span className="text-sm">Active</span>
              </label>
            </Field>
          </div>
          <Field label="Resolution" hint="Controls whether staff can manually Acknowledge/Resolve its alerts, or must actually fix the issue">
            <Select
              value={form.resolution_mode}
              onChange={(v) => setForm((f) => ({ ...f, resolution_mode: v as typeof f.resolution_mode }))}
              options={COMPLIANCE_RESOLUTION_MODES.map((m) => ({ value: m, label: COMPLIANCE_RESOLUTION_MODE_LABELS[m] }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
