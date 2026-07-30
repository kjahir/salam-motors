/* TEMPORARY visual-preview harness — delete with the rest of src/__preview__. */
import type { AppSettings, Partner, Vehicle } from "@/lib/types";
const mk = (i: number, reg: string | null, make: string, model: string, status: string, days: number, sold = false) => ({
  id: `v${i}`, stock_number: `BIKE-2026-000000${i}`, registration_number: reg, manufacturer: make, model,
  category: "Motorcycle", fuel_type: "Petrol", manufacture_year: 2021, current_status: status,
  asking_price: 150000 + i * 1000, minimum_price: 140000,
  sold_at: sold ? new Date().toISOString() : null,
  onboarded_at: new Date(Date.now() - days * 864e5).toISOString(),
});
const vehicles = [
  mk(1, "TN 09 BQ 4411", "Royal Enfield", "Classic 350", "READY_FOR_SALE", 66),
  mk(2, "TN 22 CD 7781", "Honda", "Activa 6G", "UNDER_REPAIR", 41),
  mk(3, "TN 07 AL 9032", "Bajaj", "Pulsar 150", "IN_STOCK", 12),
  mk(4, null, "TVS", "Jupiter", "IN_STOCK", 4),
  mk(5, "TN 10 ZX 5567", "Yamaha", "FZ-S", "SOLD", 20, true),
] as unknown as Vehicle[];
export const fetchVehicles = async () => vehicles;
export const fetchVehicle = async (id: string) => vehicles.find((v) => v.id === id) ?? null;
export const fetchFinancialSummaries = async () => vehicles.map((v, i) => ({ vehicle_id: v.id, total_vehicle_cost: 100000 + i * 12000, purchase_cost: 95000 + i * 10000, total_expense: 5000 + i * 800, sale_price: i === 4 ? 168000 : 0, gross_profit: i === 4 ? 22000 : 0 }));
export const fetchAlerts = async () => [
  { id: "a1", vehicle_id: "v1", status: "Open", severity: "Critical", alert_type: "Compliance", title: "Insurance expired", message: "", vehicle: vehicles[0] },
  { id: "a2", vehicle_id: "v2", status: "Open", severity: "High", alert_type: "Ageing", title: "Ageing over 40 days", message: "", vehicle: vehicles[1] },
  { id: "a3", vehicle_id: "v1", status: "Open", severity: "Warning", alert_type: "Document", title: "PUC missing", message: "", vehicle: vehicles[0] },
];
export const fetchComplianceStatuses = async () => [{ vehicle_id: "v1", violation_count: 2, max_severity_rank: 4 }];
export const fetchInvestments = async () => [{ id: "i1", partner_id: "p1", amount: 500000, status: "Received" }];
export const fetchAppSettings = async () => ({ estimated_profit_margin_low_pct: 10, estimated_profit_margin_high_pct: 30, preferred_language: "ta" } as unknown as AppSettings);
export const fetchPartners = async () => [{ id: "p1", name: "Imran Basha" }] as unknown as Partner[];
export const fetchProfitDistributions = async () => [{ id: "d1", partner_id: "p1", profit_share: 12000, partner: { id: "p1", name: "Imran Basha" } }];
export const fetchCompliancePolicies = async () => [];
export const fetchMechanics = async () => []; export const fetchSellers = async () => []; export const fetchParties = async () => [];
export const fetchVehicleFull = async () => null; export const fetchVehicleAdPosts = async () => []; export const fetchFinancialSummary = async () => null;
export const fetchPublicPassport = async () => null; export const fetchVehicleComplianceViolations = async () => []; export const fetchPartyVehicles = async () => [];
export const fetchAllStatusHistory = async () => []; export const fetchAllExpenses = async () => []; export const fetchAllPurchases = async () => [];
export const fetchAllSales = async () => []; export const fetchAuditLogs = async () => []; export const fetchAssistantTurns = async () => [];
export const fetchAssistantTraceForRun = async () => []; export const fetchAssistantToolCallsForRun = async () => []; export const fetchMemberships = async () => [];
export const fetchMyInvestments = async () => []; export const fetchMyProfitDistributions = async () => [];
export const checkRegistrationUnique = async () => true; export const nextStockNumber = async () => "BIKE-2026-0000007";
export const updateAppSettings = async () => {}; export const updateCompanyPreferences = async () => {};
