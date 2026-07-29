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
  ProfitSettlementPayment,
  Alert,
  AuditLog,
  VehicleStatusHistory,
  VehicleWithRelations,
  VehicleFinancialSummary,
  MechanicInspectionFeedback,
  PublicPassport,
  CompliancePolicy,
  VehicleComplianceStatus,
  VehicleComplianceViolation,
  VehicleMedia,
  AppSettings,
  Membership,
  AssistantAuditTurn,
  AssistantAuditToolCall,
  AssistantTraceEvent,
  VehicleAdPost,
} from "./types";

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("*").single();
  if (error) throw error;
  return data as AppSettings;
}

export async function updateAppSettings(
  patch: Pick<AppSettings, "estimated_profit_margin_low_pct" | "estimated_profit_margin_high_pct">,
  updatedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ ...patch, updated_by: updatedBy });
  if (error) throw error;
}

export async function updateCompanyPreferences(
  patch: Pick<AppSettings, "preferred_language" | "instagram_handle" | "twitter_handle" | "whatsapp_business_number" | "website_url" | "google_business_handle">,
  updatedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ ...patch, updated_by: updatedBy });
  if (error) throw error;
}

export async function fetchVehicleAdPosts(vehicleId: string): Promise<VehicleAdPost[]> {
  const { data, error } = await supabase
    .from("vehicle_ad_posts")
    .select("*")
    .eq("vehicle_id", vehicleId);
  if (error) throw error;
  return (data ?? []) as VehicleAdPost[];
}

export async function fetchPublicPassport(slug: string): Promise<PublicPassport | null> {
  if (slug.length === 0 || slug.length > 100 || slug.trim() !== slug) return null;
  const { data, error } = await supabase
    .rpc("get_public_vehicle_passport", { p_public_slug: slug })
    .maybeSingle();
  if (error) throw error;
  return data as PublicPassport | null;
}

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

export async function fetchCompliancePolicies(): Promise<CompliancePolicy[]> {
  const { data, error } = await supabase
    .from("compliance_policies")
    .select("*")
    .is("deleted_at", null)
    .order("category")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CompliancePolicy[];
}

export async function fetchComplianceStatuses(): Promise<VehicleComplianceStatus[]> {
  const { data, error } = await supabase.from("vehicle_compliance_status").select("*");
  if (error) throw error;
  return (data ?? []) as VehicleComplianceStatus[];
}

export async function fetchVehicleComplianceViolations(vehicleId: string): Promise<VehicleComplianceViolation[]> {
  const { data, error } = await supabase
    .from("vehicle_compliance_violations")
    .select("policy_id, name, category, severity")
    .eq("vehicle_id", vehicleId)
    .eq("violated", true);
  if (error) throw error;
  return (data ?? []) as VehicleComplianceViolation[];
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("onboarded_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
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
    mediaRes,
  ] = await Promise.all([
    supabase.from("purchases").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
    supabase
      .from("expenses")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false }),
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
      .is("deleted_at", null)
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
    supabase
      .from("vehicle_media")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false }),
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
    media: (mediaRes.data ?? []) as VehicleMedia[],
  };
}

export async function fetchPartners(): Promise<Partner[]> {
  const { data, error } = await supabase.from("partners").select("*").is("deleted_at", null).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchParties(type?: string, subtype?: string): Promise<Party[]> {
  let q = supabase.from("parties").select("*").is("deleted_at", null).order("full_name");
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

export async function fetchAllStatusHistory(): Promise<(VehicleStatusHistory & { vehicle: Vehicle | null })[]> {
  const { data, error } = await supabase
    .from("vehicle_status_history")
    .select("*, vehicle:vehicles(*)")
    .order("changed_at", { ascending: false });
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
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllPurchases(): Promise<(Purchase & { vehicle: Vehicle | null; seller: Party | null })[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, vehicle:vehicles(*), seller:parties(*)")
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllSales(): Promise<(Sale & { vehicle: Vehicle | null; buyer: Party | null })[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*, vehicle:vehicles(*), buyer:parties(*)")
    .order("sale_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfitDistributions(): Promise<
  (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] })[]
> {
  const { data, error } = await supabase
    .from("profit_distributions")
    .select("*, partner:partners(*), vehicle:vehicles(*), payments:profit_settlement_payments(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] })[];
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditLogPage {
  rows: AuditLog[];
  count: number;
}

export async function fetchAuditLogs(
  filters: AuditLogFilters = {},
  page = 0,
  pageSize = 50,
): Promise<AuditLogPage> {
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("performed_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actor) query = query.ilike("performed_by", `%${filters.actor}%`);
  if (filters.dateFrom) query = query.gte("performed_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("performed_at", filters.dateTo);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function fetchAssistantTurns(
  orgId: string,
  page = 0,
  pageSize = 25,
): Promise<AssistantAuditTurn[]> {
  const { data, error } = await supabase.rpc("admin_list_assistant_turns", {
    p_org_id: orgId,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  return (data ?? []) as AssistantAuditTurn[];
}

export async function fetchAssistantTraceForRun(
  runId: string,
): Promise<AssistantTraceEvent[]> {
  const { data, error } = await supabase
    .from("assistant_trace_events")
    .select("id, run_id, category, event_key, status, summary, details_redacted, duration_ms, occurred_at")
    .eq("run_id", runId)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssistantTraceEvent[];
}

export async function fetchAssistantToolCallsForRun(
  runId: string,
): Promise<AssistantAuditToolCall[]> {
  const { data, error } = await supabase
    .from("assistant_tool_calls")
    .select(
      "id, tool_name, status, risk_level, arguments_redacted, result_redacted, error_code, error_message, started_at, completed_at, created_at",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssistantAuditToolCall[];
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
  const { data, error } = await supabase.rpc("check_registration_available", {
    reg_number: registrationNumber,
    exclude_vehicle_id: excludeVehicleId ?? null,
  });
  if (error) throw error;
  return data as boolean;
}

export async function nextStockNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_stock_number");
  if (error) throw error;
  return data as string;
}

export async function fetchMemberships(): Promise<Membership[]> {
  const { data, error } = await supabase.from("memberships").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyInvestments(partnerId: string): Promise<(Investment & { vehicle: Vehicle | null })[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*, vehicle:vehicles(*)")
    .eq("partner_id", partnerId)
    .order("investment_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyProfitDistributions(
  partnerId: string,
): Promise<(ProfitDistribution & { vehicle: Vehicle | null; payments: ProfitSettlementPayment[] })[]> {
  const { data, error } = await supabase
    .from("profit_distributions")
    .select("*, vehicle:vehicles(*), payments:profit_settlement_payments(*)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (ProfitDistribution & { vehicle: Vehicle | null; payments: ProfitSettlementPayment[] })[];
}
