import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Primitives";
import { fetchVehicles, fetchFinancialSummaries } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import type { Vehicle, VehicleFinancialSummary } from "@/lib/types";

// Desktop counterpart to src/mobile/ui/MobileVehicleSearch.tsx — same generic search
// (registration/manufacturer/model/variant/stock number), same three-visible scrollable
// list, same manufacturer + model + registration (+ total cost) item shape, drawn with
// desktop slate/brand tokens instead of mobile.* ones.
const LIST_MAX_H = "max-h-48";

interface Props {
  value: string;
  onChange: (vehicleId: string, vehicle?: Vehicle) => void;
  placeholder?: string;
  className?: string;
}

export function VehicleSearchField({ value, onChange, placeholder, className = "" }: Props) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [summaries, setSummaries] = useState<Map<string, VehicleFinancialSummary>>(new Map());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchVehicles(), fetchFinancialSummaries()]).then(([v, s]) => {
      if (cancelled) return;
      setVehicles(v);
      setSummaries(new Map(s.map((x) => [x.vehicle_id, x])));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);

  const selectedVehicle = useMemo(
    () => vehicles?.find((v) => v.id === value) ?? null,
    [vehicles, value],
  );

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    if (!query.trim()) return vehicles;
    const q = query.toLowerCase();
    return vehicles.filter((v) =>
      [v.registration_number, v.manufacturer, v.model, v.variant, v.stock_number, v.brand]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [vehicles, query]);

  const select = (v: Vehicle) => {
    onChange(v.id, v);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange("", undefined);
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {selectedVehicle && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">
              {[selectedVehicle.manufacturer, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.stock_number}
            </p>
            <p className="text-xs text-slate-500">
              {selectedVehicle.registration_number ?? selectedVehicle.stock_number}
            </p>
          </div>
          <X
            size={16}
            className="shrink-0 text-slate-400"
            onClick={(e) => { e.stopPropagation(); clear(); }}
          />
        </button>
      ) : (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? t("mobileInventory.searchPlaceholder")}
            className="input pl-9"
          />
          {vehicles === null && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner size={14} />
            </div>
          )}
        </div>
      )}

      {open && vehicles !== null && (
        <div className={`absolute left-0 right-0 top-full z-30 mt-1 ${LIST_MAX_H} overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-card-hover`}>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">{t("mobileInventory.noVehicles")}</p>
          ) : (
            filtered.map((v) => {
              const cost = summaries.get(v.id)?.total_vehicle_cost;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => select(v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {[v.manufacturer, v.model].filter(Boolean).join(" ") || v.stock_number}
                    </p>
                    <p className="text-xs text-slate-500">
                      {v.registration_number ?? v.stock_number}
                    </p>
                  </div>
                  {cost ? (
                    <p className="shrink-0 text-xs font-medium text-slate-500">
                      ({formatINR(cost)})
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
