import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Bike,
  Receipt,
  ClipboardCheck,
  FileText,
  ShoppingCart,
  TrendingUp,
  History,
  Plus,
  Trash2,
  Pencil,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Star,
} from "lucide-react";
import { PageHeader, Tabs, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge, VerificationBadge, ComplianceBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { InlineEditableField } from "@/components/ui/InlineEditableField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { EditVehicleModal } from "@/components/EditVehicleModal";
import { DeleteVehicleModal } from "@/components/DeleteVehicleModal";
import { formatINR, formatINRRange, formatDate, daysSince, formatPercent } from "@/lib/format";
import {
  computeCostBreakdown,
  computeProfit,
  computeOverallScore,
  computePartnerFunding,
  documentCompleteness,
  computeEstimatedProfitRange,
} from "@/lib/calc";
import { fetchVehicleFull, fetchPartners, fetchMechanics, fetchCompliancePolicies, fetchAppSettings } from "@/lib/queries";
import { completeSale } from "@/lib/sale";
import { supabase } from "@/lib/supabase";
import { PartyPickerField } from "@/components/PartyPickerField";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { isImageName, type UploadedFile } from "@/lib/uploadedFile";
import { evaluateVehicleCompliance, syncVehicleAlerts, findViolatingRecordIds, acknowledgeViolation, isHardBlocking, type ComplianceViolation } from "@/lib/compliance";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  DELIVERY_STATUSES,
  EXPENSE_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_VERIFICATION_STATUSES,
  INSPECTION_CATEGORIES,
  INSPECTION_TYPES,
  CONDITION_LEVELS,
  ACCIDENT_STATUSES,
  SCORE_WEIGHTS,
  SEVERITY_RANK,
} from "@/lib/constants";
import type { VehicleWithRelations, Partner, Party, Expense, VehicleDocument, Inspection, InspectionItem, MechanicInspectionFeedback, CompliancePolicy, AppSettings } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface VehicleDetailProps {
  vehicleId: string;
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  onBack: () => void;
  initialTab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
  /** Rendered inside another page (QuickViewVehicle), which owns the page-level navigation. */
  embedded?: boolean;
}

export function VehicleDetail({ vehicleId, onNavigate, onBack, initialTab, openEditVehicle, highlightPolicyId, embedded }: VehicleDetailProps) {
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
    if (openEditVehicle) setShowEditModal(true);
  }, [initialTab, openEditVehicle, highlightPolicyId, vehicleId]);

  const reload = async () => {
    try {
      const v = await fetchVehicleFull(vehicleId);
      setVehicle(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("vehicleDetail.failedToLoad"));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, p, pol, st] = await Promise.all([
          fetchVehicleFull(vehicleId),
          fetchPartners(),
          fetchCompliancePolicies(),
          fetchAppSettings(),
        ]);
        if (cancelled) return;
        setVehicle(v);
        setPartners(p);
        setPolicies(pol);
        setSettings(st);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("vehicleDetail.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, t]);

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

  const cost = useMemo(
    () => computeCostBreakdown(vehicle?.purchase, vehicle?.expenses ?? []),
    [vehicle],
  );
  const profit = useMemo(() => computeProfit(vehicle?.sale, cost), [vehicle, cost]);
  const funding = useMemo(() => computePartnerFunding(vehicle?.investments ?? []), [vehicle]);
  const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
  const marginHigh = settings?.estimated_profit_margin_high_pct ?? 30;
  const estRange = useMemo(
    () => computeEstimatedProfitRange(cost.totalVehicleCost, marginLow, marginHigh),
    [cost, marginLow, marginHigh],
  );

  const latestInspection = (vehicle?.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const inspectionItems: InspectionItem[] = useMemo(() => latestInspection?.items ?? [], [latestInspection]);
  const overallScore = useMemo(() => computeOverallScore(inspectionItems), [inspectionItems]);
  const docCompleteness = useMemo(
    () => documentCompleteness(vehicle?.documents ?? []),
    [vehicle],
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={onBack} className="btn-ghost mb-4"><ChevronLeft size={16} /> {t("vehicleDetail.back")}</button>
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("vehicleDetail.vehicleNotFound")} description={error ?? undefined} /></Card>
      </div>
    );
  }

  const days = daysSince(vehicle.onboarded_at);
  const isSold = vehicle.current_status === "SOLD" || vehicle.current_status === "DELIVERED";

  const navItems = [
    { key: "overview", label: t("vehicleDetail.overview"), badge: (vehicle.alerts?.filter((a) => a.status === "Open").length ?? 0) > 0 ? <Badge color="red">{vehicle.alerts?.filter((a) => a.status === "Open").length}</Badge> : undefined },
    { key: "expenses", label: t("vehicleDetail.expenses"), badge: <Badge color="slate">{vehicle.expenses?.length ?? 0}</Badge> },
    { key: "inspection", label: t("vehicleDetail.inspection") },
    { key: "documents", label: t("vehicleDetail.documents"), badge: <Badge color="slate">{vehicle.documents?.length ?? 0}</Badge> },
    { key: "sale", label: t("vehicleDetail.saleProfit") },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {!embedded && (
        <button onClick={onBack} className="btn-ghost mb-3 text-sm"><ChevronLeft size={16} /> {t("vehicleDetail.backToInventory")}</button>
      )}

      <PageHeader
        title={`${vehicle.manufacturer} ${vehicle.model}`}
        description={`${vehicle.stock_number} · ${vehicle.registration_number ?? t("vehicleDetail.noRegistration")} · ${vehicle.manufacture_year ?? "—"}`}
        icon={<Bike size={20} />}
        actions={
          <>
            {!isSold && (
              <button onClick={() => setTab("sale")} className="btn-primary">
                <ShoppingCart size={16} /> {t("dashboard.sellVehicle")}
              </button>
            )}
            <button onClick={() => onNavigate("passport", { vehicleId: vehicle.id })} className="btn-secondary">
              <Share2 size={16} /> {t("vehicleDetail.viewPassport")}
            </button>
            <button onClick={() => setShowEditModal(true)} className="btn-secondary">
              <Pencil size={16} /> {t("vehicleDetail.edit")}
            </button>
            <button onClick={() => setShowDeleteModal(true)} className="btn-secondary text-red-600 hover:bg-red-50">
              <Trash2 size={16} /> {t("vehicleDetail.delete")}
            </button>
          </>
        }
      />

      {showEditModal && (
        <EditVehicleModal
          vehicle={vehicle}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={reload}
        />
      )}
      {showDeleteModal && (
        <DeleteVehicleModal
          vehicle={vehicle}
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={onBack}
        />
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="p-4">
          <p className="stat-label">{t("vehicleDetail.status")}</p>
          <div className="mt-1.5"><StatusBadge status={vehicle.current_status} /></div>
        </Card>
        <Card className="p-4">
          <p className="stat-label">{t("vehicleDetail.daysInStock")}</p>
          <p className="stat-value mt-1.5">{isSold ? `${Math.round((new Date(vehicle.sold_at ?? vehicle.onboarded_at).getTime() - new Date(vehicle.onboarded_at).getTime()) / 86400000)}d` : `${days}d`}</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">{t("vehicleDetail.totalVehicleCost")}</p>
          <p className="stat-value mt-1.5">{formatINR(cost.totalVehicleCost)}</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">{isSold ? t("vehicleDetail.realisedProfit") : t("vehicleDetail.estimatedProfit")}</p>
          <p className={`stat-value mt-1.5 ${profit ? (profit.grossProfit >= 0 ? "text-emerald-600" : "text-red-600") : "text-emerald-600"}`}>
            {profit ? formatINR(profit.grossProfit) : formatINRRange(estRange.low, estRange.high, { compact: true })}
          </p>
          {!profit && <p className="text-xs text-slate-400 mt-0.5">{t("vehicleDetail.marginOfCost", { low: marginLow, high: marginHigh })}</p>}
        </Card>
      </div>

      <Tabs tabs={navItems} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === "overview" && (
          <OverviewTab
            vehicle={vehicle}
            cost={cost}
            profit={profit}
            overallScore={overallScore}
            docCompleteness={docCompleteness}
            funding={funding}
            complianceViolations={complianceViolations}
            onNavigate={onNavigate}
            onChanged={reload}
          />
        )}
        {tab === "expenses" && <ExpensesTab vehicle={vehicle} cost={cost} partners={partners} onChanged={reload} highlightIds={highlightRecordIds} />}
        {tab === "inspection" && <InspectionTab vehicle={vehicle} overallScore={overallScore} onChanged={reload} />}
        {tab === "documents" && <DocumentsTab vehicle={vehicle} onChanged={reload} highlightIds={highlightRecordIds} />}
        {tab === "sale" && <SaleTab vehicle={vehicle} cost={cost} profit={profit} funding={funding} partners={partners} marginLow={marginLow} marginHigh={marginHigh} complianceViolations={complianceViolations} onChanged={reload} />}
      </div>
    </div>
  );
}

function PhotosCard({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const { t } = useTranslation();
  const media = vehicle.media ?? [];
  const [files, setFiles] = useState<UploadedFile[]>(() =>
    media.filter((m) => m.file_url).map((m) => ({ path: m.file_url!, name: m.file_url!.split("/").pop() ?? "photo" })),
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
            performed_by: user?.email ?? "Unknown",
            reason: `Removed ${removed.length} photo${removed.length === 1 ? "" : "s"} from ${vehicle.stock_number}`,
          })
          .then(({ error: auditErr }) => {
            if (auditErr) console.error("Failed to log photo deletion", auditErr);
          });
      }
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("vehicleDetail.photosSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleDetail.photos")}</h3>
      <FileUploadGrid
        bucket="vehicle-photos"
        pathPrefix={vehicle.id}
        value={files}
        onChange={handleChange}
        label=""
        hint={saving ? t("vehicleDetail.saving") : t("vehicleDetail.photosHint")}
        fileAccept="image/*"
      />
    </Card>
  );
}

// ============ OVERVIEW ============
function OverviewTab({ vehicle, cost, profit, overallScore, docCompleteness, funding, complianceViolations, onNavigate, onChanged }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  overallScore: number | null;
  docCompleteness: ReturnType<typeof documentCompleteness>;
  funding: ReturnType<typeof computePartnerFunding>;
  complianceViolations: ComplianceViolation[];
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

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
    <div className="space-y-5">
    <PhotosCard vehicle={vehicle} onChanged={onChanged} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{t("vehicleDetail.vehicleSpecifications")}</h3>
          <button
            onClick={() => onNavigate("history", { historyVehicleId: vehicle.id })}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            <History size={13} /> {t("vehicleDetail.viewFullHistory")}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          <Spec label={t("vehicleDetail.category")} value={vehicle.category} />
          <Spec label={t("vehicleDetail.fuelType")} value={vehicle.fuel_type} />
          <Spec label={t("vehicleDetail.colour")} value={vehicle.colour} />
          <Spec label={t("vehicleDetail.year")} value={String(vehicle.manufacture_year ?? "—")} />
          <Spec label={t("vehicleDetail.odometer")} value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("en-IN")} km` : "—"} />
          <Spec label={t("vehicleDetail.previousOwners")} value={String(vehicle.owner_count)} />
          <Spec label={t("vehicleDetail.registrationDate")} value={formatDate(vehicle.registration_date)} />
          <Spec label={t("vehicleDetail.registrationCity")} value={vehicle.registration_city} />
          <Spec label={t("vehicleDetail.registrationState")} value={vehicle.registration_state} />
          <Spec label={t("vehicleDetail.chassis")} value={vehicle.chassis_number} />
          <Spec label={t("vehicleDetail.engine")} value={vehicle.engine_number} />
          <Spec label={t("vehicleDetail.currentLocation")} value={vehicle.current_location} />
        </div>
        {vehicle.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">{t("vehicleDetail.notes")}</p>
            <p className="text-sm text-slate-700">{vehicle.notes}</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleDetail.healthScore")}</h3>
        <div className="flex flex-col items-center">
          <ScoreRing score={overallScore} label={t("vehicleDetail.overallScore")} />
          <p className="text-xs text-slate-500 mt-3 text-center">
            {overallScore === null
              ? t("vehicleDetail.noInspection")
              : overallScore >= 70
                ? t("vehicleDetail.goodCondition")
                : t("vehicleDetail.needsAttention")}
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{t("vehicleDetail.documents")}</span>
            <span className="font-medium">{t("vehicleDetail.documentsVerified", { verified: docCompleteness.verified, total: docCompleteness.total })}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${docCompleteness.pct}%` }} />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-500">{t("vehicleDetail.compliance")}</span>
            <ComplianceBadge
              violationCount={complianceViolations.length}
              maxSeverityRank={complianceViolations.reduce((max, v) => Math.max(max, SEVERITY_RANK[v.severity] ?? 0), 0)}
            />
          </div>
          {complianceViolations.length > 0 && (
            <ul className="space-y-1.5">
              {complianceViolations.map((v) => {
                const alert = vehicle.alerts?.find((a) => a.policy_id === v.policyId);
                const acknowledged = alert?.status === "Acknowledged";
                return (
                  <li key={v.policyId} className="text-xs text-slate-500 flex items-start justify-between gap-2">
                    <span className="flex items-start gap-1.5"><span className="text-slate-300 mt-0.5">•</span> {v.name}</span>
                    {!isHardBlocking(v) && (
                      acknowledged ? (
                        <Badge color="slate">{t("status.Acknowledged")}</Badge>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(v)}
                          disabled={acknowledgingId === v.policyId}
                          className="text-brand-600 hover:text-brand-700 font-medium shrink-0"
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

      <Card className="p-5 lg:col-span-3">
        <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleDetail.financialSummary")}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {vehicle.purchase && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pb-4 mb-4 border-b border-slate-100">
                <Spec label={t("vehicleDetail.agreedPrice")} value={formatINR(vehicle.purchase.agreed_price)} />
                <Spec label={t("vehicleDetail.brokerCommission")} value={formatINR(vehicle.purchase.broker_commission)} />
                <Spec label={t("vehicleDetail.purchaseFees")} value={formatINR(vehicle.purchase.other_fee)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Spec label={t("vehicleDetail.purchaseCost")} value={formatINR(cost.purchaseCost)} />
              <Spec label={t("vehicleDetail.refurbishment")} value={formatINR(cost.refurbishmentCost)} />
              <Spec label={t("vehicleDetail.holdingCost")} value={formatINR(cost.holdingCost)} />
              <Spec label={t("vehicleDetail.logisticsCost")} value={formatINR(cost.logisticsCost)} />
              <Spec label={t("vehicleDetail.docsSelling")} value={formatINR(cost.documentationSellingCost)} />
              <Spec label={t("vehicleDetail.otherCost")} value={formatINR(cost.otherCost)} />
            </div>
          </div>

          <div className="lg:pl-6 lg:border-l lg:border-slate-100">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("vehicleDetail.salesSummary")}</h4>
            {vehicle.purchase && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Spec label={t("vehicleDetail.seller")} value={vehicle.purchase.seller?.full_name} />
                <Spec label={t("vehicleDetail.sellerMobile")} value={vehicle.purchase.seller?.mobile} />
                <Spec label={t("vehicleDetail.purchaseDate")} value={formatDate(vehicle.purchase.purchase_date, { withTime: true })} />
                <Spec label={t("vehicleDetail.handoverLocation")} value={vehicle.purchase.handover_location} />
                <Spec label={t("vehicleDetail.odometerAtPurchase")} value={vehicle.purchase.odometer_at_purchase ? `${vehicle.purchase.odometer_at_purchase.toLocaleString("en-IN")} km` : "—"} />
                <Spec label={t("vehicleDetail.keysReceived")} value={vehicle.purchase.keys_received ? t("vehicleDetail.yes") : t("vehicleDetail.no")} />
                <Spec label={t("vehicleDetail.documentsReceived")} value={vehicle.purchase.documents_received ? t("vehicleDetail.yes") : t("vehicleDetail.no")} />
                <Spec label={t("vehicleDetail.paymentStatus")} value={vehicle.purchase.payment_status} />
              </div>
            )}
            {vehicle.purchase?.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">{t("vehicleDetail.purchaseNotes")}</p>
                <p className="text-sm text-slate-700">{vehicle.purchase.notes}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-900">{t("vehicleDetail.totalVehicleCost")}</span>
              <span className="text-lg font-bold text-slate-900">{formatINR(cost.totalVehicleCost)}</span>
            </div>

            {vehicle.sale && profit && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("vehicleDetail.sellingPrice")}</span>
                  <span className="text-sm font-medium">{formatINR(vehicle.sale.sale_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("vehicleDetail.profit")}</span>
                  <span className={`text-sm font-bold ${profit.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatINR(profit.grossProfit)}</span>
                </div>
              </div>
            )}

            {vehicle.purchase?.payments && vehicle.purchase.payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("vehicleDetail.paymentRecords")}</h4>
                <div className="space-y-2">
                  {vehicle.purchase.payments.map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{formatINR(pay.amount)}</p>
                        <p className="text-xs text-slate-500">{pay.payment_method} · {formatDate(pay.paid_at, { withTime: true })}</p>
                        {pay.reference && <p className="text-xs text-slate-400 font-mono mt-0.5">{pay.reference}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {funding.length > 0 && (
        <Card className="p-5 lg:col-span-3">
          <h3 className="font-semibold text-slate-900 mb-4">{t("vehicleDetail.partnerFunding")}</h3>
          <div className="space-y-3">
            {funding.map((f) => {
              const partner = vehicle.investments?.find((i) => i.partner_id === f.partnerId)?.partner;
              return (
                <div key={f.partnerId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{partner?.name ?? "—"}</span>
                    <span className="text-slate-600">{formatINR(f.totalInvested)}</span>
                  </div>
                  <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${f.fundingPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t("vehicleDetail.fundingPct", { pct: formatPercent(f.fundingPct, 1) })}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}


// ============ EXPENSES ============
interface ExpenseDraftRow {
  category: string;
  amount: string;
  vendor: string;
  description: string;
  paid_by_partner_id: string;
  bill_available: boolean;
}

const emptyExpenseRow = (): ExpenseDraftRow => ({ category: "Spare parts", amount: "", vendor: "", description: "", paid_by_partner_id: "", bill_available: false });

function ExpensesTab({ vehicle, cost, partners, onChanged, highlightIds }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  partners: Partner[];
  onChanged: () => void;
  highlightIds?: string[];
}) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [rows, setRows] = useState<ExpenseDraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeHighlights, setActiveHighlights] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!highlightIds || highlightIds.length === 0) return;
    setActiveHighlights(new Set(highlightIds));
    const el = document.getElementById(`expense-row-${highlightIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setActiveHighlights(new Set()), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIds?.join(",")]);

  const openAddPanel = () => {
    setRows((r) => (r.length === 0 ? [emptyExpenseRow()] : r));
    setShowAddPanel(true);
  };

  const closeAddPanel = () => {
    setShowAddPanel(false);
    setRows([]);
  };

  const addRow = () => setRows((r) => [...r, emptyExpenseRow()]);
  const updateRow = (idx: number, patch: Partial<ExpenseDraftRow>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const handleSaveBatch = async () => {
    if (rows.length === 0 || rows.some((r) => !r.amount || Number(r.amount) <= 0)) {
      toast("Add at least one expense with a valid amount", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert(
        rows.map((r) => ({
          vehicle_id: vehicle.id,
          category: r.category,
          amount: Number(r.amount),
          paid_by_partner_id: r.paid_by_partner_id || null,
          vendor: r.vendor.trim() || null,
          description: r.description.trim() || null,
          bill_available: r.bill_available,
          approval_status: "Approved",
          approved_by: user?.email ?? "Unknown",
          approved_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
      toast(`${rows.length} expense${rows.length === 1 ? "" : "s"} added`, "success");
      closeAddPanel();
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save expenses", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const saveField = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    syncVehicleAlerts(vehicle.id).catch(() => {});
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({ entity_type: "expense", entity_id: id, action: "deleted", performed_by: user?.email ?? "Unknown" })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log expense deletion", auditErr);
        });
      toast("Expense removed", "success");
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const [evidenceLightbox, setEvidenceLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const handleViewEvidence = (e: Expense) => {
    const paths = e.bill_urls?.length ? e.bill_urls : e.bill_url ? [e.bill_url] : [];
    if (paths.length === 0) return;
    setEvidenceLightbox({
      items: paths.map((path) => ({
        name: path.split("/").pop() ?? path,
        isImage: isImageName(path),
        resolve: async () => {
          const { data, error } = await supabase.storage.from("finance-proofs").createSignedUrl(path, 300);
          if (error) throw error;
          return data.signedUrl;
        },
      })),
      index: 0,
    });
  };

  const handleApprove = async (e: Expense) => {
    try {
      const { error } = await supabase.from("expenses").update({ approval_status: "Approved", approved_by: user?.email ?? "Unknown", approved_at: new Date().toISOString() }).eq("id", e.id);
      if (error) throw error;
      toast("Expense approved", "success");
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    }
  };

  const total = (vehicle.expenses ?? []).filter((e) => e.approval_status === "Approved" || e.approval_status === "Paid").reduce((s, e) => s + e.amount, 0);
  const pending = (vehicle.expenses ?? []).filter((e) => e.approval_status === "Submitted" || e.approval_status === "Draft").length;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Purchase Value</span>
          <span className="font-medium text-slate-800">{formatINR(cost.purchaseCost)}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Running Total (Vehicle Cost)</span>
          <span className="text-lg font-bold text-slate-900">{formatINR(cost.totalVehicleCost)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4"><p className="stat-label">Total Approved Expenses</p><p className="stat-value mt-1">{formatINR(total)}</p></Card>
        <Card className="p-4"><p className="stat-label">Pending Approval</p><p className="stat-value mt-1">{pending}</p></Card>
        <Card className="p-4"><p className="stat-label">Total Records</p><p className="stat-value mt-1">{vehicle.expenses?.length ?? 0}</p></Card>
      </div>

      {showAddPanel && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-800">Add Expenses</h4>
            <button onClick={addRow} className="btn-secondary btn-sm"><Plus size={14} /> Add Row</button>
          </div>
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg border border-slate-200 p-3">
                <Field label="Category" required className="sm:col-span-2">
                  <Select value={row.category} onChange={(v) => updateRow(idx, { category: v })} options={EXPENSE_CATEGORIES} />
                </Field>
                <Field label="Amount (₹)" required className="sm:col-span-2">
                  <input className="input" type="number" value={row.amount} onChange={(e) => updateRow(idx, { amount: e.target.value })} placeholder="3500" />
                </Field>
                <Field label="Vendor" className="sm:col-span-2">
                  <input className="input" value={row.vendor} onChange={(e) => updateRow(idx, { vendor: e.target.value })} placeholder="Sai Spares" />
                </Field>
                <Field label="Description" className="sm:col-span-3">
                  <input className="input" value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} placeholder="Brake pads + air filter" />
                </Field>
                <Field label="Paid By" className="sm:col-span-2">
                  <Select value={row.paid_by_partner_id} onChange={(v) => updateRow(idx, { paid_by_partner_id: v })} placeholder="Business" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
                </Field>
                <div className="sm:col-span-1 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={row.bill_available} onChange={(e) => updateRow(idx, { bill_available: e.target.checked })} className="rounded border-slate-300" />
                    Bill
                  </label>
                  <button onClick={() => removeRow(idx)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={closeAddPanel} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveBatch} disabled={submitting || rows.length === 0} className="btn-primary">
              {submitting ? <Spinner size={14} /> : null} Save {rows.length} Expense{rows.length === 1 ? "" : "s"}
            </button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Expense Records</h3>
          {!showAddPanel && <button onClick={openAddPanel} className="btn-primary btn-sm"><Plus size={14} /> Add Expenses</button>}
        </div>
        {vehicle.expenses && vehicle.expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Category</th><th className="pb-2 font-medium">Vendor</th><th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium">Paid By</th><th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Bill</th><th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.expenses.map((e) => (
                  <tr
                    key={e.id}
                    id={`expense-row-${e.id}`}
                    className={`hover:bg-slate-50 transition-colors ${activeHighlights.has(e.id) ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : ""}`}
                  >
                    <td className="py-2.5">
                      <InlineEditableField
                        type="select"
                        value={e.category}
                        options={EXPENSE_CATEGORIES}
                        onSave={(next) => saveField(e.id, { category: String(next) })}
                        className="font-medium text-slate-900"
                      />
                      <InlineEditableField
                        type="text"
                        value={e.description ?? ""}
                        placeholder="Add description"
                        onSave={(next) => saveField(e.id, { description: String(next) || null })}
                        className="text-xs text-slate-500"
                      />
                    </td>
                    <td className="py-2.5 text-slate-600">
                      <InlineEditableField
                        type="text"
                        value={e.vendor ?? ""}
                        placeholder="Add vendor"
                        onSave={(next) => saveField(e.id, { vendor: String(next) || null })}
                      />
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      <InlineEditableField
                        type="number"
                        value={e.amount}
                        formatDisplay={(v) => formatINR(Number(v))}
                        onSave={(next) => saveField(e.id, { amount: Number(next) })}
                        className="justify-end"
                      />
                    </td>
                    <td className="py-2.5 text-slate-600">
                      <InlineEditableField
                        type="select"
                        value={e.paid_by_partner_id ?? ""}
                        options={partners.map((p) => ({ value: p.id, label: p.name }))}
                        placeholder="Business"
                        formatDisplay={(v) => (v ? partners.find((p) => p.id === v)?.name ?? String(v) : "Business")}
                        onSave={(next) => saveField(e.id, { paid_by_partner_id: next || null })}
                      />
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">{formatDate(e.expense_date)}</td>
                    <td className="py-2.5">
                      {e.bill_url ? (
                        <button onClick={() => handleViewEvidence(e)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">View</button>
                      ) : e.bill_available ? (
                        <Badge color="emerald">Yes</Badge>
                      ) : (
                        <Badge color="slate">No</Badge>
                      )}
                    </td>
                    <td className="py-2.5">
                      <InlineEditableField
                        type="select"
                        value={e.approval_status}
                        options={EXPENSE_STATUSES}
                        formatDisplay={(v) => <Badge color={v === "Approved" ? "emerald" : v === "Submitted" ? "amber" : v === "Rejected" ? "red" : "slate"}>{String(v)}</Badge>}
                        onSave={(next) => saveField(e.id, { approval_status: String(next) })}
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      {e.approval_status === "Submitted" && <button onClick={() => handleApprove(e)} className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-2">Approve</button>}
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Receipt size={20} />} title="No expenses recorded" description="Add refurbishment, transportation, or other vehicle expenses." />
        )}
      </Card>

      {evidenceLightbox && (
        <Lightbox
          items={evidenceLightbox.items}
          index={evidenceLightbox.index}
          onClose={() => setEvidenceLightbox(null)}
          onIndexChange={(index) => setEvidenceLightbox((s) => (s ? { ...s, index } : s))}
        />
      )}
    </div>
  );
}

// ============ INSPECTION ============
function InspectionTab({ vehicle, overallScore, onChanged }: { vehicle: VehicleWithRelations; overallScore: number | null; onChanged: () => void }) {
  const { t } = useTranslation();
  const insp = (vehicle.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const [mechanics, setMechanics] = useState<Party[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ mechanic_party_id: "", rating: "3", feedback_text: "", areas_of_concern: "", recommended_actions: "" });
  const [showAddInspection, setShowAddInspection] = useState(false);
  const [inspectionForm, setInspectionForm] = useState({
    inspection_type: INSPECTION_TYPES[0],
    inspector_name: "",
    mechanic_party_id: "",
    accident_status: ACCIDENT_STATUSES[0],
    summary: "",
  });
  const [itemRows, setItemRows] = useState<{ category: string; score: string; condition_level: string; recommended_action: string; estimated_cost: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const addItemRow = () => {
    const used = new Set(itemRows.map((r) => r.category));
    const nextCategory = INSPECTION_CATEGORIES.find((c) => !used.has(c)) ?? INSPECTION_CATEGORIES[0];
    setItemRows((rows) => [...rows, { category: nextCategory, score: "", condition_level: "Good", recommended_action: "", estimated_cost: "" }]);
  };

  const updateItemRow = (idx: number, patch: Partial<{ category: string; score: string; condition_level: string; recommended_action: string; estimated_cost: string }>) => {
    setItemRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeItemRow = (idx: number) => {
    setItemRows((rows) => rows.filter((_, i) => i !== idx));
  };

  const resetInspectionForm = () => {
    setInspectionForm({ inspection_type: INSPECTION_TYPES[0], inspector_name: "", mechanic_party_id: "", accident_status: ACCIDENT_STATUSES[0], summary: "" });
    setItemRows([]);
  };

  const handleAddInspection = async () => {
    if (itemRows.length === 0 || itemRows.some((r) => !r.score || Number(r.score) < 0 || Number(r.score) > 100)) {
      toast("Add at least one component with a score between 0 and 100", "error");
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
        vehicle_id: vehicle.id,
        inspection_type: inspectionForm.inspection_type,
        inspector_name: inspectionForm.inspector_name.trim() || null,
        mechanic_party_id: inspectionForm.mechanic_party_id || null,
        accident_status: inspectionForm.accident_status,
        summary: inspectionForm.summary.trim() || null,
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

      toast("Inspection added", "success");
      setShowAddInspection(false);
      resetInspectionForm();
      onChanged();
    } catch (e) {
      await rollback();
      toast(e instanceof Error ? `${e.message} — rolled back.` : "Failed to add inspection.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchMechanics().then(setMechanics).catch(() => { /* ignore */ });
  }, []);

  const feedback = (vehicle.mechanic_feedback ?? []) as (MechanicInspectionFeedback & { mechanic?: Party | null })[];

  const handleAddFeedback = async () => {
    if (!feedbackForm.mechanic_party_id || !feedbackForm.feedback_text.trim()) {
      toast("Select a mechanic and enter feedback text", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("mechanic_inspection_feedback").insert({
        vehicle_id: vehicle.id,
        mechanic_party_id: feedbackForm.mechanic_party_id,
        inspection_id: insp?.id ?? null,
        rating: Number(feedbackForm.rating),
        feedback_text: feedbackForm.feedback_text.trim(),
        areas_of_concern: feedbackForm.areas_of_concern.trim() || null,
        recommended_actions: feedbackForm.recommended_actions.trim() || null,
        status: "Submitted",
      });
      if (error) throw error;
      toast("Mechanic feedback added", "success");
      setShowFeedback(false);
      setFeedbackForm({ mechanic_party_id: "", rating: "3", feedback_text: "", areas_of_concern: "", recommended_actions: "" });
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const addInspectionPanel = showAddInspection ? (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-slate-800">Add Inspection</h4>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Inspection Type" required>
            <Select value={inspectionForm.inspection_type} onChange={(v) => setInspectionForm((f) => ({ ...f, inspection_type: v }))} options={[...INSPECTION_TYPES]} />
          </Field>
          <Field label="Accident Status" required>
            <Select value={inspectionForm.accident_status} onChange={(v) => setInspectionForm((f) => ({ ...f, accident_status: v }))} options={[...ACCIDENT_STATUSES]} />
          </Field>
          <Field label="Inspector Name">
            <input className="input" value={inspectionForm.inspector_name} onChange={(e) => setInspectionForm((f) => ({ ...f, inspector_name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
          </Field>
          <Field label="Mechanic (optional)">
            <Select
              value={inspectionForm.mechanic_party_id}
              onChange={(v) => setInspectionForm((f) => ({ ...f, mechanic_party_id: v }))}
              placeholder="Not linked"
              options={mechanics.map((m) => ({ value: m.id, label: m.full_name }))}
            />
          </Field>
        </div>
        <Field label="Summary">
          <textarea className="input" rows={2} value={inspectionForm.summary} onChange={(e) => setInspectionForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Overall condition summary…" />
        </Field>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-800">Component Scores <span className="text-red-500">*</span></h4>
            <button onClick={addItemRow} className="btn-secondary btn-sm" disabled={itemRows.length >= INSPECTION_CATEGORIES.length}><Plus size={14} /> Add Component</button>
          </div>
          {itemRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">Add at least one component score.</p>
              <button onClick={addItemRow} className="btn-primary btn-sm"><Plus size={14} /> Add Component</button>
            </div>
          ) : (
            <div className="space-y-3">
              {itemRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg border border-slate-200 p-3">
                  <Field label="Category" required className="sm:col-span-3">
                    <Select
                      value={row.category}
                      onChange={(v) => updateItemRow(idx, { category: v })}
                      options={INSPECTION_CATEGORIES.filter((c) => c === row.category || !itemRows.some((r) => r.category === c))}
                    />
                  </Field>
                  <Field label="Score (0-100)" required className="sm:col-span-2">
                    <input className="input" type="number" min={0} max={100} value={row.score} onChange={(e) => updateItemRow(idx, { score: e.target.value })} placeholder="85" />
                  </Field>
                  <Field label="Condition" className="sm:col-span-2">
                    <Select value={row.condition_level} onChange={(v) => updateItemRow(idx, { condition_level: v })} options={[...CONDITION_LEVELS]} />
                  </Field>
                  <Field label="Recommended Action" className="sm:col-span-3">
                    <input className="input" value={row.recommended_action} onChange={(e) => updateItemRow(idx, { recommended_action: e.target.value })} placeholder="Optional" />
                  </Field>
                  <Field label="Est. Cost (₹)" className="sm:col-span-1">
                    <input className="input" type="number" value={row.estimated_cost} onChange={(e) => updateItemRow(idx, { estimated_cost: e.target.value })} placeholder="0" />
                  </Field>
                  <div className="sm:col-span-1 flex justify-end">
                    <button onClick={() => removeItemRow(idx)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button onClick={() => { setShowAddInspection(false); resetInspectionForm(); }} className="btn-secondary">Cancel</button>
          <button onClick={handleAddInspection} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Save Inspection</button>
        </div>
      </div>
    </Card>
  ) : null;

  const saveItemField = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("inspection_items").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    onChanged();
  };

  if (!insp) {
    return (
      <>
        <Card className="p-6">
          <EmptyState
            icon={<ClipboardCheck size={20} />}
            title="No inspection recorded"
            description="Add an inspection to capture condition scores for this vehicle."
            action={!showAddInspection ? <button onClick={() => setShowAddInspection(true)} className="btn-primary"><Plus size={16} /> Add Inspection</button> : undefined}
          />
        </Card>
        {addInspectionPanel}
      </>
    );
  }
  const items: InspectionItem[] = insp.items ?? [];
  const mechanic = (insp as Inspection & { mechanic?: Party | null }).mechanic;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!showAddInspection && <button onClick={() => setShowAddInspection(true)} className="btn-secondary btn-sm"><Plus size={14} /> Add New Inspection</button>}
      </div>
      {addInspectionPanel}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Inspection Summary</h3>
          <div className="flex flex-col items-center">
            <ScoreRing score={overallScore} label={t("vehicleDetail.overallScore")} />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Spec label="Inspection Type" value={insp.inspection_type} />
            <Spec label="Inspector" value={insp.inspector_name} />
            <div className="pt-2">
              <p className="text-xs text-slate-500">Assigned Mechanic</p>
              <div className="mt-1">
                <InlineEditableField
                  type="select"
                  value={insp.mechanic_party_id ?? ""}
                  options={mechanics.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.mobile ?? "No mobile"}` }))}
                  placeholder="Not linked"
                  formatDisplay={() =>
                    mechanic ? (
                      <Badge color="brand"><Wrench size={11} className="mr-1" />{mechanic.full_name}</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">No mechanic linked</span>
                    )
                  }
                  onSave={async (next) => {
                    const { error } = await supabase.from("inspections").update({ mechanic_party_id: next || null }).eq("id", insp.id);
                    if (error) throw new Error(error.message);
                    toast("Mechanic linked as inspector", "success");
                    onChanged();
                  }}
                />
              </div>
            </div>
            <Spec label="Date" value={formatDate(insp.inspection_date, { withTime: true })} />
            <div className="pt-2">
              <p className="text-xs text-slate-500">Accident Status</p>
              <div className="mt-1">
                <Badge color={
                  insp.accident_status === "No known accident" ? "emerald"
                    : insp.accident_status === "Minor accident suspected" ? "amber"
                      : insp.accident_status === "Accident confirmed" ? "red" : "slate"
                }>{insp.accident_status}</Badge>
              </div>
            </div>
            {insp.accident_evidence && <Spec label="Evidence" value={insp.accident_evidence} />}
          </div>
          {insp.summary && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Summary</p>
              <p className="text-sm text-slate-700">{insp.summary}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-4">Component Scores</h3>
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item: InspectionItem) => (
                <div key={item.id} className="rounded-lg border border-slate-100 p-2.5">
                  <div className="flex items-center gap-4">
                    <div className="w-40 shrink-0">
                      <p className="text-sm font-medium text-slate-800">{item.category}</p>
                      <p className="text-xs text-slate-400">Weight {item.weight}%</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(item.score ?? 0) >= 80 ? "bg-emerald-500" : (item.score ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${item.score ?? 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right">
                      <InlineEditableField
                        type="number"
                        value={item.score ?? 0}
                        className="justify-end font-mono font-semibold text-sm"
                        onSave={(next) => saveItemField(item.id, { score: Number(next) })}
                      />
                    </div>
                    <div className="w-28 text-right">
                      <InlineEditableField
                        type="select"
                        value={item.condition_level ?? ""}
                        options={[...CONDITION_LEVELS]}
                        className="justify-end"
                        formatDisplay={(v) => (
                          <Badge color={
                            v === "Excellent" ? "emerald"
                              : v === "Good" ? "green"
                                : v === "Fair" ? "amber"
                                  : v === "Poor" || v === "Critical" ? "red" : "slate"
                          }>{String(v) || "—"}</Badge>
                        )}
                        onSave={(next) => saveItemField(item.id, { condition_level: String(next) })}
                      />
                    </div>
                  </div>
                  <div className="mt-2 sm:pl-44 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span>Action:</span>
                      <InlineEditableField
                        type="text"
                        value={item.recommended_action ?? ""}
                        placeholder="None"
                        onSave={(next) => saveItemField(item.id, { recommended_action: String(next) || null })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Est. Cost:</span>
                      <InlineEditableField
                        type="number"
                        value={item.estimated_cost ?? 0}
                        formatDisplay={(v) => formatINR(Number(v))}
                        onSave={(next) => saveItemField(item.id, { estimated_cost: Number(next) })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No component scores" />
          )}
          {items.some((i: InspectionItem) => i.recommended_action && i.recommended_action !== "None") && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Recommended Actions</h4>
              <div className="space-y-2">
                {items.filter((i: InspectionItem) => i.recommended_action && i.recommended_action !== "None").map((i: InspectionItem) => (
                  <div key={i.id} className="flex items-start gap-2 text-sm">
                    <Wrench size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-slate-700"><strong className="font-medium">{i.category}:</strong> {i.recommended_action} {i.estimated_cost > 0 && <span className="text-slate-500">({formatINR(i.estimated_cost)})</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Mechanic Inspection Feedback section */}
      {showFeedback && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">Add Mechanic Inspection Feedback</h4>
          </div>
          <div className="space-y-4">
            <Field label="Mechanic" required>
              {mechanics.length === 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  No mechanics found. Add a mechanic from the Parties page first.
                </div>
              ) : (
                <Select
                  value={feedbackForm.mechanic_party_id}
                  onChange={(v) => setFeedbackForm((f) => ({ ...f, mechanic_party_id: v }))}
                  placeholder="Select mechanic"
                  options={mechanics.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.mobile ?? "—"}` }))}
                />
              )}
            </Field>
            <Field label="Rating" required>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFeedbackForm((f) => ({ ...f, rating: String(r) }))}
                    className="p-1"
                  >
                    <Star
                      size={24}
                      className={r <= Number(feedbackForm.rating) ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}
                    />
                  </button>
                ))}
                <span className="text-sm text-slate-500 ml-2">{feedbackForm.rating}/5</span>
              </div>
            </Field>
            <Field label="Feedback" required>
              <textarea className="input" rows={3} value={feedbackForm.feedback_text} onChange={(e) => setFeedbackForm((f) => ({ ...f, feedback_text: e.target.value }))} placeholder="Overall inspection feedback from the mechanic…" />
            </Field>
            <Field label="Areas of Concern">
              <input className="input" value={feedbackForm.areas_of_concern} onChange={(e) => setFeedbackForm((f) => ({ ...f, areas_of_concern: e.target.value }))} placeholder="e.g. Engine noise, worn brake pads" />
            </Field>
            <Field label="Recommended Actions">
              <input className="input" value={feedbackForm.recommended_actions} onChange={(e) => setFeedbackForm((f) => ({ ...f, recommended_actions: e.target.value }))} placeholder="e.g. Replace brake pads, oil change" />
            </Field>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowFeedback(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAddFeedback} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Submit Feedback</button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Wrench size={18} className="text-slate-400" /> Mechanic Inspection Feedback</h3>
          {!showFeedback && <button onClick={() => setShowFeedback(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Feedback</button>}
        </div>
        {feedback.length > 0 ? (
          <div className="space-y-3">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Wrench size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{f.mechanic?.full_name ?? "Unknown mechanic"}</p>
                      <p className="text-xs text-slate-400">{formatDate(f.created_at, { withTime: true })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= f.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-700">{f.feedback_text}</p>
                {f.areas_of_concern && (
                  <div className="mt-2 text-xs">
                    <span className="text-slate-500">Areas of concern: </span>
                    <span className="text-red-600">{f.areas_of_concern}</span>
                  </div>
                )}
                {f.recommended_actions && (
                  <div className="mt-1 text-xs">
                    <span className="text-slate-500">Recommended: </span>
                    <span className="text-slate-700">{f.recommended_actions}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Wrench size={20} />} title="No mechanic feedback yet" description="Add a mechanic and record their inspection feedback for this vehicle." />
        )}
      </Card>

    </div>
  );
}

// ============ DOCUMENTS ============
function DocumentsTab({ vehicle, onChanged, highlightIds }: { vehicle: VehicleWithRelations; onChanged: () => void; highlightIds?: string[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ document_type: "RC book", document_number: "", issue_date: "", expiry_date: "", issuer: "", verification_status: "Uploaded", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());
  const [docLightbox, setDocLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [activeHighlights, setActiveHighlights] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!highlightIds || highlightIds.length === 0) return;
    setActiveHighlights(new Set(highlightIds));
    const el = document.getElementById(`document-row-${highlightIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setActiveHighlights(new Set()), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIds?.join(",")]);

  // The vehicle-documents bucket is private (identity docs live in it), so reads
  // always go through a short-lived signed URL rather than a public URL. Older
  // rows may have stored a full URL rather than a bare storage path.
  const storagePathFor = (fileUrl: string) =>
    fileUrl.includes("/vehicle-documents/") ? fileUrl.split("/vehicle-documents/")[1] : fileUrl;

  const resetAddForm = () => {
    setShowAdd(false);
    setForm({ document_type: "RC book", document_number: "", issue_date: "", expiry_date: "", issuer: "", verification_status: "Uploaded", notes: "" });
    setDocumentFiles([]);
    setUploadSessionId(crypto.randomUUID());
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const fileUrls = documentFiles.map((f) => f.path);
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicle.id,
        document_type: form.document_type,
        document_number: form.document_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        issuer: form.issuer || null,
        verification_status: form.verification_status,
        file_url: fileUrls[0] ?? null,
        file_urls: fileUrls,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast("Document added", "success");
      resetAddForm();
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add document", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (d: VehicleDocument) => {
    try {
      const { error } = await supabase.from("vehicle_documents").update({
        verification_status: "Verified",
        verified_by: user?.email ?? "Unknown",
        verified_at: new Date().toISOString(),
      }).eq("id", d.id);
      if (error) throw error;
      toast("Document verified", "success");
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to verify", "error");
    }
  };

  const handleView = (d: VehicleDocument) => {
    const paths = (d.file_urls?.length ? d.file_urls : d.file_url ? [d.file_url] : []).map(storagePathFor);
    if (paths.length === 0) return;
    setDocLightbox({
      items: paths.map((path) => ({
        name: path.split("/").pop() ?? path,
        isImage: isImageName(path),
        resolve: async () => {
          const { data, error } = await supabase.storage.from("vehicle-documents").createSignedUrl(path, 300);
          if (error) throw error;
          return data.signedUrl;
        },
      })),
      index: 0,
    });
  };

  const handleDelete = async (d: VehicleDocument) => {
    if (!confirm("Delete this document record?")) return;
    try {
      const { error } = await supabase
        .from("vehicle_documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", d.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({
          entity_type: "vehicle_document",
          entity_id: d.id,
          action: "deleted",
          performed_by: user?.email ?? "Unknown",
          reason: `Deleted ${d.document_type} document`,
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log document deletion", auditErr);
        });
      toast("Document removed", "success");
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const saveField = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("vehicle_documents").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    syncVehicleAlerts(vehicle.id).catch(() => {});
    onChanged();
  };

  return (
    <div className="space-y-5">
      {showAdd && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">Add Document</h4>
          </div>
          <div className="space-y-4">
            <Field label="Document Type" required>
              <Select value={form.document_type} onChange={(v) => setForm((f) => ({ ...f, document_type: v }))} options={DOCUMENT_TYPES} />
            </Field>

            <FileUploadGrid
              bucket="vehicle-documents"
              pathPrefix={`${vehicle.id}/${uploadSessionId}`}
              value={documentFiles}
              onChange={setDocumentFiles}
              label="Document File / Photo"
              hint="Upload a photo or scan of the physical document — add multiple pages if needed (max 10MB each)"
            />

            <Field label="Document Number">
              <input className="input" value={form.document_number} onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))} placeholder="TN22AB1234" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue Date"><input className="input" type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} /></Field>
              <Field label="Expiry Date"><input className="input" type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} /></Field>
            </div>
            <Field label="Issuing Organisation"><input className="input" value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="RTO Chennai" /></Field>
            <Field label="Verification Status">
              <Select value={form.verification_status} onChange={(v) => setForm((f) => ({ ...f, verification_status: v }))} options={DOCUMENT_VERIFICATION_STATUSES} />
            </Field>
            <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={resetAddForm} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Add Document</button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Vehicle Documents</h3>
          {!showAdd && <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Document</button>}
        </div>
        {vehicle.documents && vehicle.documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Number</th>
                <th className="pb-2 font-medium">Issuer</th><th className="pb-2 font-medium">Issue Date</th>
                <th className="pb-2 font-medium">File</th><th className="pb-2 font-medium">Expiry</th>
                <th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.documents.map((d) => (
                  <tr
                    key={d.id}
                    id={`document-row-${d.id}`}
                    className={`hover:bg-slate-50 transition-colors ${activeHighlights.has(d.id) ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : ""}`}
                  >
                    <td className="py-2.5">
                      <span className="font-medium text-slate-900">{d.document_type}</span>
                      <InlineEditableField
                        type="text"
                        value={d.notes ?? ""}
                        placeholder="Add notes"
                        onSave={(next) => saveField(d.id, { notes: String(next) || null })}
                        className="text-xs text-slate-500 block"
                      />
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-600">
                      <InlineEditableField
                        type="text"
                        value={d.document_number ?? ""}
                        placeholder="Add number"
                        onSave={(next) => saveField(d.id, { document_number: String(next) || null })}
                      />
                    </td>
                    <td className="py-2.5 text-slate-600">
                      <InlineEditableField
                        type="text"
                        value={d.issuer ?? ""}
                        placeholder="Add issuer"
                        onSave={(next) => saveField(d.id, { issuer: String(next) || null })}
                      />
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">
                      <InlineEditableField
                        type="text"
                        value={d.issue_date ?? ""}
                        placeholder="YYYY-MM-DD"
                        formatDisplay={(v) => (v ? formatDate(String(v)) : "—")}
                        onSave={(next) => saveField(d.id, { issue_date: String(next) || null })}
                      />
                    </td>
                    <td className="py-2.5">
                      {(d.file_urls?.length ?? (d.file_url ? 1 : 0)) > 0 ? (
                        <button
                          onClick={() => handleView(d)}
                          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium"
                        >
                          <Download size={13} /> View{(d.file_urls?.length ?? 1) > 1 ? ` (${d.file_urls!.length})` : ""}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">
                      <InlineEditableField
                        type="text"
                        value={d.expiry_date ?? ""}
                        placeholder="YYYY-MM-DD"
                        formatDisplay={(v) => (v ? formatDate(String(v)) : "—")}
                        onSave={(next) => saveField(d.id, { expiry_date: String(next) || null })}
                      />
                    </td>
                    <td className="py-2.5"><VerificationBadge status={d.verification_status} /></td>
                    <td className="py-2.5 text-right">
                      {d.verification_status !== "Verified" && <button onClick={() => handleVerify(d)} className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-2">Verify</button>}
                      <button onClick={() => handleDelete(d)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<FileText size={20} />} title="No documents" description="Add RC, insurance, PUC, and other vehicle documents." />
        )}
      </Card>

      {docLightbox && (
        <Lightbox
          items={docLightbox.items}
          index={docLightbox.index}
          onClose={() => setDocLightbox(null)}
          onIndexChange={(index) => setDocLightbox((s) => (s ? { ...s, index } : s))}
        />
      )}
    </div>
  );
}

// ============ SALE & PROFIT ============
function SaleTab({ vehicle, cost, profit, funding, partners, marginLow, marginHigh, complianceViolations, onChanged }: {
  vehicle: VehicleWithRelations;
  cost: ReturnType<typeof computeCostBreakdown>;
  profit: ReturnType<typeof computeProfit> | null;
  funding: ReturnType<typeof computePartnerFunding>;
  partners: Partner[];
  marginLow: number;
  marginHigh: number;
  complianceViolations: ComplianceViolation[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [showBuyers, setShowBuyers] = useState(false);
  const [form, setForm] = useState({
    buyer_party_id: "",
    sale_price: "",
    discount: "0",
    buyer_charges: "0",
    payment_method: "UPI",
    payment_status: "Paid",
    delivery_status: "Pending",
    delivery_location: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const sale = vehicle.sale;
  const distributions = vehicle.profit_distributions ?? [];
  // Hard block: only auto_only violations (RC book, amount reconciliation by default) stop
  // the sale outright. Manual-resolution violations are dealer-acknowledgeable below.
  const hardBlockingViolations = complianceViolations.filter(isHardBlocking);
  const manualViolations = complianceViolations.filter((v) => !isHardBlocking(v));
  const unacknowledgedManual = manualViolations.filter(
    (v) => vehicle.alerts?.find((a) => a.policy_id === v.policyId)?.status !== "Acknowledged",
  );

  const handleAcknowledgeAll = async () => {
    setAcknowledging(true);
    try {
      await Promise.all(unacknowledgedManual.map((v) => acknowledgeViolation(vehicle.id, v.policyId)));
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleRecordSale = async () => {
    setSubmitting(true);
    try {
      await completeSale(
        vehicle,
        cost,
        funding,
        partners,
        {
          buyer_party_id: form.buyer_party_id,
          sale_price: Number(form.sale_price) || 0,
          discount: Number(form.discount) || 0,
          buyer_charges: Number(form.buyer_charges) || 0,
          payment_method: form.payment_method,
          payment_status: form.payment_status,
          delivery_status: form.delivery_status,
          delivery_location: form.delivery_location,
          notes: form.notes,
        },
        user?.email ?? "Unknown",
        complianceViolations,
      );
      toast("Sale recorded and profit calculated", "success");
      setShowBuyers(false);
      onChanged();
    } catch (e) {
      toast(
        e instanceof Error
          ? `${e.message} — the sale was not completed and any partial changes were rolled back.`
          : "Failed to record sale. Any partial changes were rolled back.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (distId: string) => {
    try {
      const dist = distributions.find((d) => d.id === distId);
      if (!dist) return;
      const { error } = await supabase.from("profit_distributions").update({
        amount_paid: dist.total_entitlement,
        balance_payable: 0,
        status: "Paid",
      }).eq("id", distId);
      if (error) throw error;
      toast("Settlement marked as paid", "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to settle", "error");
    }
  };

  if (sale) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> Sale Completed</h3>
            <Badge color="emerald">{formatDate(sale.sale_date, { withTime: true })}</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Spec label="Buyer" value={sale.buyer?.full_name} />
            <Spec label="Sale Price" value={formatINR(sale.sale_price)} />
            <Spec label="Discount" value={formatINR(sale.discount)} />
            <Spec label="Net Revenue" value={formatINR(profit?.netSaleRevenue)} />
            <Spec label="Total Cost" value={formatINR(cost.totalVehicleCost)} />
            <Spec label="Gross Profit" value={formatINR(profit?.grossProfit)} />
            <Spec label="Margin" value={formatPercent(profit?.profitMarginPct)} />
            <Spec label="Return on Cost" value={formatPercent(profit?.returnOnCostPct)} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-slate-400" /> Profit Distribution</h3>
          {distributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-medium">Partner</th><th className="pb-2 font-medium text-right">Principal</th>
                  <th className="pb-2 font-medium text-right">Profit</th><th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Paid</th><th className="pb-2 font-medium">Status</th><th className="pb-2"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {distributions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium">{d.partner?.name}</td>
                      <td className="py-2.5 text-right">{formatINR(d.principal_return)}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">{formatINR(d.profit_share)}</td>
                      <td className="py-2.5 text-right font-bold">{formatINR(d.total_entitlement)}</td>
                      <td className="py-2.5 text-right">{formatINR(d.amount_paid)}</td>
                      <td className="py-2.5"><Badge color={d.status === "Paid" ? "emerald" : d.status === "Calculated" ? "amber" : "slate"}>{d.status}</Badge></td>
                      <td className="py-2.5 text-right">
                        {d.status !== "Paid" && <button onClick={() => handleSettle(d.id)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">Mark Paid</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No profit distributions calculated" />
          )}
        </Card>
      </div>
    );
  }

  const estRange = computeEstimatedProfitRange(cost.totalVehicleCost, marginLow, marginHigh);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Cost Sheet</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Spec label={t("vehicleDetail.purchaseCost")} value={formatINR(cost.purchaseCost)} />
          <Spec label={t("vehicleDetail.refurbishment")} value={formatINR(cost.refurbishmentCost)} />
          <Spec label={t("vehicleDetail.holdingCost")} value={formatINR(cost.holdingCost)} />
          <Spec label={t("vehicleDetail.logisticsCost")} value={formatINR(cost.logisticsCost)} />
          <Spec label={t("vehicleDetail.docsSelling")} value={formatINR(cost.documentationSellingCost)} />
          <Spec label="Other" value={formatINR(cost.otherCost)} />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="font-semibold">Total Vehicle Cost</span>
          <span className="text-lg font-bold">{formatINR(cost.totalVehicleCost)}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Sale Projection</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Spec label="Asking Price" value={formatINR(vehicle.asking_price)} />
          <Spec label="Minimum Price" value={formatINR(vehicle.minimum_price)} />
          <div>
            <p className="text-xs text-slate-500">Estimated Profit Range</p>
            <p className="text-sm font-bold mt-0.5 text-emerald-600">{formatINRRange(estRange.low, estRange.high)}</p>
            <p className="text-xs text-slate-400 mt-1">{marginLow}%–{marginHigh}% of total cost</p>
          </div>
        </div>
      </Card>

      {!showBuyers && (
        <Card className="p-5">
          {hardBlockingViolations.length > 0 ? (
            <EmptyState
              icon={<AlertTriangle size={20} />}
              title={t("vehicleDetail.saleBlockedTitle")}
              description={t("vehicleDetail.saleBlockedDescription", { issues: hardBlockingViolations.map((v) => v.name).join(", ") })}
            />
          ) : (
            <EmptyState
              icon={<ShoppingCart size={20} />}
              title="No sale recorded"
              description="Record a sale to calculate profit and partner distributions."
              action={<button onClick={() => setShowBuyers(true)} className="btn-primary"><ShoppingCart size={16} /> Record Sale</button>}
            />
          )}
        </Card>
      )}

      {showBuyers && (
        <Card className="p-5">
          <div className="mb-4">
            <h4 className="font-medium text-slate-800">Record Sale</h4>
            <p className="text-xs text-slate-500 mt-0.5">{vehicle.stock_number} · Total cost {formatINR(cost.totalVehicleCost)}</p>
          </div>
          <div className="space-y-4">
            {manualViolations.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-2">
                <p className="font-medium flex items-start gap-1.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {t("vehicleDetail.nonBlockingIssues", { count: manualViolations.length, list: manualViolations.map((v) => v.name).join(", ") })}
                </p>
                {unacknowledgedManual.length > 0 ? (
                  <button type="button" onClick={handleAcknowledgeAll} disabled={acknowledging} className="btn-secondary btn-sm">
                    {acknowledging ? <Spinner size={12} /> : null} {t("vehicleDetail.acknowledgeAndProceed")}
                  </button>
                ) : (
                  <p className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={14} /> {t("status.Acknowledged")}</p>
                )}
              </div>
            )}
            <PartyPickerField partyType="buyer" value={form.buyer_party_id} onChange={(v) => setForm((f) => ({ ...f, buyer_party_id: v }))} />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Sale Price (₹)" required><input className="input" type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder="79000" /></Field>
              <Field label="Discount (₹)"><input className="input" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} /></Field>
              <Field label="Buyer Charges (₹)"><input className="input" type="number" value={form.buyer_charges} onChange={(e) => setForm((f) => ({ ...f, buyer_charges: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Method"><Select value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={PAYMENT_METHODS} /></Field>
              <Field label="Delivery Location"><input className="input" value={form.delivery_location} onChange={(e) => setForm((f) => ({ ...f, delivery_location: e.target.value }))} placeholder="Chennai" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Status" required>
                <Select value={form.payment_status} onChange={(v) => setForm((f) => ({ ...f, payment_status: v }))} options={PAYMENT_STATUSES} />
              </Field>
              <Field label="Delivery Status" required>
                <Select value={form.delivery_status} onChange={(v) => setForm((f) => ({ ...f, delivery_status: v }))} options={DELIVERY_STATUSES} />
              </Field>
            </div>
            <Field label="Notes" required={Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost}>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost ? "Required: explain why this vehicle is being sold below cost" : "Optional notes"} />
              {Number(form.sale_price) > 0 && (Number(form.sale_price) + Number(form.buyer_charges || 0) - Number(form.discount || 0)) < cost.totalVehicleCost && (
                <p className="text-xs text-red-600 mt-1">This sale is below cost — a reason is required.</p>
              )}
            </Field>
            <div className="rounded-lg bg-brand-50 border border-brand-200 p-3 text-xs text-brand-800">
              On completion, the vehicle will be marked SOLD, profit calculated as (Net Revenue − Total Cost), and profit distributed to partners based on their allocation percentages.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowBuyers(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleRecordSale} disabled={submitting || hardBlockingViolations.length > 0 || unacknowledgedManual.length > 0} className="btn-primary">{submitting ? <Spinner size={14} /> : null} Complete Sale</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

