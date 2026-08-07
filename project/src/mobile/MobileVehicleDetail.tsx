import { useEffect, useMemo, useState } from "react";
import { Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner, Card, Tag, SegmentedTabs } from "./ui/primitives";
import { DeleteVehicleModal } from "@/components/DeleteVehicleModal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { formatINR, formatINRRange, formatDate, daysSince } from "@/lib/format";
import { computeCostBreakdown, computeProfit, computeOverallScore, documentCompleteness, computeEstimatedProfitRange } from "@/lib/calc";
import { fetchVehicleFull, fetchCompliancePolicies, fetchAppSettings } from "@/lib/queries";
import { evaluateVehicleCompliance, findViolatingRecordIds, acknowledgeViolation, isHardBlocking, type ComplianceViolation } from "@/lib/compliance";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { SEVERITY_RANK } from "@/lib/constants";
import type { UploadedFile } from "@/lib/uploadedFile";
import type { VehicleWithRelations, InspectionItem, CompliancePolicy, AppSettings } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";
import { MobileDocumentsTab } from "./MobileDocumentsTab";
import { MobileExpensesTab } from "./MobileExpensesTab";
import { MobileInspectionTab } from "./MobileInspectionTab";
import { MobileSaleTab } from "./MobileSaleTab";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];

export function MobileVehicleDetail({ vehicleId, onNavigate, onBack, initialTab, highlightPolicyId }: {
  vehicleId: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
  initialTab?: string;
  highlightPolicyId?: string;
}) {
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value.replace(/_/g, " ") });

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, highlightPolicyId, vehicleId]);

  const reload = async () => {
    const v = await fetchVehicleFull(vehicleId);
    setVehicle(v);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [v, pol, st] = await Promise.all([
        fetchVehicleFull(vehicleId),
        fetchCompliancePolicies(),
        fetchAppSettings(),
      ]);
      if (cancelled) return;
      setVehicle(v);
      setPolicies(pol);
      setSettings(st);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const cost = useMemo(() => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []), [vehicle]);
  const profit = useMemo(() => computeProfit(vehicle?.sale, cost), [vehicle, cost]);
  const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
  const marginHigh = settings?.estimated_profit_margin_high_pct ?? 30;
  const estRange = useMemo(
    () => computeEstimatedProfitRange(cost.totalVehicleCost, marginLow, marginHigh),
    [cost, marginLow, marginHigh],
  );
  const latestInspection = (vehicle?.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const inspectionItems = useMemo(() => latestInspection?.items ?? [], [latestInspection]);
  const overallScore = useMemo(() => computeOverallScore(inspectionItems), [inspectionItems]);
  const docCompleteness = useMemo(() => documentCompleteness(vehicle?.documents ?? []), [vehicle]);
  const complianceViolations = useMemo(
    () => (vehicle ? evaluateVehicleCompliance(vehicle, policies) : []),
    [vehicle, policies],
  );
  const highlightRecordIds = useMemo(() => {
    if (!vehicle || !highlightPolicyId) return [];
    const policy = policies.find((p) => p.id === highlightPolicyId);
    if (!policy) return [];
    return findViolatingRecordIds(vehicle, policy);
  }, [vehicle, policies, highlightPolicyId]);

  if (loading || !vehicle) {
    return (
      <div>
        <TopBar title={t("mobileVehicle.vehicle")} onBack={onBack} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  const isSold = SOLD_STATUSES.includes(vehicle.current_status) && vehicle.current_status !== "CANCELLED" && vehicle.current_status !== "WRITTEN_OFF";
  const days = daysSince(vehicle.onboarded_at);

  return (
    <div>
      <TopBar
        title={`${vehicle.manufacturer} ${vehicle.model}`}
        onBack={onBack}
        actions={
          <>
            {!isSold && (
              <button
                onClick={() => onNavigate("add-sale", { vehicleId })}
                className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-primary active:bg-mobile-bg"
                aria-label={t("dashboard.sellVehicle")}
              >
                <ShoppingCart size={17} />
              </button>
            )}
            <button onClick={() => onNavigate("edit-vehicle", { vehicleId })} className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-text-secondary active:bg-mobile-bg" aria-label={t("mobileVehicle.edit")}>
              <Pencil size={17} />
            </button>
            <button onClick={() => setShowDelete(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-error active:bg-mobile-bg" aria-label={t("mobileVehicle.delete")}>
              <Trash2 size={17} />
            </button>
          </>
        }
      />

      <div className="px-4 pt-3">
        <p className="text-xs text-mobile-text-muted font-mono">{vehicle.stock_number} · {vehicle.registration_number ?? t("mobileVehicle.noRegistration")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 pt-3">
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase"> {t("mobileVehicle.status")}</p>
          <div className="mt-1">
            <Tag color={isSold ? "success" : days >= 60 ? "error" : days >= 30 ? "warning" : "primary"}>{trStatus(vehicle.current_status)}</Tag>
          </div>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase"> {t("mobileVehicle.daysInStock")}</p>
          <p className="text-base font-poppins font-bold text-mobile-text mt-1">{days}d</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase"> {t("mobileVehicle.totalCost")}</p>
          <p className="text-base font-poppins font-bold text-mobile-text mt-1">{formatINR(cost.totalVehicleCost)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-mobile-text-muted uppercase">{isSold ? t("mobileVehicle.profit") : t("mobileVehicle.estProfit")}</p>
          <p className={`text-base font-poppins font-bold mt-1 ${profit ? (profit.grossProfit >= 0 ? "text-mobile-success" : "text-mobile-error") : "text-mobile-success"}`}>
            {profit ? formatINR(profit.grossProfit) : formatINRRange(estRange.low, estRange.high, { compact: true })}
          </p>
        </Card>
      </div>

      <div className="pt-4">
        <SegmentedTabs
          tabs={[
            { key: "overview", label: t("mobileVehicle.overview") },
            { key: "documents", label: t("mobileVehicle.documents"), badge: <Tag color="neutral">{vehicle.documents?.length ?? 0}</Tag> },
            { key: "expenses", label: t("mobileVehicle.expenses"), badge: <Tag color="neutral">{vehicle.expenses?.length ?? 0}</Tag> },
            { key: "inspection", label: t("mobileVehicle.inspection") },
            { key: "sale", label: t("mobileVehicle.sales") },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-4 pb-4">
        {tab === "overview" && (
          <OverviewTab
            vehicle={vehicle}
            overallScore={overallScore}
            docCompleteness={docCompleteness}
            complianceViolations={complianceViolations}
            onChanged={reload}
            onNavigate={onNavigate}
          />
        )}
        {tab === "documents" && <MobileDocumentsTab vehicle={vehicle} onChanged={reload} highlightIds={highlightRecordIds} onNavigate={onNavigate} />}
        {tab === "expenses" && <MobileExpensesTab vehicle={vehicle} onChanged={reload} highlightIds={highlightRecordIds} onNavigate={onNavigate} />}
        {tab === "inspection" && <MobileInspectionTab vehicle={vehicle} overallScore={overallScore} onChanged={reload} onNavigate={onNavigate} />}
        {tab === "sale" && (
          <MobileSaleTab
            vehicle={vehicle}
            profit={profit}
            complianceViolations={complianceViolations}
            onNavigate={onNavigate}
          />
        )}
      </div>

      {showDelete && (
        <DeleteVehicleModal vehicle={vehicle} open={showDelete} onClose={() => setShowDelete(false)} onDeleted={onBack} />
      )}
    </div>
  );
}

function PhotosCard({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const media = vehicle.media ?? [];
  const [files, setFiles] = useState<UploadedFile[]>(() =>
    media.filter((m) => m.file_url).map((m) => ({ path: m.file_url!, name: m.file_url!.split("/").pop() ?? "photo" })),
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    setFiles(media.filter((m) => m.file_url).map((m) => ({ path: m.file_url!, name: m.file_url!.split("/").pop() ?? "photo" })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.media]);

  const handleChange = async (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
    setSaving(true);
    try {
      const existingPaths = new Set(media.map((m) => m.file_url).filter(Boolean));
      const newPaths = new Set(newFiles.map((f) => f.path));
      const added = newFiles.filter((f) => !existingPaths.has(f.path));
      const removed = media.filter((m) => m.file_url && !newPaths.has(m.file_url));

      if (added.length > 0) {
        const { error } = await supabase.from("vehicle_media").insert(
          added.map((f) => ({ vehicle_id: vehicle.id, media_type: "photo", media_category: "general", file_url: f.path })),
        );
        if (error) throw error;
      }
      if (removed.length > 0) {
        const { error } = await supabase
          .from("vehicle_media")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", removed.map((m) => m.id));
        if (error) throw error;
        supabase
          .from("audit_logs")
          .insert({
            entity_type: "vehicle_media",
            entity_id: vehicle.id,
            action: "deleted",
            performed_by: user?.email ?? t("auth.user"),
            reason: t("mobileVehicle.photoRemovedReason", { count: removed.length, stock: vehicle.stock_number }),
          })
          .then(({ error: auditErr }) => {
            if (auditErr) console.error("Failed to log photo deletion", auditErr);
          });
      }
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("mobileVehicle.photosSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.photos")}</h3>
      <FileUploadGrid
        bucket="vehicle-photos"
        pathPrefix={vehicle.id}
        value={files}
        onChange={handleChange}
        hint={saving ? t("mobileVehicle.saving") : t("mobileVehicle.photoHint")}
        fileAccept="image/*"
      />
    </Card>
  );
}

function OverviewTab({ vehicle, overallScore, docCompleteness, complianceViolations, onChanged, onNavigate }: {
  vehicle: VehicleWithRelations;
  overallScore: number | null;
  docCompleteness: ReturnType<typeof documentCompleteness>;
  complianceViolations: ComplianceViolation[];
  onChanged: () => void;
  onNavigate: MobileNavigate;
}) {
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleAcknowledge = async (v: ComplianceViolation) => {
    setAcknowledgingId(v.policyId);
    try {
      await acknowledgeViolation(vehicle.id, v.policyId);
      toast(t("alertsPage.actionAcknowledged"), "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <div className="space-y-3 pt-3">
      <PhotosCard vehicle={vehicle} onChanged={onChanged} />

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.healthScore")}</h3>
        <div className="flex flex-col items-center">
          <ScoreRing score={overallScore} size={96} strokeWidth={8} label={t("mobileVehicle.overall")} />
        </div>
        <div className="mt-3 pt-3 border-t border-mobile-border flex items-center justify-between text-xs">
          <span className="text-mobile-text-muted"> {t("mobileVehicle.documents")}</span>
          <span className="font-medium text-mobile-text">{t("mobileVehicle.documentsVerified", { verified: docCompleteness.verified, total: docCompleteness.total })}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-mobile-border">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-mobile-text-muted"> {t("mobileVehicle.compliance")}</span>
            <Tag color={complianceViolations.length === 0 ? "success" : complianceViolations.some((v) => (SEVERITY_RANK[v.severity] ?? 0) >= SEVERITY_RANK.High) ? "error" : "warning"}>
              {complianceViolations.length === 0 ? t("mobileInventory.compliant") : t("mobileInventory.issueCount", { count: complianceViolations.length })}
            </Tag>
          </div>
          {complianceViolations.length > 0 && (
            <ul className="space-y-1.5">
              {complianceViolations.map((v) => {
                const alert = vehicle.alerts?.find((a) => a.policy_id === v.policyId);
                const acknowledged = alert?.status === "Acknowledged";
                return (
                  <li key={v.policyId} className="text-xs text-mobile-text-muted flex items-start justify-between gap-2">
                    <span className="flex items-start gap-1.5"><span className="text-mobile-border mt-0.5">•</span> {v.name}</span>
                    {!isHardBlocking(v) && (
                      acknowledged ? (
                        <Tag color="neutral">{t("status.Acknowledged")}</Tag>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(v)}
                          disabled={acknowledgingId === v.policyId}
                          className="text-mobile-primary font-medium shrink-0"
                        >
                          {acknowledgingId === v.policyId ? <Spinner size={12} /> : t("alertsPage.acknowledge")}
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.specifications")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Spec label={t("mobileVehicle.category")} value={vehicle.category} />
          <Spec label={t("mobileVehicle.fuelType")} value={vehicle.fuel_type} />
          <Spec label={t("passportPage.colour")} value={vehicle.colour} />
          <Spec label={t("passportPage.year")} value={String(vehicle.manufacture_year ?? "—")} />
          <Spec label={t("passportPage.odometer")} value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("en-IN")} km` : "—"} />
          <Spec label={t("passportPage.owners")} value={String(vehicle.owner_count)} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3"> {t("mobileVehicle.purchase")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Spec label={t("mobileVehicle.seller")} value={vehicle.purchase?.seller?.full_name} />
          <Spec label={t("mobileVehicle.sellerMobile")} value={vehicle.purchase?.seller?.mobile} />
          <Spec label={t("mobileVehicle.purchasePrice")} value={formatINR(vehicle.purchase?.agreed_price)} />
          <Spec label={t("mobileVehicle.purchaseDate")} value={formatDate(vehicle.purchase?.purchase_date)} />
        </div>
      </Card>

      <button
        onClick={() => onNavigate("edit-vehicle", { vehicleId: vehicle.id })}
        className="w-full text-center text-xs text-mobile-text-muted py-1"
      >
        {t("mobileVehicle.desktopFinancial")}
      </button>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-mobile-text-muted uppercase">{label}</p>
      <p className="text-xs font-medium text-mobile-text mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}
