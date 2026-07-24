import { useEffect, useMemo, useState } from "react";
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
  Wrench,
} from "lucide-react";
import { Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { formatDate, formatINR } from "@/lib/format";
import { computeOverallScore } from "@/lib/calc";
import { fetchPublicPassport } from "@/lib/queries";
import type { PublicPassport as PublicPassportData } from "@/lib/types";

interface PublicPassportProps {
  slug: string;
}

export function PublicPassport({ slug }: PublicPassportProps) {
  const [passport, setPassport] = useState<PublicPassportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchPublicPassport(slug);
        if (!cancelled) setPassport(p);
      } catch {
        if (!cancelled) setPassport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const items = useMemo(() => passport?.inspection_items ?? [], [passport]);
  const overallScore = useMemo(() => computeOverallScore(items), [items]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>;
  }

  if (!passport) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Passport not found" description="This link may be expired or the listing is no longer public." /></Card>
        </div>
      </div>
    );
  }

  const verifiedDocs = passport.documents.filter((d) => d.verification_status === "Verified");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-2">
          <Bike size={18} className="text-brand-600" />
          <span className="text-sm font-semibold text-slate-900">Vehicle Passport</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="overflow-hidden mb-5">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-brand-100 text-sm mb-1">
                  <ShieldCheck size={16} /> Digital Vehicle Passport
                </div>
                <h1 className="text-2xl font-bold">{passport.manufacturer} {passport.model}</h1>
                <p className="text-brand-100 text-sm mt-1">
                  {passport.variant} · {passport.manufacture_year} · {passport.registration_number ?? "Unregistered"}
                </p>
                <p className="text-brand-100 text-lg font-semibold mt-2">{formatINR(passport.asking_price)}</p>
              </div>
              <div className="hidden sm:block">
                <ScoreRing score={overallScore} size={100} strokeWidth={8} />
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Spec icon={<Calendar size={16} />} label="Year" value={String(passport.manufacture_year ?? "—")} />
              <Spec icon={<Gauge size={16} />} label="Odometer" value={passport.odometer ? `${passport.odometer.toLocaleString("en-IN")} km` : "—"} />
              <Spec icon={<Users size={16} />} label="Owners" value={String(passport.owner_count)} />
              <Spec icon={<Fuel size={16} />} label="Fuel" value={passport.fuel_type} />
              <Spec icon={<Palette size={16} />} label="Colour" value={passport.colour ?? "—"} />
              <Spec icon={<MapPin size={16} />} label="Registered" value={`${passport.registration_city ?? "—"}, ${passport.registration_state ?? "—"}`} />
              <Spec icon={<Bike size={16} />} label="Category" value={passport.category} />
              <Spec icon={<FileCheck size={16} />} label="Docs Verified" value={`${verifiedDocs.length}/${passport.documents.length}`} />
            </div>
            {passport.description && <p className="text-sm text-slate-600 mt-4 pt-4 border-t border-slate-100">{passport.description}</p>}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-5 lg:col-span-2">
            <h2 className="font-semibold text-slate-900 mb-4">Inspection & Condition</h2>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-5">
              <ScoreRing score={overallScore} label="Overall score" />
              <div className="flex-1 w-full">
                {passport.inspection_date ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge color={passport.accident_status === "No known accident" ? "emerald" : passport.accident_status === "Minor accident suspected" ? "amber" : "red"}>
                        {passport.accident_status}
                      </Badge>
                      <span className="text-xs text-slate-500">{passport.inspection_type}</span>
                    </div>
                    {passport.summary && <p className="text-sm text-slate-600">{passport.summary}</p>}
                    <p className="text-xs text-slate-400 mt-2">Inspected by {passport.inspector_name} on {formatDate(passport.inspection_date, { withTime: true })}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No inspection data available.</p>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Component Breakdown</h3>
                {items.map((item) => (
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
                  {items.filter((i) => i.recommended_action && i.recommended_action !== "None").map((i) => (
                    <p key={i.category} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-800">{i.category}:</span> {i.recommended_action}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Document Status</h2>
              {passport.documents.length > 0 ? (
                <div className="space-y-2">
                  {passport.documents.map((d) => (
                    <div key={d.document_type} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{d.document_type}</span>
                      <VerificationBadge status={d.verification_status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No documents listed.</p>
              )}
            </Card>

            <Card className="p-5 bg-emerald-50/50 border-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Verified by Salam Motors</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    This passport is generated from the dealer's verified inspection records. Financial details are excluded for buyer privacy.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">{passport.stock_number}</p>
          <p className="text-xs text-slate-400 mt-1">
            This passport is advisory. Buyers should conduct independent verification before purchase.
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
