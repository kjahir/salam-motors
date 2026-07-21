import { supabase } from "./supabase";
import type {
  Vehicle,
  Partner,
  Party,
  VehicleDocument,
  Inspection,
  InspectionItem,
  Purchase,
  PurchasePayment,
  Expense,
  Investment,
  Listing,
  Enquiry,
  Sale,
  SalePayment,
  ProfitShareAllocation,
  ProfitDistribution,
  Alert,
  AuditLog,
  VehicleStatusHistory,
  VehicleWithRelations,
  VehicleFinancialSummary,
  MechanicInspectionFeedback,
} from "./types";

export async function fetchFinancialSummaries(): Promise<VehicleFinancialSummary[]> {
  const { data, error } = await supabase.from("vehicle_financial_summary").select("*");
  if (error) throw error;
  return (data ?? []) as VehicleFinancialSummary[];
}

export async function fetchFinancialSummary(vehicleId: string): Promise<VehicleFinancialSummary | null> {
  const { data, error } = await supabase
    .from("vehicle_financial_summary")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (error) throw error;
  return data as VehicleFinancialSummary | null;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").order("onboarded_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Vehicle | null;
}

export async function fetchVehicleFull(vehicleId: string): Promise<VehicleWithRelations | null> {
  const vehicle = await fetchVehicle(vehicleId);
  if (!vehicle) return null;

  const [
    purchaseRes,
    expensesRes,
    investmentsRes,
    inspectionsRes,
    documentsRes,
    saleRes,
    allocationsRes,
    distributionsRes,
    statusHistoryRes,
    alertsRes,
    listingRes,
    enquiriesRes,
    feedbackRes,
  ] = await Promise.all([
    supabase.from("purchases").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
    supabase.from("expenses").select("*").eq("vehicle_id", vehicleId).order("expense_date", { ascending: false }),
    supabase
      .from("investments")
      .select("*, partner:partners(*)")
      .eq("vehicle_id", vehicleId)
      .order("investment_date", { ascending: false }),
    supabase
      .from("inspections")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("inspection_date", { ascending: false }),
    supabase
      .from("vehicle_documents")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase.from("sales").select("*").eq("vehicle_id", vehicleId).eq("status", "Completed").maybeSingle(),
    supabase
      .from("vehicle_profit_share_allocations")
      .select("*, partner:partners(*)")
      .eq("vehicle_id", vehicleId),
    supabase
      .from("profit_distributions")
      .select("*, partner:partners(*)")
      .eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_status_history")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("changed_at", { ascending: false }),
    supabase.from("alerts").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }),
    supabase.from("listings").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
    supabase
      .from("enquiries")
      .select("*, buyer:parties(*)")
      .eq("vehicle_id", vehicleId)
      .order("enquiry_date", { ascending: false }),
    supabase
      .from("mechanic_inspection_feedback")
      .select("*, mechanic:parties(*)")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch payments + party relations
  const purchase = purchaseRes.data as Purchase | null;
  let purchasePayments: PurchasePayment[] = [];
  let seller: Party | null = null;
  if (purchase) {
    const [payRes, sellerRes] = await Promise.all([
      supabase.from("purchase_payments").select("*").eq("purchase_id", purchase.id).order("paid_at"),
      purchase.seller_party_id
        ? supabase.from("parties").select("*").eq("id", purchase.seller_party_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    purchasePayments = payRes.data ?? [];
    seller = sellerRes.data as Party | null;
  }

  const sale = saleRes.data as Sale | null;
  let salePayments: SalePayment[] = [];
  let buyer: Party | null = null;
  if (sale) {
    const [payRes, buyerRes] = await Promise.all([
      supabase.from("sale_payments").select("*").eq("sale_id", sale.id).order("paid_at"),
      sale.buyer_party_id
        ? supabase.from("parties").select("*").eq("id", sale.buyer_party_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    salePayments = payRes.data ?? [];
    buyer = buyerRes.data as Party | null;
  }

  // Fetch inspection items + mechanic party
  const inspections = inspectionsRes.data as Inspection[];
  const inspectionsWithItems: (Inspection & { items?: InspectionItem[]; mechanic?: Party | null })[] = [];
  for (const insp of inspections) {
    const [itemsFetch, mechanicFetch] = await Promise.all([
      supabase.from("inspection_items").select("*").eq("inspection_id", insp.id),
      insp.mechanic_party_id
        ? supabase.from("parties").select("*").eq("id", insp.mechanic_party_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    inspectionsWithItems.push({
      ...insp,
      items: itemsFetch.data ?? [],
      mechanic: mechanicFetch.data as Party | null,
    });
  }

  return {
    ...vehicle,
    purchase: purchase ? { ...purchase, seller, payments: purchasePayments } : null,
    expenses: expensesRes.data as Expense[],
    investments: investmentsRes.data as (Investment & { partner: Partner | null })[],
    inspections: inspectionsWithItems,
    documents: documentsRes.data as VehicleDocument[],
    sale: sale ? { ...sale, buyer, payments: salePayments } : null,
    profit_share_allocations: allocationsRes.data as (ProfitShareAllocation & { partner: Partner | null })[],
    profit_distributions: distributionsRes.data as (ProfitDistribution & { partner: Partner | null })[],
    status_history: statusHistoryRes.data as VehicleStatusHistory[],
    alerts: alertsRes.data as Alert[],
    listing: listingRes.data as Listing | null,
    enquiries: enquiriesRes.data as (Enquiry & { buyer: Party | null })[],
    mechanic_feedback: (feedbackRes.data ?? []) as (MechanicInspectionFeedback & { mechanic: Party | null })[],
  };
}

export async function fetchPartners(): Promise<Partner[]> {
  const { data, error } = await supabase.from("partners").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchParties(type?: string, subtype?: string): Promise<Party[]> {
  let q = supabase.from("parties").select("*").order("full_name");
  if (type) q = q.eq("party_type", type);
  if (subtype) q = q.eq("party_subtype", subtype);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchPartyVehicles(partyId: string, type: string): Promise<Vehicle[]> {
  if (type === "seller") {
    const { data, error } = await supabase
      .from("purchases")
      .select("vehicle:vehicles(*)")
      .eq("seller_party_id", partyId);
    if (error) throw error;
    return ((data ?? []) as unknown as { vehicle: Vehicle | null }[]).map((r) => r.vehicle).filter((v): v is Vehicle => Boolean(v));
  }
  const { data, error } = await supabase
    .from("sales")
    .select("vehicle:vehicles(*)")
    .eq("buyer_party_id", partyId)
    .eq("status", "Completed");
  if (error) throw error;
  return ((data ?? []) as unknown as { vehicle: Vehicle | null }[]).map((r) => r.vehicle).filter((v): v is Vehicle => Boolean(v));
}

export async function fetchAlerts(): Promise<(Alert & { vehicle?: Vehicle | null })[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*, vehicle:vehicles(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchInvestments(): Promise<(Investment & { partner: Partner | null; vehicle: Vehicle | null })[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*, partner:partners(*), vehicle:vehicles(*)")
    .order("investment_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllExpenses(): Promise<(Expense & { vehicle?: Vehicle | null; partner?: Partner | null })[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, vehicle:vehicles(*), partner:partners(*)")
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfitDistributions(): Promise<
  (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null })[]
> {
  const { data, error } = await supabase
    .from("profit_distributions")
    .select("*, partner:partners(*), vehicle:vehicles(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMechanics(): Promise<Party[]> {
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .eq("party_type", "mechanic")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchSellers(): Promise<Party[]> {
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .eq("party_type", "seller")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function checkRegistrationUnique(
  registrationNumber: string,
  excludeVehicleId?: string,
): Promise<boolean> {
  let q = supabase
    .from("vehicles")
    .select("id")
    .eq("registration_number", registrationNumber);
  if (excludeVehicleId) q = q.neq("id", excludeVehicleId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data === null;
}
