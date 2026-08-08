import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Bike, PlusCircle, AlertTriangle, Download, X, Pencil, Trash2, Bell, Share2 } from "lucide-react";
import { PageHeader, Spinner, Select } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { AgeingBadge } from "@/components/ui/Badge";
import { formatINR, formatINRRange, formatDate, daysSince } from "@/lib/format";
import { downloadCSV, computeEstimatedProfitRange } from "@/lib/calc";
import { fetchVehicles, fetchFinancialSummaries, fetchPartners, fetchAlerts, fetchAppSettings } from "@/lib/queries";
import { VEHICLE_CATEGORIES } from "@/lib/constants";
import { EditVehicleModal } from "@/components/EditVehicleModal";
import { DeleteVehicleModal } from "@/components/DeleteVehicleModal";
import type { Vehicle, VehicleFinancialSummary, Partner, AppSettings } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface InventoryProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

type AgeingFilter = "all" | "normal" | "attention" | "high" | "breach";

export function Inventory({ onNavigate }: InventoryProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [openAlertCounts, setOpenAlertCounts] = useState<Map<string, number>>(new Map());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"in-stock" | "sold">("in-stock");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ageingFilter, setAgeingFilter] = useState<AgeingFilter>("all");
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  const reload = useCallback(async () => {
    try {
      const [v, s, p, a, st] = await Promise.all([
        fetchVehicles(),
        fetchFinancialSummaries(),
        fetchPartners(),
        fetchAlerts(),
        fetchAppSettings(),
      ]);
      setVehicles(v);
      setSummaries(s);
      setPartners(p);
      setSettings(st);
      const counts = new Map<string, number>();
      for (const alert of a) {
        if (alert.status === "Open") counts.set(alert.vehicle_id, (counts.get(alert.vehicle_id) ?? 0) + 1);
      }
      setOpenAlertCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inventory.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);
  const marginLow = settings?.estimated_profit_margin_low_pct ?? 10;
  const marginHigh = settings?.estimated_profit_margin_high_pct ?? 50;

  const filtered = useMemo(() => {
    const soldStatuses = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];
    return vehicles
      .filter((v) => (filter === "sold" ? soldStatuses.includes(v.current_status) : !soldStatuses.includes(v.current_status)))
      .filter((v) => {
        if (categoryFilter !== "all" && v.category !== categoryFilter) return false;

        const days = daysSince(v.onboarded_at);
        if (ageingFilter !== "all" && filter !== "sold") {
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
  }, [vehicles, filter, categoryFilter, ageingFilter, search]);

  const activeFilterCount = [categoryFilter !== "all", ageingFilter !== "all"].filter(Boolean).length;

  const totalWorth = useMemo(
    () =>
      filtered.reduce((sum, v) => {
        const s = summaryMap.get(v.id);
        return sum + (filter === "sold" ? (s?.sale_price ?? 0) : (s?.total_vehicle_cost ?? 0));
      }, 0),
    [filtered, summaryMap, filter],
  );

  const handleExport = () => {
    const rows = filtered.map((v) => {
      const s = summaryMap.get(v.id);
      const range = computeEstimatedProfitRange(s?.total_vehicle_cost ?? 0, marginLow, marginHigh);
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
        "Estimated Profit (Low)": range.low,
        "Estimated Profit (High)": range.high,
        "Total Invested": s?.total_invested ?? 0,
        Onboarded: formatDate(v.onboarded_at),
      };
    });
    downloadCSV(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("inventory.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("inventory.title")} />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("inventory.failedToLoadShort")} description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t("inventory.title")}
        description={`${t("inventory.vehicleCount", { count: filtered.length })} · ${
          filter === "sold"
            ? t("inventory.totalSold", { amount: formatINR(totalWorth) })
            : t("inventory.stockWorth", { amount: formatINR(totalWorth) })
        }`}
        actions={
          <>
            <button onClick={handleExport} className="btn-secondary">
              <Download size={16} /> {t("inventory.export")}
            </button>
            <button onClick={() => onNavigate("add-vehicle")} className="btn-primary">
              <PlusCircle size={16} /> {t("inventory.addVehicle")}
            </button>
          </>
        }
      />

      {/* In Stock / Sold */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("in-stock")}
          className={`btn ${filter === "in-stock" ? "bg-red-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}
        >
          {t("inventory.inStock")}
        </button>
        <button
          onClick={() => setFilter("sold")}
          className={`btn ${filter === "sold" ? "bg-red-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}
        >
          {t("inventory.sold")}
        </button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("inventory.searchPlaceholder")}
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: "all", label: t("inventory.allCategories") }, ...VEHICLE_CATEGORIES]}
              className="w-auto min-w-[130px]"
            />
            <Select
              value={ageingFilter}
              onChange={(v) => setAgeingFilter(v as AgeingFilter)}
              options={[
                { value: "all", label: t("inventory.allAgeing") },
                { value: "normal", label: t("inventory.normalAgeing") },
                { value: "attention", label: t("inventory.attentionAgeing") },
                { value: "high", label: t("inventory.highAgeing") },
                { value: "breach", label: t("inventory.breachAgeing") },
              ]}
              className="w-auto min-w-[140px]"
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setCategoryFilter("all");
                  setAgeingFilter("all");
                  setSearch("");
                }}
                className="btn-ghost btn-sm"
              >
                <X size={14} /> {t("inventory.clear", { count: activeFilterCount })}
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
            title={t("inventory.emptyTitle")}
            description={t("inventory.emptyDescription")}
            action={<button onClick={() => onNavigate("add-vehicle")} className="btn-primary"><PlusCircle size={16} /> {t("inventory.addVehicle")}</button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-600">
                  <th className="px-4 py-3 font-medium">{t("inventory.vehicle")}</th>
                  <th className="px-4 py-3 font-medium">{t("inventory.ageing")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("inventory.totalCost")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("inventory.estimatedProfit")}</th>
                  <th className="px-4 py-3 font-medium">{t("inventory.onboarded")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("inventory.view")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("inventory.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => {
                  const s = summaryMap.get(v.id);
                  const days = daysSince(v.onboarded_at);
                  const estRange = computeEstimatedProfitRange(s?.total_vehicle_cost ?? 0, marginLow, marginHigh);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onNavigate("vehicle", { vehicleId: v.id })}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{v.manufacturer} {v.model}</div>
                        <div className="text-xs text-slate-500 font-mono">{v.stock_number} · {v.registration_number ?? t("inventory.noRegistration")}</div>
                      </td>
                      <td className="px-4 py-3">
                        {["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status) ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <AgeingBadge days={days} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatINR(s?.total_vehicle_cost ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap">{formatINRRange(estRange.low, estRange.high, { compact: false })}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(v.onboarded_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onNavigate("alerts")} className="relative text-slate-400 hover:text-amber-600 p-1.5" title={t("inventory.viewAlerts")}>
                            <Bell size={14} />
                            {(openAlertCounts.get(v.id) ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                                {openAlertCounts.get(v.id)}
                              </span>
                            )}
                          </button>
                          <button onClick={() => onNavigate("passport", { vehicleId: v.id })} className="text-slate-400 hover:text-brand-600 p-1.5" title={t("inventory.viewPassport")}>
                            <Share2 size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingVehicle(v)} className="text-slate-400 hover:text-brand-600 p-1.5" title={t("inventory.editVehicle")}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeletingVehicle(v)} className="text-slate-400 hover:text-red-600 p-1.5" title={t("inventory.deleteVehicle")}>
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
          {t("inventory.partnerFooter", { count: partners.length })}
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
