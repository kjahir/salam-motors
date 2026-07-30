import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, ClipboardCheck, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import { PageHeader, Field, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { SCORE_WEIGHTS } from "@/lib/constants";
import { QUICK_CHECK_CATEGORIES, CHECK_STATUS_SCORE, nextStatus, type CheckStatus } from "@/lib/inspectionChecklist";
import type { PageKey, NavigateParams } from "@/components/Layout";

// Desktop presentation of the shared Pass/Fail/Pending quick-check states — same
// semantics as the mobile Inspection screens (from @/lib/inspectionChecklist), rendered
// with desktop accent/slate tokens instead of mobile.* ones.
const STATUS_STYLE: Record<CheckStatus, { icon: typeof CheckCircle2; pill: string; card: string }> = {
  pass: { icon: CheckCircle2, pill: "bg-accent-50 text-accent-700 border-accent-200", card: "border-accent-200" },
  fail: { icon: XCircle, pill: "bg-red-50 text-red-700 border-red-200", card: "border-red-200" },
  pending: { icon: HelpCircle, pill: "bg-amber-50 text-amber-700 border-amber-200", card: "border-slate-200" },
};

const freshStatuses = () => Object.fromEntries(QUICK_CHECK_CATEGORIES.map((c) => [c, "pending" as CheckStatus]));

// Desktop counterpart to src/mobile/MobileAddInspection.tsx, now using the same quick
// checklist flow the mobile app uses: pick a vehicle, click each component to cycle
// Pass → Fail → Pending, add an optional summary, save once. Replaces the previous
// per-component 0–100 score builder, which lives on in VehicleDetail's Inspection tab
// for anyone who needs the granular numbers.
export function QuickAddInspection({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>(freshStatuses);
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStatuses(freshStatuses());
    setSummary("");
  }, [vehicleId]);

  const toggleRow = (category: string) => {
    setStatuses((s) => ({ ...s, [category]: nextStatus(s[category]) }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    let inspectionId: string | null = null;
    try {
      const { data: inspRec, error: inspErr } = await supabase.from("inspections").insert({
        vehicle_id: vehicleId,
        inspection_type: "Visual only",
        status: "completed",
        summary: summary.trim() || null,
      }).select().single();
      if (inspErr) throw inspErr;
      inspectionId = inspRec.id;

      const { error: itemsErr } = await supabase.from("inspection_items").insert(
        QUICK_CHECK_CATEGORIES.map((category) => {
          const scoring = CHECK_STATUS_SCORE[statuses[category]];
          return {
            inspection_id: inspectionId,
            category,
            score: scoring.score,
            condition_level: scoring.condition,
            weight: SCORE_WEIGHTS[category] ?? 0,
          };
        }),
      );
      if (itemsErr) throw itemsErr;

      toast(t("mobileInspection.saved"), "success");
      onNavigate("vehicle", { vehicleId, tab: "inspection" });
    } catch (e) {
      if (inspectionId) await supabase.from("inspections").delete().eq("id", inspectionId);
      toast(e instanceof Error ? e.message : t("mobileInspection.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const checkedCount = QUICK_CHECK_CATEGORIES.filter((c) => statuses[c] !== "pending").length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader
        title={t("mobileInspection.addTitle")}
        icon={<ClipboardCheck size={20} />}
        actions={
          vehicleId ? (
            <button onClick={() => onNavigate("vehicle", { vehicleId, tab: "inspection" })} className="btn-secondary">
              <ExternalLink size={16} /> {t("quickEntry.openVehicle")}
            </button>
          ) : undefined
        }
      />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {!vehicleId && (
        <Card className="p-6">
          <EmptyState icon={<ClipboardCheck size={20} />} title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleInspection")} />
        </Card>
      )}

      {vehicleId && (
        <>
          <p className="text-sm text-slate-500">{t("quickEntry.checklistHint", { checked: checkedCount, total: QUICK_CHECK_CATEGORIES.length })}</p>

          <div className="space-y-2">
            {QUICK_CHECK_CATEGORIES.map((category) => {
              const status = statuses[category];
              const style = STATUS_STYLE[status];
              const Icon = style.icon;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleRow(category)}
                  className={`card card-hover flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${style.card}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{category}</p>
                    <p className="text-xs text-slate-500">{t("quickEntry.weightClick", { weight: SCORE_WEIGHTS[category] ?? 0 })}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium ${style.pill}`}>
                    <Icon size={14} />
                    {t("mobileInspection." + status)}
                  </span>
                </button>
              );
            })}
          </div>

          <Card className="p-5">
            <Field label={t("mobileInspection.summary")}>
              <textarea
                className="input"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t("mobileInspection.summaryPlaceholder")}
              />
            </Field>
          </Card>

          <div className="flex justify-end">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileInspection.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
