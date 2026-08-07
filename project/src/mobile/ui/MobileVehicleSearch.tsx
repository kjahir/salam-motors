import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./primitives";
import { fetchVehicles, fetchFinancialSummaries } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import type { Vehicle, VehicleFinancialSummary } from "@/lib/types";

const SOLD_STATUSES = ["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"];
// Max height shows ~3 items before scrolling (each item ≈60px).
const LIST_MAX_H = "max-h-48";

interface Props {
  value: string;
  onChange: (vehicleId: string, vehicle?: Vehicle) => void;
  label?: string;
  /** When true, only in-stock vehicles appear in the list. */
  inStockOnly?: boolean;
  /**
   * When true, the list is always shown in normal flow instead of as a floating dropdown
   * that only appears on focus. Meant for dedicated picker surfaces (a full-screen page or
   * a Sheet built just for this field) where there's nothing else on screen for a dropdown
   * to overlay — and where an absolutely-positioned dropdown risks getting clipped by a
   * tightly-fitting scroll container. Fills available height instead of capping at ~3 rows.
   */
  inline?: boolean;
}

export function MobileVehicleSearch({ value, onChange, label, inStockOnly, inline }: Props) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [summaries, setSummaries] = useState<Map<string, VehicleFinancialSummary>>(new Map());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(inline);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchVehicles(), fetchFinancialSummaries()]).then(([v, s]) => {
      if (cancelled) return;
      setVehicles(inStockOnly ? v.filter((x) => !SOLD_STATUSES.includes(x.current_status)) : v);
      setSummaries(new Map(s.map((x) => [x.vehicle_id, x])));
    });
    return () => { cancelled = true; };
  }, [inStockOnly]);

  useEffect(() => {
    if (!open || inline) return;
    const dismiss = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("touchstart", dismiss);
    };
  }, [open, inline]);

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
    setOpen(inline);
    setQuery("");
  };

  const clear = () => {
    onChange("", undefined);
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className={inline ? "flex flex-col min-h-0 flex-1" : "relative"}>
      {label && <p className="text-xs font-medium text-mobile-text mb-1.5">{label}</p>}

      {selectedVehicle && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-mobile-primary bg-mobile-primary/8 px-3.5 py-2.5 text-left active:opacity-80"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-mobile-text truncate">
              {[selectedVehicle.manufacturer, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.stock_number}
            </p>
            <p className="text-xs text-mobile-text-muted">
              {selectedVehicle.registration_number ?? selectedVehicle.stock_number}
            </p>
          </div>
          <X
            size={16}
            className="shrink-0 text-mobile-text-muted"
            onClick={(e) => { e.stopPropagation(); clear(); }}
          />
        </button>
      ) : (
        <div className={`relative ${inline ? "shrink-0" : ""}`}>
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mobile-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={t("mobileInventory.searchPlaceholder")}
            className="mobile-input-scale w-full rounded-xl border border-mobile-border bg-white pl-9 pr-3.5 py-2.5 text-mobile-text placeholder-mobile-text-muted focus:border-mobile-primary focus:outline-none focus:ring-2 focus:ring-mobile-primary/15"
          />
          {vehicles === null && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Spinner size={14} />
            </div>
          )}
        </div>
      )}

      {open && vehicles !== null && (
        <div
          className={
            inline
              ? "mt-2 flex-1 min-h-0 overflow-y-auto rounded-xl border border-mobile-border bg-white"
              : `absolute left-0 right-0 top-full z-30 mt-1 ${LIST_MAX_H} overflow-y-auto rounded-xl border border-mobile-border bg-white shadow-mobile-lg animate-fade-in`
          }
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-mobile-text-muted">{t("mobileInventory.noVehicles")}</p>
          ) : (
            filtered.map((v) => {
              const cost = summaries.get(v.id)?.total_vehicle_cost;
              const isSelected = inline && v.id === value;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => select(v)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left active:bg-mobile-bg border-b border-mobile-border/50 last:border-0 ${
                    isSelected ? "bg-mobile-primary/8" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${isSelected ? "font-semibold text-mobile-primary" : "font-medium text-mobile-text"}`}>
                      {[v.manufacturer, v.model].filter(Boolean).join(" ") || v.stock_number}
                    </p>
                    <p className="text-xs text-mobile-text-muted">
                      {v.registration_number ?? v.stock_number}
                    </p>
                  </div>
                  {cost ? (
                    <p className="shrink-0 text-xs font-medium text-mobile-text-secondary">
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
