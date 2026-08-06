export interface Partner {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  default_profit_share_pct: number;
  joining_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  org_id: string;
  auth_user_id: string | null;
}

export type Role = "owner" | "manager" | "sales_executive" | "accountant" | "mechanic_inspector";

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  status: "invited" | "active" | "suspended";
  display_name: string | null;
  email: string;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
}

export type PartySubtype = "individual" | "bank_auction" | "agent" | "company_mechanic";

export interface Party {
  id: string;
  party_type: string;
  party_subtype: PartySubtype | null;
  full_name: string;
  mobile: string | null;
  alternate_mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  identity_type: string | null;
  identity_number_masked: string | null;
  consent: boolean;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export type VehicleStatus =
  | "DRAFT"
  | "PURCHASE_PENDING"
  | "PURCHASED"
  | "IN_TRANSIT"
  | "IN_YARD"
  | "UNDER_INSPECTION"
  | "UNDER_REPAIR"
  | "READY_FOR_SALE"
  | "RESERVED"
  | "SOLD"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED"
  | "WRITTEN_OFF";

export interface Vehicle {
  id: string;
  stock_number: string;
  registration_number: string | null;
  category: string;
  manufacturer: string;
  brand: string | null;
  model: string;
  variant: string | null;
  fuel_type: string;
  colour: string | null;
  manufacture_year: number | null;
  registration_date: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  odometer: number | null;
  owner_count: number;
  registration_city: string | null;
  registration_state: string | null;
  current_location: string | null;
  current_status: VehicleStatus;
  asking_price: number | null;
  minimum_price: number | null;
  onboarded_at: string;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  document_type: string;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuer: string | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  file_url: string | null;
  file_urls: string[] | null;
  version: number;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Inspection {
  id: string;
  vehicle_id: string;
  inspection_type: string;
  inspection_date: string;
  inspector_name: string | null;
  mechanic_party_id: string | null;
  overall_manual_score: number | null;
  accident_status: string;
  accident_evidence: string | null;
  summary: string | null;
  status: string;
  created_at: string;
}

export interface MechanicInspectionFeedback {
  id: string;
  vehicle_id: string;
  mechanic_party_id: string;
  inspection_id: string | null;
  rating: number;
  feedback_text: string;
  areas_of_concern: string | null;
  recommended_actions: string | null;
  status: string;
  created_at: string;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  category: string;
  score: number | null;
  condition_level: string | null;
  observation: string | null;
  recommended_action: string | null;
  estimated_cost: number;
  urgency: string;
  weight: number;
}

export interface Purchase {
  id: string;
  vehicle_id: string;
  seller_party_id: string | null;
  purchase_date: string;
  agreed_price: number;
  broker_commission: number;
  other_fee: number;
  payment_status: string;
  handover_location: string | null;
  odometer_at_purchase: number | null;
  keys_received: boolean;
  documents_received: boolean;
  notes: string | null;
  created_at: string;
}

export interface PurchasePayment {
  id: string;
  purchase_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  proof_urls: string[] | null;
  paid_at: string;
  notes: string | null;
}

export interface Expense {
  id: string;
  vehicle_id: string;
  category: string;
  amount: number;
  expense_date: string;
  paid_by_partner_id: string | null;
  vendor: string | null;
  bill_available: boolean;
  bill_url: string | null;
  bill_urls: string[] | null;
  description: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Investment {
  id: string;
  partner_id: string;
  vehicle_id: string | null;
  amount: number;
  investment_date: string;
  purpose: string | null;
  payment_method: string;
  reference: string | null;
  status: string;
  notes: string | null;
  proof_url: string | null;
  proof_urls: string[] | null;
  created_at: string;
}

export interface Listing {
  id: string;
  vehicle_id: string;
  asking_price: number;
  minimum_price: number | null;
  status: string;
  listed_at: string;
  description: string | null;
  public_slug: string;
  created_at: string;
}

export interface PublicPassportItem {
  category: string;
  score: number | null;
  condition_level: string | null;
  recommended_action: string | null;
  weight: number;
}

export interface PublicPassportDocument {
  document_type: string;
  verification_status: string;
}

export interface PublicPassport {
  public_slug: string;
  asking_price: number;
  description: string | null;
  stock_number: string;
  category: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  fuel_type: string;
  colour: string | null;
  manufacture_year: number | null;
  registration_number: string | null;
  odometer: number | null;
  owner_count: number;
  registration_city: string | null;
  registration_state: string | null;
  inspection_date: string | null;
  inspection_type: string | null;
  accident_status: string | null;
  summary: string | null;
  inspector_name: string | null;
  inspection_items: PublicPassportItem[];
  documents: PublicPassportDocument[];
  organization_name: string | null;
}

export interface Enquiry {
  id: string;
  listing_id: string | null;
  vehicle_id: string;
  buyer_party_id: string | null;
  enquiry_date: string;
  channel: string;
  offered_price: number | null;
  status: string;
  follow_up_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  vehicle_id: string;
  buyer_party_id: string | null;
  sale_date: string;
  sale_price: number;
  discount: number;
  buyer_charges: number;
  payment_status: string;
  delivery_status: string;
  delivered_at: string | null;
  delivery_location: string | null;
  odometer_at_sale: number | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  proof_urls: string[] | null;
}

export interface ProfitShareAllocation {
  id: string;
  vehicle_id: string;
  partner_id: string;
  percentage: number;
}

export interface ProfitDistribution {
  id: string;
  vehicle_id: string;
  sale_id: string | null;
  partner_id: string;
  principal_return: number;
  profit_share: number;
  loss_share: number;
  total_entitlement: number;
  amount_paid: number;
  balance_payable: number;
  status: string;
  created_at: string;
}

export interface ProfitSettlementPayment {
  id: string;
  distribution_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  proof_url: string | null;
  proof_urls: string[] | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface Alert {
  id: string;
  vehicle_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string | null;
  days_in_inventory: number | null;
  status: string;
  assigned_to: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  policy_id: string | null;
}

export interface CompliancePolicy {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rule_type: string;
  params: Record<string, unknown>;
  severity: string;
  is_active: boolean;
  resolution_mode: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VehicleComplianceViolation {
  policy_id: string;
  name: string;
  category: string;
  severity: string;
}

export interface VehicleComplianceStatus {
  vehicle_id: string;
  violation_count: number;
  max_severity_rank: number;
  violations: VehicleComplianceViolation[];
}

export interface AppSettings {
  estimated_profit_margin_low_pct: number;
  estimated_profit_margin_high_pct: number;
  /** The company's own language: the first non-English entry of `preferred_languages`. */
  preferred_language: string | null;
  /** Every language offered in the switcher. Always contains "en". */
  preferred_languages: string[] | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  whatsapp_business_number: string | null;
  website_url: string | null;
  google_business_handle: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type AdPlatform = "google_business_shared" | "google_business_dealer";
export type AdPostStatus = "queued" | "posted" | "failed" | "skipped";

export interface VehicleAdPost {
  id: string;
  vehicle_id: string;
  listing_id: string | null;
  platform: AdPlatform;
  status: AdPostStatus;
  creative: Record<string, unknown> | null;
  external_post_id: string | null;
  error_message: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLogSource = "app" | "trigger" | "assistant" | "system";

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  performed_by: string | null;
  performed_at: string;
  reason: string | null;
  source: AuditLogSource;
  changed_fields: string[] | null;
  db_txid: number | null;
}

export interface AssistantAuditTurn {
  run_id: string;
  conversation_id: string;
  conversation_title: string | null;
  requested_by_user_id: string;
  requested_by_email: string | null;
  status: string;
  model: string;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  user_message_text: string | null;
  assistant_message_text: string | null;
  tool_call_count: number;
  proposal_action_type: string | null;
  proposal_status: string | null;
  proposal_risk_level: string | null;
  created_at: string;
}

export interface ToolEntitySummary {
  type: string;
  id: string;
  label: string;
}

export interface AssistantTraceEvent {
  id: number;
  run_id: string;
  /** Which of the 8 Ask Salam workflow steps produced this event. See lib/assistantWorkflow.ts.
   *  Null only for rows written before the column existed — `stepOf()` falls back to event_key. */
  workflow_step: number | null;
  category: "request" | "context" | "model" | "tool" | "validation" | "persistence" | "response" | "error";
  event_key: string;
  status: "started" | "completed" | "failed" | "skipped" | "info" | "flagged";
  summary: string;
  details_redacted: Record<string, unknown>;
  duration_ms: number | null;
  occurred_at: string;
}

export interface AssistantAuditToolCall {
  id: string;
  tool_name: string;
  status: string;
  risk_level: string;
  arguments_redacted: Record<string, unknown> | null;
  result_redacted: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface VehicleStatusHistory {
  id: string;
  vehicle_id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  reason: string | null;
}

export interface VehicleFinancialSummary {
  vehicle_id: string;
  stock_number: string;
  current_status: string;
  asking_price: number | null;
  minimum_price: number | null;
  purchase_cost: number;
  refurbishment_cost: number;
  holding_cost: number;
  logistics_cost: number;
  documentation_selling_cost: number;
  other_cost: number;
  total_expense: number;
  total_vehicle_cost: number;
  sale_price: number;
  discount: number;
  buyer_charges: number;
  net_sale_revenue: number;
  gross_profit: number | null;
  estimated_profit: number | null;
  total_invested: number;
}

export interface VehicleMedia {
  id: string;
  vehicle_id: string;
  media_type: string;
  media_category: string;
  file_url: string | null;
  thumbnail_url: string | null;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface VehicleWithRelations extends Vehicle {
  seller?: Party | null;
  inspections?: (Inspection & { mechanic?: Party | null })[];
  mechanic_feedback?: (MechanicInspectionFeedback & { mechanic?: Party | null })[];
  documents?: VehicleDocument[];
  expenses?: Expense[];
  investments?: (Investment & { partner?: Partner | null })[];
  purchase?: (Purchase & { seller?: Party | null; payments?: PurchasePayment[] }) | null;
  sale?: (Sale & { buyer?: Party | null; payments?: SalePayment[] }) | null;
  profit_distributions?: (ProfitDistribution & { partner?: Partner | null; payments?: ProfitSettlementPayment[] })[];
  profit_share_allocations?: (ProfitShareAllocation & { partner?: Partner | null })[];
  status_history?: VehicleStatusHistory[];
  alerts?: Alert[];
  listing?: Listing | null;
  enquiries?: (Enquiry & { buyer?: Party | null })[];
  media?: VehicleMedia[];
}
