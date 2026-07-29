import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner, Card, Field, Select, Input, Button } from "./ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchVehicleFull, fetchPartners } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Partner, Vehicle } from "@/lib/types";
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
// but as its own page instead of an inline panel embedded in a tab.
export function MobileAddExpense({ vehicleId, onNavigate, onBack }: {
  vehicleId: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExpenseDraftRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchVehicleFull(vehicleId), fetchPartners()]).then(([v, p]) => {
      if (cancelled) return;
      setVehicle(v);
      setPartners(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const updateRow = (idx: number, patch: Partial<ExpenseDraftRow>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeRow = (idx: number) => setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));

  const isValid = rows.length > 0 && rows.every((r) => r.amount && Number(r.amount) > 0);

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

  if (loading) {
    return (
      <div>
        <TopBar title={t("mobileExpenses.addExpenses")} onBack={onBack} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t("mobileExpenses.addExpenses")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        {vehicle && (
          <p className="text-xs text-mobile-text-muted font-mono">{vehicle.stock_number} · {vehicle.manufacturer} {vehicle.model}</p>
        )}

        <div className="space-y-3">
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
        </div>

        <button
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 w-full rounded-2xl border border-dashed border-mobile-border py-3 text-sm font-medium text-mobile-primary active:bg-mobile-bg"
        >
          <Plus size={16} /> {t("mobileExpenses.addRow")}
        </button>

        <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!isValid}>
          <Check size={16} /> {t("mobileExpenses.saveCount", { count: rows.length })}
        </Button>
      </div>
    </div>
  );
}
