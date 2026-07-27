import { useEffect, useState } from "react";
import { UserCog, Plus, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { fetchMemberships } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import type { Membership, Role } from "@/lib/types";

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
  const { toast } = useToast();
  const { orgId, role: myRole, user } = useAuth();
  const isOwner = myRole === "owner";

  const reload = async () => {
    try {
      const m = await fetchMemberships();
      setMembers(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const resetForm = () => {
    setShowInvite(false);
    setForm(emptyForm);
  };

  const handleInvite = async () => {
    if (!form.email.trim()) {
      toast("Enter an email address", "error");
      return;
    }
    if (!orgId) {
      toast("No active organization", "error");
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
      toast("Invite sent", "success");
      resetForm();
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send invite", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (m: Membership, role: Role) => {
    try {
      const { error } = await supabase.from("memberships").update({ role }).eq("id", m.id);
      if (error) throw error;
      toast("Role updated", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update role", "error");
    }
  };

  const handleToggleSuspend = async (m: Membership) => {
    const nextStatus = m.status === "suspended" ? "active" : "suspended";
    try {
      const { error } = await supabase.from("memberships").update({ status: nextStatus }).eq("id", m.id);
      if (error) throw error;
      toast(nextStatus === "suspended" ? "Access suspended" : "Access restored", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update status", "error");
    }
  };

  const statusColor = (s: string) => (s === "active" ? "green" : s === "invited" ? "amber" : "slate") as "green" | "amber" | "slate";

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Team" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Team" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Team"
        description="Who has access to this dealership, and what they can do"
        icon={<UserCog size={20} />}
        actions={
          isOwner ? (
            <button onClick={() => setShowInvite(true)} className="btn-primary">
              <Plus size={16} /> Invite Team Member
            </button>
          ) : undefined
        }
      />

      {members.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<UserCog size={24} />} title="No team members yet" description="Invite your first staff member to get started." />
        </Card>
      ) : (
        <Card className="p-5">
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{m.display_name || m.email}</span>
                    <Badge color={statusColor(m.status)}>{m.status}</Badge>
                    {m.user_id === user?.id && <Badge color="slate">You</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && m.role !== "owner" ? (
                    <Select
                      value={m.role}
                      onChange={(v) => handleRoleChange(m, v as Role)}
                      options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                      className="w-44"
                    />
                  ) : (
                    <span className="text-sm text-slate-600 w-44 text-right">{ROLE_LABELS[m.role]}</span>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <button
                      onClick={() => handleToggleSuspend(m)}
                      className="text-slate-400 hover:text-red-600 p-1.5"
                      title={m.status === "suspended" ? "Restore access" : "Suspend access"}
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
        title="Invite Team Member"
        footer={
          <>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
            <button onClick={handleInvite} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Send Invite</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email" required>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="teammate@example.com"
            />
          </Field>
          <Field label="Name">
            <input className="input" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Optional" />
          </Field>
          <Field label="Role" required>
            <Select
              value={form.role}
              onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
              options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
