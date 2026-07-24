import { useEffect, useMemo, useState } from "react";
import { Search, Bike, PlusCircle, AlertTriangle, Download, X, Pencil, Trash2, Bell, Share2 } from "lucide-react";
import { PageHeader, Spinner, Select } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { StatusBadge, AgeingBadge } from "@/components/ui/Badge";
import { formatINR, formatDate, daysSince } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { fetchVehicles, fetchFinancialSummaries, fetchPartners, fetchAlerts } from "@/lib/queries";
import { VEHICLE_STATUSES, VEHICLE_CATEGORIES } from "@/lib/constants";
import { EditVehicleModal } from "@/components/EditVehicleModal";
import { DeleteVehicleModal } from "@/components/DeleteVehicleModal";
import type { Vehicle, VehicleFinancialSummary, Partner } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface InventoryProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

type AgeingFilter = "all" | "normal" | "attention" | "high" | "breach";

export function Inventory({ onNavigate }: InventoryProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [openAlertCounts, setOpenAlertCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ageingFilter, setAgeingFilter] = useState<AgeingFilter>("all");
  const [showSold, setShowSold] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  const reload = async () => {
    try {
      const [v, s, p, a] = await Promise.all([fetchVehicles(), fetchFinancialSummaries(), fetchPartners(), fetchAlerts()]);
      setVehicles(v);
      setSummaries(s);
      setPartners(p);
      const counts = new Map<string, number>();
      for (const alert of a) {
        if (alert.status === "Open") counts.set(alert.vehicle_id, (counts.get(alert.vehicle_id) ?? 0) + 1);
      }
      setOpenAlertCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

  const filtered = useMemo(() => {
    const soldStatuses = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];
    return vehicles
      .filter((v) => {
        if (!showSold && soldStatuses.includes(v.current_status)) return false;
        if (showSold && !soldStatuses.includes(v.current_status)) return false;

        if (statusFilter !== "all" && v.current_status !== statusFilter) return false;
        if (categoryFilter !== "all" && v.category !== categoryFilter) return false;

        const days = daysSince(v.onboarded_at);
        if (ageingFilter !== "all" && !soldStatuses.includes(v.current_status)) {
          if (ageingFilter === "normal" && days >= 30) return false;
          if (ageingFilter === "attention" && (days < 30 || days >= 45)) return false;
          if (ageingFilter === "high" && (days < 45 || days >= 60)) return false;
          if (ageingFilter === "breach" && days < 60) return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const haystack = [
            v.stock_number,
            v.registration_number,
            v.manufacturer,
            v.brand,
            v.model,
            v.variant,
            v.chassis_number,
            v.engine_number,
            String(v.manufacture_year ?? ""),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => daysSince(b.onboarded_at) - daysSince(a.onboarded_at));
  }, [vehicles, showSold, statusFilter, categoryFilter, ageingFilter, search]);

  const activeFilterCount = [statusFilter !== "all", categoryFilter !== "all", ageingFilter !== "all", showSold].filter(
    Boolean,
  ).length;

  const handleExport = () => {
    const rows = filtered.map((v) => {
      const s = summaryMap.get(v.id);
      return {
        "Stock #": v.stock_number,
        "Reg #": v.registration_number ?? "",
        Vehicle: `${v.manufacturer} ${v.model} ${v.variant ?? ""}`.trim(),
        Category: v.category,
        Year: v.manufacture_year ?? "",
        Status: v.current_status,
        "Days in Stock": daysSince(v.onboarded_at),
        "Purchase Cost": s?.purchase_cost ?? 0,
        "Total Expense": s?.total_expense ?? 0,
        "Total Cost": s?.total_vehicle_cost ?? 0,
        "Asking Price": v.asking_price ?? 0,
        "Estimated Profit": s?.estimated_profit ?? "",
        "Total Invested": s?.total_invested ?? 0,
        Onboarded: formatDate(v.onboarded_at),
      };
    });
    downloadCSV(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Inventory" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Inventory" />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title="Failed to load" description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Inventory"
        description={`${filtered.length} vehicle${filtered.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <button onClick={handleExport} className="btn-secondary">
              <Download size={16} /> Export
            </button>
            <button onClick={() => onNavigate("add-vehicle")} className="btn-primary">
              <PlusCircle size={16} /> Add Vehicle
            </button>
          </>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stock #, registration, model, chassis..."
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "all", label: "All statuses" }, ...VEHICLE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]}
              className="w-auto min-w-[140px]"
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: "all", label: "All categories" }, ...VEHICLE_CATEGORIES]}
              className="w-auto min-w-[130px]"
            />
            <Select
              value={ageingFilter}
              onChange={(v) => setAgeingFilter(v as AgeingFilter)}
              options={[
                { value: "all", label: "All ageing" },
                { value: "normal", label: "Normal (0-29d)" },
                { value: "attention", label: "Attention (30-44d)" },
                { value: "high", label: "High (45-59d)" },
                { value: "breach", label: "Breach (60d+)" },
              ]}
              className="w-auto min-w-[140px]"
            />
            <button
              onClick={() => setShowSold(!showSold)}
              className={`btn ${showSold ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}
            >
              {showSold ? "Showing sold" : "In stock only"}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setAgeingFilter("all");
                  setShowSold(false);
                  setSearch("");
                }}
                className="btn-ghost btn-sm"
              >
                <X size={14} /> Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Bike size={24} />}
            title="No vehicles found"
            description="Try adjusting filters or onboard a new vehicle."
            action={<button onClick={() => onNavigate("add-vehicle")} className="btn-primary"><PlusCircle size={16} /> Add Vehicle</button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-600">
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ageing</th>
                  <th className="px-4 py-3 font-medium text-right">Total Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Asking</th>
                  <th className="px-4 py-3 font-medium text-right">Est. Profit</th>
                  <th className="px-4 py-3 font-medium text-right">Invested</th>
                  <th className="px-4 py-3 font-medium">Onboarded</th>
                  <th className="px-4 py-3 font-medium text-right">View</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => {
                  const s = summaryMap.get(v.id);
                  const days = daysSince(v.onboarded_at);
                  const estProfit = s?.estimated_profit ?? null;
                  const profitColor = estProfit === null ? "text-slate-400" : estProfit >= 0 ? "text-emerald-600" : "text-red-600";
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onNavigate("vehicle", { vehicleId: v.id })}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{v.manufacturer} {v.model}</div>
                        <div className="text-xs text-slate-500 font-mono">{v.stock_number} · {v.registration_number ?? "No reg"}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={v.current_status} /></td>
                      <td className="px-4 py-3">
                        {["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status) ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <AgeingBadge days={days} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatINR(s?.total_vehicle_cost ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatINR(v.asking_price)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${profitColor}`}>{formatINR(estProfit)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatINR(s?.total_invested ?? 0)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(v.onboarded_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onNavigate("alerts")} className="relative text-slate-400 hover:text-amber-600 p-1.5" title="View alerts">
                            <Bell size={14} />
                            {(openAlertCounts.get(v.id) ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                                {openAlertCounts.get(v.id)}
                              </span>
                            )}
                          </button>
                          <button onClick={() => onNavigate("passport", { vehicleId: v.id })} className="text-slate-400 hover:text-brand-600 p-1.5" title="View passport">
                            <Share2 size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingVehicle(v)} className="text-slate-400 hover:text-brand-600 p-1.5" title="Edit vehicle">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeletingVehicle(v)} className="text-slate-400 hover:text-red-600 p-1.5" title="Delete vehicle">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {partners.length > 0 && (
        <p className="text-xs text-slate-400 mt-4 text-center">
          {partners.length} partner{partners.length !== 1 ? "s" : ""} configured · Click any vehicle to view full details
        </p>
      )}

      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          open={Boolean(editingVehicle)}
          onClose={() => setEditingVehicle(null)}
          onSaved={reload}
        />
      )}
      {deletingVehicle && (
        <DeleteVehicleModal
          vehicle={deletingVehicle}
          open={Boolean(deletingVehicle)}
          onClose={() => setDeletingVehicle(null)}
          onDeleted={reload}
        />
      )}
    </div>
  );
}
