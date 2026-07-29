import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike,
  ShieldCheck,
  Calendar,
  Gauge,
  Users,
  Fuel,
  Palette,
  MapPin,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Wrench,
  Share2,
  BadgeCheck,
} from "lucide-react";
import { Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import { computeOverallScore } from "@/lib/calc";
import { fetchVehicleFull } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import type { VehicleWithRelations, InspectionItem } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

const PROTEAN_LOOKUP_ROLES = ["owner", "manager", "sales_executive", "accountant"] as const;

type ProteanLookupType = "vehicle" | "insurance" | "challan";

interface ProteanLookupState {
  loading: ProteanLookupType | null;
  results: Partial<Record<ProteanLookupType, { cached: boolean; payload: Record<string, unknown> }>>;
  errors: Partial<Record<ProteanLookupType, string>>;
}

interface PassportProps {
  vehicleId: string;
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  onBack: () => void;
}

export function Passport({ vehicleId, onNavigate, onBack }: PassportProps) {
  const [vehicle, setVehicle] = useState<VehicleWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [proteanState, setProteanState] = useState<ProteanLookupState>({ loading: null, results: {}, errors: {} });
  const { toast } = useToast();
  const { t } = useTranslation();
  const { orgName, orgId, role } = useAuth();

  const reload = async () => {
    try {
      const v = await fetchVehicleFull(vehicleId);
      setVehicle(v);
    } catch {
      setVehicle(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await fetchVehicleFull(vehicleId);
        if (!cancelled) setVehicle(v);
      } catch {
        if (!cancelled) setVehicle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const latestInspection = (vehicle?.inspections ?? [])[0] as (NonNullable<VehicleWithRelations["inspections"]>[number] & { items?: InspectionItem[] }) | undefined;
  const insp = latestInspection;
  const items: InspectionItem[] = useMemo(() => insp?.items ?? [], [insp]);
  const overallScore = useMemo(() => computeOverallScore(items), [items]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>;
  }

  if (!vehicle) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("passportPage.notFound")} /></Card>
      </div>
    );
  }

  const listing = vehicle.listing;
  const verifiedDocs = vehicle.documents?.filter((d) => d.verification_status === "Verified") ?? [];
  const passportUrl = listing ? `${window.location.origin}/passport/${listing.public_slug}` : "";
  const soldOut = vehicle.current_status === "SOLD" || vehicle.current_status === "DELIVERED" || vehicle.current_status === "CANCELLED";

  const togglePublish = async () => {
    if (!listing) return;
    const nextStatus = listing.status === "Active" ? "Draft" : "Active";
    setPublishing(true);
    try {
      const { error } = await supabase.from("listings").update({ status: nextStatus }).eq("id", listing.id);
      if (error) throw error;
      toast(nextStatus === "Active" ? t("passportPage.published") : t("passportPage.unpublished"), "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("passportPage.updateFailed"), "error");
    } finally {
      setPublishing(false);
    }
  };

  // Task 8 (Protean eGov lookups) surfaced here as a light "Verify Vehicle"
  // panel — full lookup/eSign UI is out of scope for this pass (deferred to
  // the broader UI work). Placeholder Protean credentials are provisioned
  // on staging but not yet real, so this call is expected to fail with
  // PROTEAN_NOT_CONFIGURED until an operator fills in real API keys; that
  // failure is surfaced inline rather than as an opaque error.
  const runProteanLookup = async (lookupType: ProteanLookupType) => {
    if (!orgId || !vehicle.registration_number) return;
    setProteanState((s) => ({ ...s, loading: lookupType, errors: { ...s.errors, [lookupType]: undefined } }));
    try {
      const { data, error } = await supabase.functions.invoke("protean-lookup", {
        body: {
          org_id: orgId,
          vehicle_id: vehicle.id,
          lookup_type: lookupType,
          registration_number: vehicle.registration_number,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error.message ?? data.error.code ?? "Lookup failed");
      setProteanState((s) => ({
        ...s,
        loading: null,
        results: { ...s.results, [lookupType]: { cached: !!data.cached, payload: data.result?.response_payload ?? {} } },
      }));
    } catch (e) {
      setProteanState((s) => ({
        ...s,
        loading: null,
        errors: { ...s.errors, [lookupType]: e instanceof Error ? e.message : "Lookup failed" },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Top bar (passport mode) */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={onBack} className="btn-ghost btn-sm"><ChevronLeft size={16} /> {t("passportPage.back")}</button>
          <div className="flex items-center gap-2">
            <Bike size={18} className="text-brand-600" />
            <span className="text-sm font-semibold text-slate-900"> {t("passportPage.vehiclePassport")}</span>
          </div>
          <button
            onClick={() => onNavigate("vehicle", { vehicleId: vehicle.id })}
            className="btn-ghost btn-sm"
          >
            Details
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero card */}
        <Card className="overflow-hidden mb-5">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-brand-100 text-sm mb-1">
                  <ShieldCheck size={16} /> {t("passportPage.digitalPassport")}
                </div>
                <h1 className="text-2xl font-bold">{vehicle.manufacturer} {vehicle.model}</h1>
                <p className="text-brand-100 text-sm mt-1">
                  {vehicle.variant} · {vehicle.manufacture_year} · {vehicle.registration_number ?? t("passportPage.unregistered")}
                </p>
              </div>
              <div className="hidden sm:block">
                <ScoreRing score={overallScore} size={100} strokeWidth={8} />
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Spec icon={<Calendar size={16} />} label={t("passportPage.year")} value={String(vehicle.manufacture_year ?? "—")} />
              <Spec icon={<Gauge size={16} />} label={t("passportPage.odometer")} value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("en-IN")} km` : "—"} />
              <Spec icon={<Users size={16} />} label={t("passportPage.owners")} value={String(vehicle.owner_count)} />
              <Spec icon={<Fuel size={16} />} label={t("passportPage.fuel")} value={vehicle.fuel_type} />
              <Spec icon={<Palette size={16} />} label={t("passportPage.colour")} value={vehicle.colour ?? "—"} />
              <Spec icon={<MapPin size={16} />} label={t("passportPage.registered")} value={`${vehicle.registration_city ?? "—"}, ${vehicle.registration_state ?? "—"}`} />
              <Spec icon={<Bike size={16} />} label={t("passportPage.category")} value={vehicle.category} />
              <Spec icon={<FileCheck size={16} />} label={t("passportPage.docsVerified")} value={`${verifiedDocs.length}/${vehicle.documents?.length ?? 0}`} />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Score & inspection */}
          <Card className="p-5 lg:col-span-2">
            <h2 className="font-semibold text-slate-900 mb-4"> {t("passportPage.inspection")}</h2>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-5">
              <ScoreRing score={overallScore} label={t("passportPage.overallScore")} />
              <div className="flex-1 w-full">
                {insp ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge color={insp.accident_status === "No known accident" ? "emerald" : insp.accident_status === "Minor accident suspected" ? "amber" : "red"}>
                        {insp.accident_status}
                      </Badge>
                      <span className="text-xs text-slate-500">{insp.inspection_type}</span>
                    </div>
                    {insp.summary && <p className="text-sm text-slate-600">{insp.summary}</p>}
                    <p className="text-xs text-slate-400 mt-2">{t("passportPage.inspectedBy", { name: insp.inspector_name, date: formatDate(insp.inspection_date, { withTime: true }) })}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500"> {t("passportPage.noInspection")}</p>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-medium text-slate-700 mb-2"> {t("passportPage.componentBreakdown")}</h3>
                {items.map((item: InspectionItem) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-40 shrink-0">{item.category}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(item.score ?? 0) >= 80 ? "bg-emerald-500" : (item.score ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${item.score ?? 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm font-semibold w-10 text-right">{item.score ?? "—"}</span>
                    <span className="text-xs text-slate-500 w-20 text-right">{item.condition_level ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {items.some((i) => i.recommended_action && i.recommended_action !== "None") && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><Wrench size={14} /> Recommended Maintenance</h3>
                <div className="space-y-1.5">
                  {items.filter((i: InspectionItem) => i.recommended_action && i.recommended_action !== "None").map((i: InspectionItem) => (
                    <p key={i.category} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-800">{i.category}:</span> {i.recommended_action}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Documents + share */}
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900 mb-4"> {t("passportPage.documentStatus")}</h2>
              {vehicle.documents && vehicle.documents.length > 0 ? (
                <div className="space-y-2">
                  {vehicle.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{d.document_type}</span>
                      <VerificationBadge status={d.verification_status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500"> {t("passportPage.noDocuments")}</p>
              )}
            </Card>

            {role && PROTEAN_LOOKUP_ROLES.includes(role as (typeof PROTEAN_LOOKUP_ROLES)[number]) && vehicle.registration_number && (
              <Card className="p-5">
                <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2"><BadgeCheck size={16} /> Verify Vehicle</h2>
                <p className="text-xs text-slate-500 mb-3">
                  Cross-check this vehicle's registration against government records via Protean eGov.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(["vehicle", "insurance", "challan"] as ProteanLookupType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => runProteanLookup(type)}
                      disabled={proteanState.loading !== null}
                      className="btn-secondary btn-sm"
                    >
                      {proteanState.loading === type ? <Spinner size={14} /> : null}
                      {type === "vehicle" ? "RC Check" : type === "insurance" ? "Insurance" : "Challans"}
                    </button>
                  ))}
                </div>
                {(["vehicle", "insurance", "challan"] as ProteanLookupType[]).map((type) => {
                  const result = proteanState.results[type];
                  const errorMessage = proteanState.errors[type];
                  if (!result && !errorMessage) return null;
                  return (
                    <div key={type} className="text-xs mt-2 p-2 rounded-md bg-slate-50 border border-slate-200">
                      <span className="font-medium text-slate-700">{type}: </span>
                      {errorMessage
                        ? <span className="text-red-600">{errorMessage}</span>
                        : (
                          <span className="text-slate-600">
                            {result?.cached ? "(cached) " : ""}
                            {JSON.stringify(result?.payload ?? {})}
                          </span>
                        )}
                    </div>
                  );
                })}
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Share2 size={16} /> {t("passportPage.sharePassport")}</h2>
                {listing && (
                  <Badge color={listing.status === "Active" ? "emerald" : listing.status === "Sold" ? "blue" : "amber"}>{listing.status}</Badge>
                )}
              </div>
              {listing ? (
                <>
                  <div className="flex items-center justify-center mb-3">
                    <div className="rounded-lg border-2 border-slate-200 p-3 bg-white">
                      <QrPlaceholder url={passportUrl} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center break-all font-mono">{passportUrl}</p>
                  <div className="flex gap-2 mt-3">
                    {listing.status === "Active" && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(passportUrl);
                          toast(t("passportPage.linkCopied"), "success");
                        }}
                        className="btn-secondary btn-sm flex-1"
                      >
                        Copy Link
                      </button>
                    )}
                    {soldOut ? (
                      <p className="text-xs text-slate-500 flex-1 text-center self-center">{t("passportPage.soldOut", { status: t("status." + vehicle.current_status, { defaultValue: vehicle.current_status.toLowerCase() }) })}</p>
                    ) : (
                      <button onClick={togglePublish} disabled={publishing} className={listing.status === "Active" ? "btn-secondary btn-sm flex-1" : "btn-primary btn-sm flex-1"}>
                        {publishing ? <Spinner size={14} /> : null} {listing.status === "Active" ? t("passportPage.unpublish") : t("passportPage.publish")}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500"> {t("passportPage.noPublicListing")}</p>
              )}
            </Card>

            <Card className="p-5 bg-emerald-50/50 border-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">{t("passportPage.verifiedBy", { org: orgName ?? "the dealer" })}</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    {t("passportPage.verifiedDescription")}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            {t("passportPage.generated", { date: formatDate(new Date().toISOString(), { withTime: true }), stock: vehicle.stock_number })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t("passportPage.advisory")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function QrPlaceholder({ url }: { url: string }) {
  // Simple visual QR placeholder using a deterministic grid
  const size = 8;
  const cells: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  for (let i = 0; i < size * size; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    cells.push((hash & 1) === 1);
  }
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((c, i) => (
        <div key={i} className={`w-3 h-3 ${c ? "bg-slate-900" : "bg-white"}`} />
      ))}
    </div>
  );
}
