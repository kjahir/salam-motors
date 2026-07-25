import { useRef, useState } from "react";
import { CheckCircle2, Pencil, Plus, Receipt, Trash2, Upload } from "lucide-react";
import { Card, Spinner, EmptyState, Sheet, Button, Field, Select, Input } from "./ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { viewProof } from "@/lib/proofStorage";
import { formatINR, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Expense, VehicleWithRelations } from "@/lib/types";

interface UploadedEvidence {
  path: string;
  previewUrl: string;
  name: string;
}

const emptyForm = { category: EXPENSE_CATEGORIES[0], amount: "", vendor: "" };

export function MobileExpensesTab({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidence, setEvidence] = useState<UploadedEvidence | null>(null);
  const [existingBillUrl, setExistingBillUrl] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const clearEvidence = () => {
    setEvidence((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetSheet = () => {
    setSheetOpen(false);
    setEditingExpense(null);
    setForm(emptyForm);
    setExistingBillUrl(null);
    setRemoveExisting(false);
    clearEvidence();
  };

  const openAdd = () => {
    setEditingExpense(null);
    setForm(emptyForm);
    setExistingBillUrl(null);
    setRemoveExisting(false);
    setSheetOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setForm({ category: e.category, amount: String(e.amount), vendor: e.vendor ?? "" });
    setExistingBillUrl(e.bill_url);
    setRemoveExisting(false);
    setSheetOpen(true);
  };

  const handleEvidenceSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("File too large (max 10MB)", "error");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `expenses/${vehicle.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("finance-proofs").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      if (evidence) URL.revokeObjectURL(evidence.previewUrl);
      setEvidence({ path, previewUrl: URL.createObjectURL(file), name: file.name });
      setRemoveExisting(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const expenses = vehicle.expenses ?? [];
  const total = expenses.filter((e) => e.approval_status === "Approved" || e.approval_status === "Paid").reduce((s, e) => s + e.amount, 0);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setSubmitting(true);
    try {
      const finalBillUrl = evidence?.path ?? (removeExisting ? null : existingBillUrl);
      const staleStoragePath = evidence || removeExisting ? existingBillUrl : null;

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            category: form.category,
            amount: Number(form.amount),
            vendor: form.vendor || null,
            bill_available: Boolean(finalBillUrl),
            bill_url: finalBillUrl,
          })
          .eq("id", editingExpense.id);
        if (error) throw error;
        if (staleStoragePath) await supabase.storage.from("finance-proofs").remove([staleStoragePath]);
        toast("Expense updated", "success");
      } else {
        // Mobile-logged expenses save immediately with no approval step, matching the
        // design's one-tap flow — they count toward cost/profit right away.
        const { error } = await supabase.from("expenses").insert({
          vehicle_id: vehicle.id,
          category: form.category,
          amount: Number(form.amount),
          vendor: form.vendor || null,
          bill_available: Boolean(finalBillUrl),
          bill_url: finalBillUrl,
          approval_status: "Approved",
          approved_by: user?.email ?? "Unknown",
          approved_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast("Expense added", "success");
      }
      resetSheet();
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save expense", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewEvidence = async (billUrl: string) => {
    try {
      await viewProof("finance-proofs", billUrl);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to open evidence", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast("Expense removed", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="space-y-3 pt-3">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-mobile-text-muted uppercase">Total Expenses</p>
          <p className="text-lg font-poppins font-bold text-mobile-text mt-0.5">{formatINR(total)}</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={14} /> Add</Button>
      </Card>

      {expenses.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<Receipt size={20} />} title="No expenses yet" description="Add refurbishment, transport, or other costs." /></Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id} className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-mobile-text truncate">{e.category}</p>
                  <p className="text-xs text-mobile-text-muted">{e.vendor ?? "Business"} · {formatDate(e.expense_date)}</p>
                  {e.bill_url && (
                    <button onClick={() => handleViewEvidence(e.bill_url!)} className="text-xs text-mobile-primary font-medium mt-0.5">View evidence</button>
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
        title={editingExpense ? "Edit Expense" : "Add Expense"}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={resetSheet}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} loading={submitting}>{submitting ? <Spinner size={14} /> : null} Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Category" required>
            <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EXPENSE_CATEGORIES} />
          </Field>
          <Field label="Amount (₹)" required>
            <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="3500" />
          </Field>
          <Field label="Vendor">
            <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Sai Spares" />
          </Field>
          <Field label="Evidence" hint="Bill, receipt, or payment screenshot">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleEvidenceSelect} className="hidden" />
            {evidence ? (
              <div className="flex items-center justify-between rounded-xl border border-mobile-border bg-white p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={16} className="text-mobile-success shrink-0" />
                  <span className="text-sm text-mobile-text truncate">{evidence.name}</span>
                </div>
                <button type="button" onClick={clearEvidence} className="text-xs text-mobile-error shrink-0">Remove</button>
              </div>
            ) : existingBillUrl && !removeExisting ? (
              <div className="flex items-center justify-between rounded-xl border border-mobile-border bg-white p-2.5">
                <button type="button" onClick={() => handleViewEvidence(existingBillUrl)} className="flex items-center gap-2 min-w-0 text-mobile-primary">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="text-sm truncate">Current evidence attached</span>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-mobile-primary font-medium">Replace</button>
                  <button type="button" onClick={() => setRemoveExisting(true)} className="text-xs text-mobile-error">Remove</button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                {uploading ? null : <Upload size={14} />} Add Evidence
              </Button>
            )}
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
