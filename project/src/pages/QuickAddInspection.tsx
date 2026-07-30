import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { fetchMechanics } from "@/lib/queries";
import { INSPECTION_CATEGORIES, INSPECTION_TYPES, ACCIDENT_STATUSES, CONDITION_LEVELS, SCORE_WEIGHTS } from "@/lib/constants";
import type { Party } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface ItemRow {
  key: string;
  category: string;
  score: string;
  condition_level: string;
  recommended_action: string;
  estimated_cost: string;
}

const emptyItemRow = (used: Set<string>): ItemRow => {
  const category = INSPECTION_CATEGORIES.find((c) => !used.has(c)) ?? INSPECTION_CATEGORIES[0];
  return { key: crypto.randomUUID(), category, score: "", condition_level: "Good", recommended_action: "", estimated_cost: "" };
};

// Desktop counterpart to src/mobile/MobileAddInspection.tsx, mirroring desktop's own
// richer inspection model (0-100 component scores + condition levels, not mobile's
// simplified Pass/Fail/Pending) — the exact "Add Inspection" logic from
// VehicleDetail.tsx's InspectionTab, relocated to its own page with a vehicle picker.
export function QuickAddInspection({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [mechanics, setMechanics] = useState<Party[]>([]);
  const [form, setForm] = useState({
    inspection_type: INSPECTION_TYPES[0],
    inspector_name: "",
    mechanic_party_id: "",
    accident_status: ACCIDENT_STATUSES[0],
    summary: "",
  });
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMechanics().then(setMechanics).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({ inspection_type: INSPECTION_TYPES[0], inspector_name: "", mechanic_party_id: "", accident_status: ACCIDENT_STATUSES[0], summary: "" });
    setItemRows([]);
  }, [vehicleId]);

  const addItemRow = () => setItemRows((rows) => [...rows, emptyItemRow(new Set(rows.map((r) => r.category)))]);
  const updateItemRow = (key: string, patch: Partial<ItemRow>) =>
    setItemRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeItemRow = (key: string) => setItemRows((rows) => rows.filter((r) => r.key !== key));

  const isValid = Boolean(vehicleId) && itemRows.length > 0 && itemRows.every((r) => r.score && Number(r.score) >= 0 && Number(r.score) <= 100);

  const handleSubmit = async () => {
    if (!isValid) {
      toast(t("mobileInspection.prepFailed", { defaultValue: "Add at least one component with a score between 0 and 100" }), "error");
      return;
    }
    setSubmitting(true);
    let inspectionId: string | null = null;
    const itemIds: string[] = [];
    const rollback = async () => {
      try {
        for (const id of itemIds) await supabase.from("inspection_items").delete().eq("id", id);
        if (inspectionId) await supabase.from("inspections").delete().eq("id", inspectionId);
      } catch {
        // best-effort cleanup; the original error is what gets surfaced to the user
      }
    };
    try {
      const { data: inspRec, error: inspErr } = await supabase.from("inspections").insert({
        vehicle_id: vehicleId,
        inspection_type: form.inspection_type,
        inspector_name: form.inspector_name.trim() || null,
        mechanic_party_id: form.mechanic_party_id || null,
        accident_status: form.accident_status,
        summary: form.summary.trim() || null,
        status: "completed",
      }).select().single();
      if (inspErr) throw inspErr;
      inspectionId = inspRec.id;

      for (const row of itemRows) {
        const { data: itemRec, error: itemErr } = await supabase.from("inspection_items").insert({
          inspection_id: inspectionId,
          category: row.category,
          score: Number(row.score),
          condition_level: row.condition_level,
          recommended_action: row.recommended_action.trim() || null,
          estimated_cost: Number(row.estimated_cost) || 0,
          weight: SCORE_WEIGHTS[row.category] ?? 0,
        }).select().single();
        if (itemErr) throw itemErr;
        itemIds.push(itemRec.id);
      }

      toast(t("mobileInspection.saved"), "success");
      onNavigate("vehicle", { vehicleId, tab: "inspection" });
    } catch (e) {
      await rollback();
      toast(e instanceof Error ? e.message : t("mobileInspection.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileInspection.addTitle")} />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {vehicleId && (
        <>
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Inspection Type" required>
                <Select value={form.inspection_type} onChange={(v) => setForm((f) => ({ ...f, inspection_type: v }))} options={[...INSPECTION_TYPES]} />
              </Field>
              <Field label="Accident Status" required>
                <Select value={form.accident_status} onChange={(v) => setForm((f) => ({ ...f, accident_status: v }))} options={[...ACCIDENT_STATUSES]} />
              </Field>
              <Field label="Inspector Name">
                <input className="input" value={form.inspector_name} onChange={(e) => setForm((f) => ({ ...f, inspector_name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
              </Field>
              <Field label="Mechanic (optional)">
                <Select
                  value={form.mechanic_party_id}
                  onChange={(v) => setForm((f) => ({ ...f, mechanic_party_id: v }))}
                  placeholder="Not linked"
                  options={mechanics.map((m) => ({ value: m.id, label: m.full_name }))}
                />
              </Field>
            </div>
            <Field label={t("mobileInspection.summary")}>
              <textarea className="input" rows={2} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder={t("mobileInspection.summaryPlaceholder")} />
            </Field>
          </Card>

          <div className="space-y-3">
            {itemRows.map((row) => (
              <Card key={row.key} className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <Field label="Category" required className="sm:col-span-3">
                    <Select
                      value={row.category}
                      onChange={(v) => updateItemRow(row.key, { category: v })}
                      options={INSPECTION_CATEGORIES.filter((c) => c === row.category || !itemRows.some((r) => r.category === c))}
                    />
                  </Field>
                  <Field label="Score (0-100)" required className="sm:col-span-2">
                    <input className="input" type="number" min={0} max={100} value={row.score} onChange={(e) => updateItemRow(row.key, { score: e.target.value })} placeholder="85" />
                  </Field>
                  <Field label="Condition" className="sm:col-span-2">
                    <Select value={row.condition_level} onChange={(v) => updateItemRow(row.key, { condition_level: v })} options={[...CONDITION_LEVELS]} />
                  </Field>
                  <Field label="Recommended Action" className="sm:col-span-3">
                    <input className="input" value={row.recommended_action} onChange={(e) => updateItemRow(row.key, { recommended_action: e.target.value })} placeholder="Optional" />
                  </Field>
                  <Field label="Est. Cost (₹)" className="sm:col-span-1">
                    <input className="input" type="number" value={row.estimated_cost} onChange={(e) => updateItemRow(row.key, { estimated_cost: e.target.value })} placeholder="0" />
                  </Field>
                  <div className="sm:col-span-1 flex justify-end">
                    <button onClick={() => removeItemRow(row.key)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={addItemRow} className="btn-secondary btn-sm" disabled={itemRows.length >= INSPECTION_CATEGORIES.length}>
              <Plus size={14} /> Add Component
            </button>
            <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileInspection.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
