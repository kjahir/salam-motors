import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp, ShoppingCart, Bike } from "lucide-react";
import { TopBar, Input, Spinner, Card, EmptyState, Tag, SegmentedTabs, Button } from "./ui/primitives";
import { formatINR, formatDate, daysSince } from "@/lib/format";
import { fetchAllPurchases, fetchAllSales, fetchVehicles, fetchFinancialSummaries } from "@/lib/queries";
import type { Purchase, Sale, Vehicle, Party, VehicleFinancialSummary } from "@/lib/types";

type ReportTab = "purchases" | "inventory" | "sales";
type Period = "all" | "30d" | "month";

const PAGE_SIZE = 10;

function withinPeriod(dateStr: string, period: Period): boolean {
  if (period === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "30d") return (now.getTime() - d.getTime()) / 86400000 <= 30;
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function MobileReports() {
  const [tab, setTab] = useState<ReportTab>("inventory");
  const [purchases, setPurchases] = useState<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]>([]);
  const [sales, setSales] = useState<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      const [p, s, v, sm] = await Promise.all([fetchAllPurchases(), fetchAllSales(), fetchVehicles(), fetchFinancialSummaries()]);
      setPurchases(p);
      setSales(s);
      setVehicles(v);
      setSummaries(sm);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [tab, search, period]);

  const summaryMap = useMemo(() => new Map(summaries.map((s) => [s.vehicle_id, s])), [summaries]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (v: Vehicle | null | undefined) =>
      !q || [v?.stock_number, v?.registration_number, v?.manufacturer, v?.model].filter(Boolean).join(" ").toLowerCase().includes(q);
  }, [search]);

  const purchaseRows = useMemo(
    () => purchases.filter((p) => withinPeriod(p.purchase_date, period) && matches(p.vehicle)).sort((a, b) => +new Date(b.purchase_date) - +new Date(a.purchase_date)),
    [purchases, period, matches],
  );
  const saleRows = useMemo(
    () => sales.filter((s) => withinPeriod(s.sale_date, period) && matches(s.vehicle)).sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date)),
    [sales, period, matches],
  );
  const inventoryRows = useMemo(
    () =>
      vehicles
        .filter((v) => !["SOLD", "DELIVERED", "CANCELLED", "WRITTEN_OFF"].includes(v.current_status) && withinPeriod(v.onboarded_at, period) && matches(v))
        .sort((a, b) => daysSince(b.onboarded_at) - daysSince(a.onboarded_at)),
    [vehicles, period, matches],
  );

  if (loading) {
    return (
      <div>
        <TopBar title="Reports" />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Reports" />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mobile-text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock #, model..." className="pl-10" />
        </div>
        <SegmentedTabs
          tabs={[
            { key: "purchases", label: "Purchases" },
            { key: "inventory", label: "Inventory" },
            { key: "sales", label: "Sales" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as ReportTab)}
        />
        <div className="flex gap-1.5">
          {(["all", "30d", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-pill px-3 py-1 text-xs font-medium ${period === p ? "bg-mobile-navy text-white" : "bg-white text-mobile-text-secondary border border-mobile-border"}`}
            >
              {p === "all" ? "All time" : p === "30d" ? "Last 30 days" : "This month"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-2.5 pb-4">
        {tab === "purchases" && (
          <ListSection
            empty={{ icon: <ShoppingCart size={20} />, title: "No purchases found" }}
            rows={purchaseRows.slice(0, limit)}
            total={purchaseRows.length}
            limit={limit}
            onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
            render={(p) => (
              <Card key={p.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-mobile-text truncate">{p.vehicle?.manufacturer} {p.vehicle?.model}</p>
                    <p className="text-xs text-mobile-text-muted">{p.seller?.full_name ?? "—"} · {formatDate(p.purchase_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-mobile-text shrink-0">{formatINR(p.agreed_price)}</span>
                </div>
              </Card>
            )}
          />
        )}
        {tab === "inventory" && (
          <ListSection
            empty={{ icon: <Bike size={20} />, title: "No vehicles in stock" }}
            rows={inventoryRows.slice(0, limit)}
            total={inventoryRows.length}
            limit={limit}
            onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
            render={(v) => {
              const s = summaryMap.get(v.id);
              const days = daysSince(v.onboarded_at);
              return (
                <Card key={v.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{v.manufacturer} {v.model}</p>
                      <p className="text-xs text-mobile-text-muted font-mono">{v.stock_number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-mobile-text">{formatINR(s?.total_vehicle_cost ?? 0)}</p>
                      <Tag color={days >= 60 ? "error" : days >= 30 ? "warning" : "neutral"}>{days}d</Tag>
                    </div>
                  </div>
                </Card>
              );
            }}
          />
        )}
        {tab === "sales" && (
          <ListSection
            empty={{ icon: <TrendingUp size={20} />, title: "No sales found" }}
            rows={saleRows.slice(0, limit)}
            total={saleRows.length}
            limit={limit}
            onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
            render={(sale) => {
              const s = sale.vehicle_id ? summaryMap.get(sale.vehicle_id) : undefined;
              const profit = s?.gross_profit ?? null;
              return (
                <Card key={sale.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mobile-text truncate">{sale.vehicle?.manufacturer} {sale.vehicle?.model}</p>
                      <p className="text-xs text-mobile-text-muted">{sale.buyer?.full_name ?? "—"} · {formatDate(sale.sale_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-mobile-text">{formatINR(sale.sale_price)}</p>
                      {profit !== null && <p className={`text-xs font-medium ${profit >= 0 ? "text-mobile-success" : "text-mobile-error"}`}>{formatINR(profit)}</p>}
                    </div>
                  </div>
                </Card>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

function ListSection<T>({ rows, total, limit, onLoadMore, render, empty }: {
  rows: T[];
  total: number;
  limit: number;
  onLoadMore: () => void;
  render: (row: T) => React.ReactNode;
  empty: { icon: React.ReactNode; title: string };
}) {
  if (total === 0) {
    return <Card className="p-5"><EmptyState icon={empty.icon} title={empty.title} /></Card>;
  }
  return (
    <>
      {rows.map(render)}
      {limit < total && (
        <Button variant="secondary" className="w-full" onClick={onLoadMore}>
          Load more ({total - limit} remaining)
        </Button>
      )}
    </>
  );
}
