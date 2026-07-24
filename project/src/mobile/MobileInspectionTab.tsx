import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Card, Spinner } from "./ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SCORE_WEIGHTS } from "@/lib/constants";
import type { VehicleWithRelations, InspectionItem } from "@/lib/types";

// The mobile design's simple 6-item Pass/Fail/Pending checklist, mapped onto 6 of our
// real, weighted INSPECTION_CATEGORIES so the health-score ring stays accurate
// everywhere — several real categories have no SCORE_WEIGHTS entry and were excluded.
const QUICK_CHECK_CATEGORIES = ["Engine", "Brakes", "Tyres", "Suspension", "Frame and chassis", "Transmission and clutch"];

type CheckStatus = "pass" | "fail" | "pending";

function statusOf(item: InspectionItem): CheckStatus {
  if (item.condition_level === "Good") return "pass";
  if (item.condition_level === "Poor") return "fail";
  return "pending";
}

function nextStatus(s: CheckStatus): CheckStatus {
  if (s === "pending") return "pass";
  if (s === "pass") return "fail";
  return "pending";
}

const STATUS_META: Record<CheckStatus, { label: string; score: number | null; condition: string; icon: typeof CheckCircle2; className: string }> = {
  pass: { label: "Pass", score: 90, condition: "Good", icon: CheckCircle2, className: "bg-mobile-success-bg text-mobile-success" },
  fail: { label: "Fail", score: 30, condition: "Poor", icon: XCircle, className: "bg-mobile-error-bg text-mobile-error" },
  pending: { label: "Pending", score: null, condition: "Not inspected", icon: HelpCircle, className: "bg-mobile-warning-bg text-mobile-warning" },
};

export function MobileInspectionTab({ vehicle, overallScore, onChanged }: { vehicle: VehicleWithRelations; overallScore: number | null; onChanged: () => void }) {
  const seeded = useRef(false);
  const [seeding, setSeeding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const insp = (vehicle.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;

  useEffect(() => {
    if (seeded.current) return;
    if ((vehicle.inspections ?? []).length > 0) return;
    seeded.current = true;
    setSeeding(true);
    (async () => {
      try {
        const { data: inspRec, error: inspErr } = await supabase.from("inspections").insert({
          vehicle_id: vehicle.id,
          inspection_type: "Visual only",
          status: "completed",
        }).select().single();
        if (inspErr) throw inspErr;
        const { error: itemsErr } = await supabase.from("inspection_items").insert(
          QUICK_CHECK_CATEGORIES.map((category) => ({
            inspection_id: inspRec.id,
            category,
            score: null,
            condition_level: "Not inspected",
            weight: SCORE_WEIGHTS[category] ?? 0,
          })),
        );
        if (itemsErr) throw itemsErr;
        onChanged();
      } catch {
        toast("Failed to prepare inspection checklist", "error");
      } finally {
        setSeeding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const handleToggle = async (item: InspectionItem) => {
    const next = nextStatus(statusOf(item));
    const meta = STATUS_META[next];
    setUpdatingId(item.id);
    try {
      const { error } = await supabase
        .from("inspection_items")
        .update({ score: meta.score, condition_level: meta.condition })
        .eq("id", item.id);
      if (error) throw error;
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (seeding || !insp) {
    return <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>;
  }

  const items = insp.items ?? [];

  return (
    <div className="space-y-3 pt-3">
      <Card className="p-4">
        <div className="flex flex-col items-center">
          <ScoreRing score={overallScore} size={96} strokeWidth={8} label="Overall" />
        </div>
      </Card>
      <div className="space-y-2">
        {items.map((item) => {
          const status = statusOf(item);
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          return (
            <Card key={item.id} className="p-3.5" onClick={() => handleToggle(item)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-mobile-text">{item.category}</p>
                  <p className="text-[10px] text-mobile-text-muted">Weight {item.weight}% · tap to change</p>
                </div>
                <div className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium ${meta.className}`}>
                  {updatingId === item.id ? <Spinner size={12} /> : <Icon size={14} />}
                  {meta.label}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
