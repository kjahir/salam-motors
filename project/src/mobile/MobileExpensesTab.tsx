import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, Spinner, EmptyState, Sheet, Button, Field, Select, Input } from "./ui/primitives";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { diffRemovedPaths, isImageName, type UploadedFile } from "@/lib/uploadedFile";
import { syncVehicleAlerts } from "@/lib/compliance";
import { formatINR, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Expense, VehicleWithRelations } from "@/lib/types";

const emptyForm = { category: EXPENSE_CATEGORIES[0], amount: "", vendor: "" };

export function MobileExpensesTab({ vehicle, onChanged, highlightIds, autoAdd, onAutoAddConsumed }: { vehicle: VehicleWithRelations; onChanged: () => void; highlightIds?: string[]; autoAdd?: boolean; onAutoAddConsumed?: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadedFile[]>([]);
  const [originalBillUrls, setOriginalBillUrls] = useState<string[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());
  const [evidenceLightbox, setEvidenceLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [activeHighlights, setActiveHighlights] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });
  const { user } = useAuth();

  useEffect(() => {
    if (!highlightIds || highlightIds.length === 0) return;
    setActiveHighlights(new Set(highlightIds));
    const el = document.getElementById(`expense-card-${highlightIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setActiveHighlights(new Set()), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIds?.join(",")]);

  const resetSheet = () => {
    setSheetOpen(false);
    setEditingExpense(null);
    setForm(emptyForm);
    setEvidenceFiles([]);
    setOriginalBillUrls([]);
    setUploadSessionId(crypto.randomUUID());
  };

  const openAdd = () => {
    setEditingExpense(null);
    setForm(emptyForm);
    setEvidenceFiles([]);
    setOriginalBillUrls([]);
    setSheetOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setForm({ category: e.category, amount: String(e.amount), vendor: e.vendor ?? "" });
    const existing = e.bill_urls?.length ? e.bill_urls : e.bill_url ? [e.bill_url] : [];
    setEvidenceFiles(existing.map((path) => ({ path, name: path.split("/").pop() ?? path })));
    setOriginalBillUrls(existing);
    setSheetOpen(true);
  };

  // Reached via the mobile "+" -> Expense autoAdd target: opens the add sheet once on
  // mount, guarded so it doesn't reopen on re-renders (e.g. after onChanged() refetches).
  const autoAddFired = useRef(false);
  useEffect(() => {
    if (!autoAdd || autoAddFired.current) return;
    autoAddFired.current = true;
    openAdd();
    onAutoAddConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdd]);

  const expenses = vehicle.expenses ?? [];
  const total = expenses.filter((e) => e.approval_status === "Approved" || e.approval_status === "Paid").reduce((s, e) => s + e.amount, 0);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast(t("mobileExpenses.validAmount"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const billUrls = evidenceFiles.map((f) => f.path);
      const removedPaths = diffRemovedPaths(originalBillUrls, evidenceFiles);

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            category: form.category,
            amount: Number(form.amount),
            vendor: form.vendor || null,
            bill_available: billUrls.length > 0,
            bill_url: billUrls[0] ?? null,
            bill_urls: billUrls,
          })
          .eq("id", editingExpense.id);
        if (error) throw error;
        if (removedPaths.length > 0) await supabase.storage.from("finance-proofs").remove(removedPaths);
        toast(t("mobileExpenses.updated"), "success");
      } else {
        // Mobile-logged expenses save immediately with no approval step, matching the
        // design's one-tap flow — they count toward cost/profit right away.
        const { error } = await supabase.from("expenses").insert({
          vehicle_id: vehicle.id,
          category: form.category,
          amount: Number(form.amount),
          vendor: form.vendor || null,
          bill_available: billUrls.length > 0,
          bill_url: billUrls[0] ?? null,
          bill_urls: billUrls,
          approval_status: "Approved",
          approved_by: user?.email ?? "Unknown",
          approved_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast(t("mobileExpenses.added"), "success");
      }
      resetSheet();
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileExpenses.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewEvidence = (e: Expense) => {
    const paths = e.bill_urls?.length ? e.bill_urls : e.bill_url ? [e.bill_url] : [];
    if (paths.length === 0) return;
    setEvidenceLightbox({
      items: paths.map((path) => ({
        name: path.split("/").pop() ?? path,
        isImage: isImageName(path),
        resolve: async () => {
          const { data, error } = await supabase.storage.from("finance-proofs").createSignedUrl(path, 300);
          if (error) throw error;
          return data.signedUrl;
        },
      })),
      index: 0,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("mobileExpenses.deleteConfirm"))) return;
    try {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({ entity_type: "expense", entity_id: id, action: "deleted", performed_by: user?.email ?? "Unknown" })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log expense deletion", auditErr);
        });
      toast(t("mobileExpenses.removed"), "success");
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileExpenses.deleteFailed"), "error");
    }
  };

  return (
    <div className="space-y-3 pt-3">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-mobile-text-muted uppercase"> {t("mobileExpenses.totalExpenses")}</p>
          <p className="text-lg font-poppins font-bold text-mobile-text mt-0.5">{formatINR(total)}</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={14} /> {t("mobileExpenses.add")}</Button>
      </Card>

      {expenses.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<Receipt size={20} />} title={t("mobileExpenses.noExpenses")} description={t("mobileExpenses.noExpensesDescription")} /></Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card
              key={e.id}
              id={`expense-card-${e.id}`}
              className={`p-3.5 transition-colors ${activeHighlights.has(e.id) ? "ring-2 ring-amber-400 bg-amber-50/50" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-mobile-text truncate">{trStatus(e.category)}</p>
                  <p className="text-xs text-mobile-text-muted">{e.vendor ?? t("mobileExpenses.business")} · {formatDate(e.expense_date)}</p>
                  {(e.bill_urls?.length ?? (e.bill_url ? 1 : 0)) > 0 && (
                    <button onClick={() => handleViewEvidence(e)} className="text-xs text-mobile-primary font-medium mt-0.5"> {t("mobileExpenses.viewEvidence")}</button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-mobile-text">{formatINR(e.amount)}</span>
                  <button onClick={() => openEdit(e)} className="text-mobile-text-muted active:text-mobile-primary p-1">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} className="text-mobile-text-muted active:text-mobile-error p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={resetSheet}
        title={editingExpense ? t("mobileExpenses.editExpense") : t("mobileExpenses.addExpense")}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={resetSheet}> {t("mobileExpenses.cancel")}</Button>
            <Button className="flex-1" onClick={handleSave} loading={submitting}>{submitting ? <Spinner size={14} /> : null} {t("mobileExpenses.save")}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label={t("mobileExpenses.category")} required>
            <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EXPENSE_CATEGORIES.map((category) => ({ value: category, label: trStatus(category) }))} />
          </Field>
          <Field label={t("mobileExpenses.amount")} required>
            <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="3500" />
          </Field>
          <Field label={t("mobileExpenses.vendor")}>
            <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Sai Spares" />
          </Field>
          <FileUploadGrid
            bucket="finance-proofs"
            pathPrefix={`expenses/${vehicle.id}/${uploadSessionId}`}
            value={evidenceFiles}
            onChange={setEvidenceFiles}
            hint={t("mobileExpenses.hint")}
          />
        </div>
      </Sheet>

      {evidenceLightbox && (
        <Lightbox
          items={evidenceLightbox.items}
          index={evidenceLightbox.index}
          onClose={() => setEvidenceLightbox(null)}
          onIndexChange={(index) => setEvidenceLightbox((s) => (s ? { ...s, index } : s))}
        />
      )}
    </div>
  );
}
