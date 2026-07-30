import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Clock,
  FileWarning,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
} from "lucide-react";
import { PageHeader, Select, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatINR, formatDate } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { fetchAlerts, fetchFinancialSummaries, fetchCompliancePolicies } from "@/lib/queries";
import { syncAllVehiclesCompliance, resolveAlertDestination } from "@/lib/compliance";
import { translateAlertCopy } from "@/lib/i18nText";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/useToast";
import type { Alert, Vehicle, VehicleFinancialSummary, CompliancePolicy } from "@/lib/types";
import { vehicleRef } from "@/lib/vehicleLabel";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface AlertsProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Alerts({ onNavigate }: AlertsProps) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [typeFilter, setTypeFilter] = useState("all");
  const { toast } = useToast();

  const reload = useCallback(async () => {
    try {
      await syncAllVehiclesCompliance().catch(() => {});
      const [a, s, p] = await Promise.all([fetchAlerts(), fetchFinancialSummaries(), fetchCompliancePolicies()]);
      setAlerts(a);
      setSummaries(s);
      setPolicies(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("alertsPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);
  const policyMap = useMemo(() => new Map(policies.map((p) => [p.id, p])), [policies]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (typeFilter !== "all" && a.alert_type !== typeFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const open = alerts.filter((a) => a.status === "Open");
    return {
      total: alerts.length,
      open: open.length,
      critical: open.filter((a) => a.severity === "Critical").length,
      high: open.filter((a) => a.severity === "High").length,
    };
  }, [alerts]);

  const handleAction = async (id: string, action: "acknowledge" | "resolve") => {
    try {
      const update = action === "resolve"
        ? { status: "Resolved", resolved_at: new Date().toISOString() }
        : { status: "Acknowledged", acknowledged_at: new Date().toISOString() };
      const { error } = await supabase.from("alerts").update(update).eq("id", id);
      if (error) throw error;
      toast(action === "resolve" ? t("alertsPage.actionResolved") : t("alertsPage.actionAcknowledged"), "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("alertsPage.actionFailed"), "error");
    }
  };

  const handleExport = () => {
    downloadCSV("alerts.csv", filtered.map((a) => {
      const copy = translateAlertCopy(t, a.title, a.message);
      return {
        Vehicle: a.vehicle?.stock_number ?? "",
        Type: a.alert_type,
        Severity: a.severity,
        Title: copy.title,
        Message: copy.message ?? "",
        "Days in Inventory": a.days_in_inventory ?? "",
        Status: a.status,
        "Assigned To": a.assigned_to ?? "",
        Created: formatDate(a.created_at, { withTime: true }),
      };
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("alertsPage.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("alertsPage.title")} />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("alertsPage.failedToLoad")} description={error} /></Card>
      </div>
    );
  }

  const iconForType = (type: string) => {
    if (type === "Ageing") return <Clock size={16} />;
    if (type === "Document") return <FileWarning size={16} />;
    if (type === "Repair") return <Wrench size={16} />;
    if (type === "Compliance") return <ShieldAlert size={16} />;
    return <AlertTriangle size={16} />;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("alertsPage.title")}
        description={t("alertsPage.description")}
        icon={<Bell size={20} />}
        actions={<button onClick={handleExport} className="btn-secondary"><Download size={16} /> {t("alertsPage.export")}</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("alertsPage.totalAlerts")} value={stats.total} icon={<Bell size={18} />} color="slate" />
        <StatCard label={t("alertsPage.open")} value={stats.open} icon={<AlertTriangle size={18} />} color="amber" />
        <StatCard label={t("alertsPage.critical")} value={stats.critical} icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label={t("alertsPage.highPriority")} value={stats.high} icon={<AlertTriangle size={18} />} color="orange" />
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={16} className="text-slate-400" />
          <Select value={statusFilter} onChange={setStatusFilter} options={[
            { value: "all", label: t("alertsPage.allStatuses") },
            { value: "Open", label: t("status.Open") },
            { value: "Acknowledged", label: t("status.Acknowledged") },
            { value: "Resolved", label: t("status.Resolved") },
          ]} className="w-auto" />
          <Select value={severityFilter} onChange={setSeverityFilter} options={[
            { value: "all", label: t("alertsPage.allSeverities") },
            { value: "Critical", label: t("status.Critical") },
            { value: "High", label: t("status.High") },
            { value: "Warning", label: t("status.Warning") },
            { value: "Info", label: t("status.Info") },
          ]} className="w-auto" />
          <Select value={typeFilter} onChange={setTypeFilter} options={[
            { value: "all", label: t("alertsPage.allTypes") },
            { value: "Ageing", label: t("status.Ageing") },
            { value: "Document", label: t("status.Document") },
            { value: "Repair", label: t("status.Repair") },
            { value: "Compliance", label: t("status.Compliance") },
          ]} className="w-auto" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<CheckCircle2 size={24} />} title={t("alertsPage.noMatch")} description={t("alertsPage.emptyDescription")} /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const sevColor = a.severity === "Critical" ? "red" : a.severity === "High" ? "orange" : a.severity === "Warning" ? "amber" : "slate";
            const sevBg = a.severity === "Critical" ? "bg-red-50 text-red-600" : a.severity === "High" ? "bg-orange-50 text-orange-600" : a.severity === "Warning" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600";
            const s = summaryMap.get(a.vehicle_id);
            const policy = a.policy_id ? policyMap.get(a.policy_id) : undefined;
            const actionRequired = policy?.resolution_mode === "auto_only";
            const destination = resolveAlertDestination(policy);
            const goToIssue = () => onNavigate("vehicle", { vehicleId: a.vehicle_id, ...destination, highlightPolicyId: policy?.id });
            const copy = translateAlertCopy(t, a.title, a.message);
            return (
              <Card key={a.id} hover onClick={goToIssue} className={`p-4 ${a.status === "Open" ? "" : "opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sevBg}`}>
                    {iconForType(a.alert_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge color={sevColor as "red" | "orange" | "amber" | "slate"}>{t(`status.${a.severity}`, { defaultValue: a.severity })}</Badge>
                      <Badge color="slate">{t(`status.${a.alert_type}`, { defaultValue: a.alert_type })}</Badge>
                      {actionRequired && a.status !== "Resolved" && <Badge color="purple">{t("alertsPage.requiresAction")}</Badge>}
                      {a.status !== "Open" && <Badge color="emerald">{t(`status.${a.status}`, { defaultValue: a.status })}</Badge>}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{copy.title}</p>
                    {copy.message && <p className="text-sm text-slate-600 mt-1">{copy.message}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <span className="font-mono text-brand-600">{vehicleRef(a.vehicle)}</span>
                      <span>{a.vehicle?.manufacturer} {a.vehicle?.model}</span>
                      {s && <span>{t("alertsPage.cost", { value: formatINR(s.total_vehicle_cost) })}</span>}
                      {a.vehicle?.asking_price && <span>{t("alertsPage.asking", { value: formatINR(a.vehicle.asking_price) })}</span>}
                      {a.assigned_to && <span>· {t("alertsPage.assigned", { name: a.assigned_to })}</span>}
                      <span>{formatDate(a.created_at, { withTime: true })}</span>
                    </div>
                  </div>
                  {a.status === "Open" && !actionRequired && (
                    <div className="flex flex-col gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleAction(a.id, "acknowledge")} className="btn-ghost btn-sm">{t("alertsPage.acknowledge")}</button>
                      <button onClick={() => handleAction(a.id, "resolve")} className="btn-secondary btn-sm">{t("alertsPage.resolve")}</button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
