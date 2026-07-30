import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Field, Select, Input, Button } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchPartners } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Partner } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

interface ExpenseDraftRow {
  category: string;
  amount: string;
  vendor: string;
  description: string;
  paid_by_partner_id: string;
}

const emptyRow = (): ExpenseDraftRow => ({ category: EXPENSE_CATEGORIES[0], amount: "", vendor: "", description: "", paid_by_partner_id: "" });

// Full-screen batch expense entry — same UX shape as desktop VehicleDetail.tsx's
// ExpensesTab "Add Expenses" panel (repeatable rows, add another row, one bulk insert),
// but as its own page instead of an inline panel embedded in a tab. The vehicle itself
// is now picked via the dropdown at the top of the page rather than a pre-navigation
// picker Sheet, so the page works whether or not a vehicle was already in context.
export function MobileAddExpense({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rows, setRows] = useState<ExpenseDraftRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  useEffect(() => {
    fetchPartners().then(setPartners);
  }, []);

  useEffect(() => {
    setRows([emptyRow()]);
  }, [vehicleId]);

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const updateRow = (idx: number, patch: Partial<ExpenseDraftRow>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeRow = (idx: number) => setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));

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
    <div>
      <TopBar title={t("mobileExpenses.addExpenses")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {vehicleId && <div className="space-y-3">
          {rows.map((row, idx) => (
            <Card key={idx} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-mobile-text-muted uppercase">#{idx + 1}</p>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="text-mobile-text-muted active:text-mobile-error p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <Field label={t("mobileExpenses.category")} required>
                <Select value={row.category} onChange={(v) => updateRow(idx, { category: v })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: trStatus(c) }))} />
              </Field>
              <Field label={t("mobileExpenses.amount")} required>
                <Input type="number" value={row.amount} onChange={(e) => updateRow(idx, { amount: e.target.value })} placeholder="3500" />
              </Field>
              <Field label={t("mobileExpenses.vendor")}>
                <Input value={row.vendor} onChange={(e) => updateRow(idx, { vendor: e.target.value })} placeholder="Sai Spares" />
              </Field>
              <Field label={t("mobileExpenses.description")}>
                <Input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} placeholder="Brake pads + air filter" />
              </Field>
              <Field label={t("mobileExpenses.paidBy")}>
                <Select value={row.paid_by_partner_id} onChange={(v) => updateRow(idx, { paid_by_partner_id: v })} placeholder={t("mobileExpenses.business")} options={partners.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
            </Card>
          ))}
        </div>}

        {vehicleId && (
          <button
            onClick={addRow}
            className="flex items-center justify-center gap-1.5 w-full rounded-2xl border border-dashed border-mobile-border py-3 text-sm font-medium text-mobile-primary active:bg-mobile-bg"
          >
            <Plus size={16} /> {t("mobileExpenses.addRow")}
          </button>
        )}

        {vehicleId && (
          <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!isValid}>
            <Check size={16} /> {t("mobileExpenses.saveCount", { count: rows.length })}
          </Button>
        )}
      </div>
    </div>
  );
}
