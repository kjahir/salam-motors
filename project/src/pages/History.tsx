import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, AlertTriangle, X } from "lucide-react";
import { PageHeader, Spinner, Select } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { fetchAllStatusHistory } from "@/lib/queries";
import type { Vehicle, VehicleStatusHistory } from "@/lib/types";

interface HistoryProps {
  vehicleFilter?: string | null;
}

export function History({ vehicleFilter }: HistoryProps) {
  const [history, setHistory] = useState<(VehicleStatusHistory & { vehicle: Vehicle | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string>(vehicleFilter ?? "");

  useEffect(() => {
    setVehicleId(vehicleFilter ?? "");
  }, [vehicleFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetchAllStatusHistory();
        if (!cancelled) setHistory(h);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vehicleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const h of history) {
      if (h.vehicle && !seen.has(h.vehicle.id)) {
        seen.set(h.vehicle.id, `${h.vehicle.stock_number} · ${h.vehicle.manufacturer} ${h.vehicle.model}`);
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [history]);

  const filtered = vehicleId ? history.filter((h) => h.vehicle_id === vehicleId) : history;
  const filteredVehicleLabel = vehicleId ? vehicleOptions.find((v) => v.value === vehicleId)?.label : null;

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="History" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="History" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="History"
        description="Status changes across every vehicle"
        icon={<HistoryIcon size={20} />}
      />

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="All vehicles"
            options={vehicleOptions}
            className="w-auto min-w-[220px]"
          />
          {vehicleId && (
            <button onClick={() => setVehicleId("")} className="btn-ghost btn-sm">
              <X size={14} /> Clear filter
            </button>
          )}
        </div>
      </Card>

      {filteredVehicleLabel && (
        <p className="text-sm text-slate-500 mb-3">Showing history for <span className="font-medium text-slate-700">{filteredVehicleLabel}</span></p>
      )}

      <Card className="p-5">
        {filtered.length === 0 ? (
          <EmptyState icon={<HistoryIcon size={20} />} title="No history" description="No status changes recorded yet." />
        ) : (
          <div className="space-y-0">
            {filtered.map((h, i) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${i === 0 ? "bg-brand-600" : "bg-slate-300"}`} />
                  {i < filtered.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={h.new_status} />
                    {h.previous_status && <span className="text-xs text-slate-400">from {h.previous_status.replace(/_/g, " ")}</span>}
                    {!vehicleId && h.vehicle && (
                      <span className="text-xs font-medium text-slate-600">{h.vehicle.stock_number} · {h.vehicle.manufacturer} {h.vehicle.model}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(h.changed_at, { withTime: true })}</p>
                  {h.reason && <p className="text-xs text-slate-600 mt-1">{h.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
