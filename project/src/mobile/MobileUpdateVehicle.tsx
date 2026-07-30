import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Field, Select, Input, Button } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { VEHICLE_QUICK_FIELDS as FIELD_DEFS } from "@/lib/vehicleQuickFields";
import type { MobileNavigate } from "./MobileApp";

interface UpdateRow {
  key: string;
  field: string;
  value: string;
}

const emptyUpdateRow = (): UpdateRow => ({ key: crypto.randomUUID(), field: FIELD_DEFS[0].key, value: "" });

// Full-screen "Update Vehicle" page: pick a vehicle, then repeatable rows of
// field + new value (add as many as needed), one batched update — the same
// dropdown-plus-line-item shape as Add Expense/Document/Inspection, but for editing
// existing vehicle columns instead of inserting new child records.
export function MobileUpdateVehicle({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [rows, setRows] = useState<UpdateRow[]>([emptyUpdateRow()]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setRows([emptyUpdateRow()]);
  }, [vehicleId]);

  const addRow = () => setRows((r) => [...r, emptyUpdateRow()]);
  const updateRow = (key: string, patch: Partial<UpdateRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));

  const filledRows = rows.filter((r) => r.value.trim() !== "");
  const isValid = Boolean(vehicleId) && filledRows.length > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      toast(t("mobileUpdateVehicle.needsValue"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const update: Record<string, string | number> = { updated_at: new Date().toISOString() };
      for (const row of filledRows) {
        const def = FIELD_DEFS.find((f) => f.key === row.field);
        if (!def) continue;
        update[def.key] = def.type === "number" ? Number(row.value) : row.value.trim();
      }
      if (typeof update.manufacturer === "string") update.brand = update.manufacturer;
      const { error } = await supabase.from("vehicles").update(update).eq("id", vehicleId);
      if (error) throw error;
      toast(t("mobileUpdateVehicle.updated"), "success");
      onNavigate("vehicle", { vehicleId });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileUpdateVehicle.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <TopBar title={t("mobileUpdateVehicle.title")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {vehicleId && (
          <>
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const def = FIELD_DEFS.find((f) => f.key === row.field) ?? FIELD_DEFS[0];
                return (
                  <Card key={row.key} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-mobile-text-muted uppercase">#{idx + 1}</p>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(row.key)} className="text-mobile-text-muted active:text-mobile-error p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <Field label={t("mobileUpdateVehicle.field")}>
                      <Select
                        value={row.field}
                        onChange={(v) => updateRow(row.key, { field: v, value: "" })}
                        options={FIELD_DEFS.map((f) => ({ value: f.key, label: t(f.labelKey) }))}
                      />
                    </Field>
                    <Field label={t("mobileUpdateVehicle.newValue")}>
                      {def.type === "select" ? (
                        <Select
                          value={row.value}
                          onChange={(v) => updateRow(row.key, { value: v })}
                          placeholder={t("mobileUpdateVehicle.selectValue")}
                          options={def.options ?? []}
                        />
                      ) : (
                        <Input
                          type={def.type === "number" ? "number" : "text"}
                          value={row.value}
                          onChange={(e) => updateRow(row.key, { value: e.target.value })}
                        />
                      )}
                    </Field>
                  </Card>
                );
              })}
            </div>

            <button
              onClick={addRow}
              className="flex items-center justify-center gap-1.5 w-full rounded-2xl border border-dashed border-mobile-border py-3 text-sm font-medium text-mobile-primary active:bg-mobile-bg"
            >
              <Plus size={16} /> {t("mobileUpdateVehicle.addField")}
            </button>

            <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!isValid}>
              <Check size={16} /> {t("mobileUpdateVehicle.save")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
