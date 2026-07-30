import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { VEHICLE_QUICK_FIELDS } from "@/lib/vehicleQuickFields";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface UpdateRow {
  key: string;
  field: string;
  value: string;
}

const emptyUpdateRow = (): UpdateRow => ({ key: crypto.randomUUID(), field: VEHICLE_QUICK_FIELDS[0].key, value: "" });

// Desktop counterpart to src/mobile/MobileUpdateVehicle.tsx: pick a vehicle, then
// repeatable rows of field + new value, one batched update. Field list is shared via
// VEHICLE_QUICK_FIELDS so the two surfaces can't drift.
export function UpdateVehicle({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
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
        const def = VEHICLE_QUICK_FIELDS.find((f) => f.key === row.field);
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
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileUpdateVehicle.title")} />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {vehicleId && (
        <>
          <div className="space-y-3">
            {rows.map((row) => {
              const def = VEHICLE_QUICK_FIELDS.find((f) => f.key === row.field) ?? VEHICLE_QUICK_FIELDS[0];
              return (
                <Card key={row.key} className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <Field label={t("mobileUpdateVehicle.field")} className="sm:col-span-5">
                      <Select
                        value={row.field}
                        onChange={(v) => updateRow(row.key, { field: v, value: "" })}
                        options={VEHICLE_QUICK_FIELDS.map((f) => ({ value: f.key, label: t(f.labelKey) }))}
                      />
                    </Field>
                    <Field label={t("mobileUpdateVehicle.newValue")} className="sm:col-span-6">
                      {def.type === "select" ? (
                        <Select
                          value={row.value}
                          onChange={(v) => updateRow(row.key, { value: v })}
                          placeholder={t("mobileUpdateVehicle.selectValue")}
                          options={def.options ?? []}
                        />
                      ) : (
                        <input
                          className="input"
                          type={def.type === "number" ? "number" : "text"}
                          value={row.value}
                          onChange={(e) => updateRow(row.key, { value: e.target.value })}
                        />
                      )}
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
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={addRow} className="btn-secondary btn-sm"><Plus size={14} /> {t("mobileUpdateVehicle.addField")}</button>
            <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileUpdateVehicle.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
