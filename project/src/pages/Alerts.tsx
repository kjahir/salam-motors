import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Clock,
  FileWarning,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
} from "lucide-react";
import { PageHeader, Select, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatINR, formatDate, daysSince } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { fetchAlerts, fetchFinancialSummaries } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import type { Alert, Vehicle, VehicleFinancialSummary } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface AlertsProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

export function Alerts({ onNavigate }: AlertsProps) {
  const [alerts, setAlerts] = useState<(Alert & { vehicle?: Vehicle | null })[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [typeFilter, setTypeFilter] = useState("all");
  const { toast } = useToast();

  const reload = async () => {
    try {
      const [a, s] = await Promise.all([fetchAlerts(), fetchFinancialSummaries()]);
      setAlerts(a);
      setSummaries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

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
      toast(`Alert ${action === "resolve" ? "resolved" : "acknowledged"}`, "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const handleExport = () => {
    downloadCSV("alerts.csv", filtered.map((a) => ({
      Vehicle: a.vehicle?.stock_number ?? "",
      Type: a.alert_type,
      Severity: a.severity,
      Title: a.title,
      Message: a.message ?? "",
      "Days in Inventory": a.days_in_inventory ?? "",
      Status: a.status,
      "Assigned To": a.assigned_to ?? "",
      Created: formatDate(a.created_at, { withTime: true }),
    })));
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Alerts" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Alerts" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  const iconForType = (type: string) => {
    if (type === "Ageing") return <Clock size={16} />;
    if (type === "Document") return <FileWarning size={16} />;
    if (type === "Repair") return <Wrench size={16} />;
    return <AlertTriangle size={16} />;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Alerts"
        description="Inventory ageing, documents, and repair alerts"
        icon={<Bell size={20} />}
        actions={<button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Alerts" value={stats.total} icon={<Bell size={18} />} color="slate" />
        <StatCard label="Open" value={stats.open} icon={<AlertTriangle size={18} />} color="amber" />
        <StatCard label="Critical" value={stats.critical} icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label="High Priority" value={stats.high} icon={<AlertTriangle size={18} />} color="orange" />
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={16} className="text-slate-400" />
          <Select value={statusFilter} onChange={setStatusFilter} options={[
            { value: "all", label: "All statuses" },
            { value: "Open", label: "Open" },
            { value: "Acknowledged", label: "Acknowledged" },
            { value: "Resolved", label: "Resolved" },
          ]} className="w-auto" />
          <Select value={severityFilter} onChange={setSeverityFilter} options={[
            { value: "all", label: "All severities" },
            { value: "Critical", label: "Critical" },
            { value: "High", label: "High" },
            { value: "Warning", label: "Warning" },
            { value: "Info", label: "Info" },
          ]} className="w-auto" />
          <Select value={typeFilter} onChange={setTypeFilter} options={[
            { value: "all", label: "All types" },
            { value: "Ageing", label: "Ageing" },
            { value: "Document", label: "Document" },
            { value: "Repair", label: "Repair" },
          ]} className="w-auto" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<CheckCircle2 size={24} />} title="No alerts match" description="All clear or adjust filters." /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const sevColor = a.severity === "Critical" ? "red" : a.severity === "High" ? "orange" : a.severity === "Warning" ? "amber" : "slate";
            const sevBg = a.severity === "Critical" ? "bg-red-50 text-red-600" : a.severity === "High" ? "bg-orange-50 text-orange-600" : a.severity === "Warning" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600";
            const s = summaryMap.get(a.vehicle_id);
            return (
              <Card key={a.id} className={`p-4 ${a.status === "Open" ? "" : "opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sevBg}`}>
                    {iconForType(a.alert_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge color={sevColor as "red" | "orange" | "amber" | "slate"}>{a.severity}</Badge>
                      <Badge color="slate">{a.alert_type}</Badge>
                      {a.status !== "Open" && <Badge color="emerald">{a.status}</Badge>}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    {a.message && <p className="text-sm text-slate-600 mt-1">{a.message}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <button onClick={() => onNavigate("vehicle", { vehicleId: a.vehicle_id })} className="font-mono text-brand-600 hover:text-brand-700">
                        {a.vehicle?.stock_number}
                      </button>
                      <span>{a.vehicle?.manufacturer} {a.vehicle?.model}</span>
                      {s && <span>Cost {formatINR(s.total_vehicle_cost)}</span>}
                      {a.vehicle?.asking_price && <span>Asking {formatINR(a.vehicle.asking_price)}</span>}
                      {a.assigned_to && <span>· Assigned: {a.assigned_to}</span>}
                      <span>{formatDate(a.created_at, { withTime: true })}</span>
                    </div>
                  </div>
                  {a.status === "Open" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => handleAction(a.id, "acknowledge")} className="btn-ghost btn-sm">Acknowledge</button>
                      <button onClick={() => handleAction(a.id, "resolve")} className="btn-secondary btn-sm">Resolve</button>
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
