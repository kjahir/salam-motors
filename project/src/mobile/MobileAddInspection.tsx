import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Field, Button } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { SCORE_WEIGHTS } from "@/lib/constants";
import { QUICK_CHECK_CATEGORIES, STATUS_META, nextStatus, type CheckStatus } from "./MobileInspectionTab";
import type { MobileNavigate } from "./MobileApp";

// Full-screen "Add Inspection" page: a multi-row builder over the same quick-check
// categories and Pass/Fail/Pending scoring semantics MobileInspectionTab.tsx already
// uses (imported, not reimplemented) — each tap cycles a row's status, one submit
// creates a new inspection record + its items, matching desktop VehicleDetail.tsx's
// repeatable "Add New Inspection" pattern (each submission is a fresh inspection; the
// most recent one becomes what the vehicle's Inspection tab shows). Vehicle picked via
// the dropdown at the top of the page rather than a pre-navigation picker Sheet.
export function MobileAddInspection({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>(
    () => Object.fromEntries(QUICK_CHECK_CATEGORIES.map((c) => [c, "pending" as CheckStatus])),
  );
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStatuses(Object.fromEntries(QUICK_CHECK_CATEGORIES.map((c) => [c, "pending" as CheckStatus])));
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
          const meta = STATUS_META[statuses[category]];
          return {
            inspection_id: inspectionId,
            category,
            score: meta.score,
            condition_level: meta.condition,
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

  return (
    <div>
      <TopBar title={t("mobileInspection.addTitle")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {vehicleId && (
          <>
            <div className="space-y-2">
              {QUICK_CHECK_CATEGORIES.map((category) => {
                const status = statuses[category];
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                return (
                  <Card key={category} className="p-3.5" onClick={() => toggleRow(category)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-mobile-text">{category}</p>
                        <p className="text-[10px] text-mobile-text-muted">{t("mobileInspection.weightTap", { weight: SCORE_WEIGHTS[category] ?? 0 })}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium ${meta.className}`}>
                        <Icon size={14} />
                        {t("mobileInspection." + status)}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="p-4">
              <Field label={t("mobileInspection.summary")}>
                <textarea
                  className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5"
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={t("mobileInspection.summaryPlaceholder")}
                />
              </Field>
            </Card>

            <Button className="w-full" onClick={handleSubmit} loading={submitting}>
              <Check size={16} /> {t("mobileInspection.save")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
