import { useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { Card, Spinner, EmptyState, Sheet, Button, Field, Select, Input } from "./ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { VehicleWithRelations } from "@/lib/types";

export function MobileExpensesTab({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], amount: "", vendor: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const expenses = vehicle.expenses ?? [];
  const total = expenses.filter((e) => e.approval_status === "Approved" || e.approval_status === "Paid").reduce((s, e) => s + e.amount, 0);

  const handleAdd = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Mobile-logged expenses save immediately with no approval step, matching the
      // design's one-tap flow — they count toward cost/profit right away.
      const { error } = await supabase.from("expenses").insert({
        vehicle_id: vehicle.id,
        category: form.category,
        amount: Number(form.amount),
        vendor: form.vendor || null,
        approval_status: "Approved",
        approved_by: user?.email ?? "Unknown",
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast("Expense added", "success");
      setShowAdd(false);
      setForm({ category: EXPENSE_CATEGORIES[0], amount: "", vendor: "" });
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add expense", "error");
    } finally {
      setSubmitting(false);
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
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add</Button>
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
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-mobile-text">{formatINR(e.amount)}</span>
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
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Expense"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAdd} loading={submitting}>{submitting ? <Spinner size={14} /> : null} Save</Button>
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
        </div>
      </Sheet>
    </div>
  );
}
