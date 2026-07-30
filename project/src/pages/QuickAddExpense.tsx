import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchPartners } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Partner } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface ExpenseDraftRow {
  key: string;
  category: string;
  amount: string;
  vendor: string;
  description: string;
  paid_by_partner_id: string;
}

const emptyRow = (): ExpenseDraftRow => ({
  key: crypto.randomUUID(),
  category: EXPENSE_CATEGORIES[0],
  amount: "",
  vendor: "",
  description: "",
  paid_by_partner_id: "",
});

// Desktop counterpart to src/mobile/MobileAddExpense.tsx: pick a vehicle, then repeatable
// expense rows, one bulk insert. Same batch shape as VehicleDetail.tsx's ExpensesTab "Add
// Expenses" panel, but as its own page with the vehicle picker instead of a tab embedded
// inside a specific vehicle's detail view.
export function QuickAddExpense({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rows, setRows] = useState<ExpenseDraftRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchPartners().then(setPartners);
  }, []);

  useEffect(() => {
    setRows([emptyRow()]);
  }, [vehicleId]);

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const updateRow = (key: string, patch: Partial<ExpenseDraftRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));

  const isValid = Boolean(vehicleId) && rows.length > 0 && rows.every((r) => r.amount && Number(r.amount) > 0);

  const handleSubmit = async () => {
    if (!isValid) {
      toast(t("mobileExpenses.validAmount"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert(
        rows.map((r) => ({
          vehicle_id: vehicleId,
          category: r.category,
          amount: Number(r.amount),
          paid_by_partner_id: r.paid_by_partner_id || null,
          vendor: r.vendor.trim() || null,
          description: r.description.trim() || null,
          approval_status: "Approved",
          approved_by: user?.email ?? "Unknown",
          approved_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
      toast(t("mobileExpenses.addedCount", { count: rows.length }), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
      onNavigate("vehicle", { vehicleId, tab: "expenses" });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileExpenses.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileExpenses.addExpenses")} />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {vehicleId && (
        <>
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.key} className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <Field label={t("mobileExpenses.category")} required className="sm:col-span-2">
                    <Select value={row.category} onChange={(v) => updateRow(row.key, { category: v })} options={EXPENSE_CATEGORIES} />
                  </Field>
                  <Field label={t("mobileExpenses.amount")} required className="sm:col-span-2">
                    <input className="input" type="number" value={row.amount} onChange={(e) => updateRow(row.key, { amount: e.target.value })} placeholder="3500" />
                  </Field>
                  <Field label={t("mobileExpenses.vendor")} className="sm:col-span-2">
                    <input className="input" value={row.vendor} onChange={(e) => updateRow(row.key, { vendor: e.target.value })} placeholder="Sai Spares" />
                  </Field>
                  <Field label={t("mobileExpenses.description")} className="sm:col-span-3">
                    <input className="input" value={row.description} onChange={(e) => updateRow(row.key, { description: e.target.value })} placeholder="Brake pads + air filter" />
                  </Field>
                  <Field label={t("mobileExpenses.paidBy")} className="sm:col-span-2">
                    <Select value={row.paid_by_partner_id} onChange={(v) => updateRow(row.key, { paid_by_partner_id: v })} placeholder={t("mobileExpenses.business")} options={partners.map((p) => ({ value: p.id, label: p.name }))} />
                  </Field>
                  <div className="sm:col-span-1 flex justify-end">
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(row.key)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={addRow} className="btn-secondary btn-sm"><Plus size={14} /> {t("mobileExpenses.addRow")}</button>
            <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileExpenses.saveCount", { count: rows.length })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
