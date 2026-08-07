import type { VehicleStatus, PartySubtype, Role } from "./types";

export const ROLES: Role[] = ["owner", "manager", "sales_executive", "accountant", "mechanic_inspector"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  sales_executive: "Sales Executive",
  accountant: "Accountant",
  mechanic_inspector: "Mechanic/Inspector",
};

// Only the statuses the app actually transitions a vehicle into today
// (PURCHASED on onboarding, SOLD on sale) — used solely by Inventory's
// status filter dropdown. The broader VehicleStatus type still has the
// full lifecycle for when those transitions get built.
export const VEHICLE_STATUSES: VehicleStatus[] = [
  "PURCHASED",
  "SOLD",
];

export const VEHICLE_CATEGORIES = [
  "Motorcycle",
  "Scooter",
  "Moped",
  "Electric motorcycle",
  "Electric scooter",
  "Other two-wheeler",
];

export const FUEL_TYPES = ["Petrol", "Electric", "Diesel", "CNG", "Hybrid"];

export const PAYMENT_METHODS = ["Cash", "Bank transfer", "UPI", "Cheque", "Card", "Other"];

export const PAYMENT_STATUSES = ["Not paid", "Partially paid", "Paid", "Refunded", "Disputed"];

export const DELIVERY_STATUSES = ["Pending", "Delivered"];

export const DOCUMENT_TYPES = [
  "RC book",
  "Insurance",
  "PUC",
  "Seller identity",
  "Purchase agreement",
  "Delivery note",
  "Service record",
  "Spare-part bill",
  "Repair bill",
  "Transportation bill",
  "Yard-rent bill",
  "Sale agreement",
  "Buyer identity",
  "Payment receipt",
  "NOC",
  "Loan closure",
  "Other",
];

export const DOCUMENT_VERIFICATION_STATUSES = [
  "Not uploaded",
  "Uploaded",
  "Pending verification",
  "Verified",
  "Rejected",
  "Expired",
  "Not applicable",
];

export const EXPENSE_CATEGORIES = [
  "Spare parts",
  "Mechanic labour",
  "Service",
  "Transportation",
  "Yard rent",
  "Cleaning and detailing",
  "Document transfer",
  "Insurance",
  "PUC",
  "Broker commission",
  "Advertisement",
  "Fuel",
  "Test ride",
  "Penalty or fine",
  "Other",
];

export const EXPENSE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Paid", "Reversed"];

export const SELLER_SUBTYPES: { value: PartySubtype; label: string; description: string }[] = [
  { value: "individual", label: "Individual (Counter Drop)", description: "Walk-in seller dropping a bike at the counter" },
  { value: "bank_auction", label: "Bank (Auction)", description: "Bank selling a repossessed vehicle via auction" },
];

export const BUYER_SUBTYPES: { value: PartySubtype; label: string; description: string }[] = [
  { value: "individual", label: "Individual (Person)", description: "End customer buying for personal use" },
  { value: "agent", label: "Agent", description: "Agent buying on behalf of a client" },
];

export const MECHANIC_SUBTYPES: { value: PartySubtype; label: string; description: string }[] = [
  { value: "individual", label: "Individual Mechanic", description: "Freelance/independent mechanic" },
  { value: "company_mechanic", label: "Company Mechanic", description: "Mechanic attached to a garage or company" },
];

export const PARTY_SUBTYPE_LABELS: Record<PartySubtype, string> = {
  individual: "Individual",
  bank_auction: "Bank Auction",
  agent: "Agent",
  company_mechanic: "Company Mechanic",
};

export const IDENTITY_TYPES = ["Aadhaar", "PAN", "Voter ID", "Passport", "Driving License", "Company PAN", "GST Certificate"] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export const INSPECTION_CATEGORIES = [
  "Engine",
  "Transmission and clutch",
  "Brakes",
  "Tyres",
  "Suspension",
  "Battery",
  "Electrical system",
  "Body and paint",
  "Frame and chassis",
  "Exhaust",
  "Lights and indicators",
  "Controls and switches",
  "Seat and trim",
  "Overall ride quality",
  "Documents",
  "Ownership confidence",
];

export const INSPECTION_TYPES = [
  "Visual only",
  "Mechanical",
  "Test ride",
  "Document verification",
  "AI assisted",
  "Third-party inspection",
];

export const CONDITION_LEVELS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Critical",
  "Not inspected",
];

export const ACCIDENT_STATUSES = [
  "No known accident",
  "Minor accident suspected",
  "Major accident suspected",
  "Accident confirmed",
  "Unknown",
];

export const INVESTMENT_STATUSES = [
  "Pledged",
  "Received",
  "Partially used",
  "Fully used",
  "Returned",
  "Adjusted",
  "Cancelled",
];

// Statuses counted toward "total invested" everywhere it's displayed. Includes "Returned"
// deliberately: a capital return is recorded as a *new* negative-amount row rather than
// mutating the original investment (see SettlementModal.tsx), so the original stays an
// untouched historical record and the negative row is what nets the running total back
// down — which only works if both rows are summed under the same filter.
export const INVESTMENT_TOTAL_STATUSES = ["Received", "Partially used", "Fully used", "Returned"];

export const ENQUIRY_STATUSES = [
  "New",
  "Contacted",
  "Test ride scheduled",
  "Negotiating",
  "Reserved",
  "Won",
  "Lost",
  "No response",
];

export const ENQUIRY_CHANNELS = ["Direct", "WhatsApp", "OLX", "Facebook", "Instagram", "Phone", "Referral", "Other"];

export const PROFIT_SHARE_METHODS = [
  "Fixed business partnership percentage",
  "Proportionate to vehicle investment",
  "Return capital first, then split by fixed percentage",
  "Custom manually approved percentage",
];

export const SETTLEMENT_STATUSES = [
  "Not calculated",
  "Calculated",
  "Approved",
  "Partially paid",
  "Paid",
  "Disputed",
  "Adjusted",
];

export const ALERT_SEVERITIES = ["Info", "Warning", "High", "Critical"];

export const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Warning: 2, Info: 1 };

export const MAX_HOLDING_DAYS = 60;

export const SCORE_WEIGHTS: Record<string, number> = {
  Engine: 25,
  "Frame and chassis": 15,
  "Transmission and clutch": 10,
  Brakes: 10,
  Tyres: 8,
  Suspension: 8,
  "Electrical and battery": 7,
  "Body and paint": 7,
  Documents: 5,
  "Ownership confidence": 5,
};

export const SCORE_BANDS = [
  { min: 90, max: 100, label: "Excellent", color: "emerald" },
  { min: 80, max: 89, label: "Very Good", color: "green" },
  { min: 70, max: 79, label: "Good", color: "blue" },
  { min: 60, max: 69, label: "Fair", color: "amber" },
  { min: 40, max: 59, label: "Poor", color: "orange" },
  { min: 0, max: 39, label: "High Risk", color: "red" },
];

export const AGEING_BANDS = [
  { min: 60, label: "Breach", color: "red" },
  { min: 45, label: "High priority", color: "orange" },
  { min: 30, label: "Attention", color: "amber" },
  { min: 0, label: "Normal", color: "emerald" },
];

export const COMPLIANCE_BANDS = [
  { minRank: 4, label: "Critical issues", color: "red" },
  { minRank: 3, label: "High priority", color: "orange" },
  { minRank: 2, label: "Needs attention", color: "amber" },
  { minRank: 1, label: "Minor issues", color: "blue" },
  { minRank: 0, label: "Compliant", color: "emerald" },
] as const;

export const COMPLIANCE_CATEGORIES = ["document", "financial_evidence", "financial_reconciliation"] as const;

export const COMPLIANCE_CATEGORY_LABELS: Record<string, string> = {
  document: "Document",
  financial_evidence: "Financial Evidence",
  financial_reconciliation: "Financial Reconciliation",
};

export const COMPLIANCE_RULE_TYPES = ["document_required", "evidence_required", "amount_reconciliation"] as const;

export const COMPLIANCE_RULE_TYPE_LABELS: Record<string, string> = {
  document_required: "Document required",
  evidence_required: "Evidence required",
  amount_reconciliation: "Amount reconciliation",
};

export const COMPLIANCE_EVIDENCE_ENTITIES = ["purchase_payment", "expense", "investment","settlement"] as const;

export const COMPLIANCE_EVIDENCE_ENTITY_LABELS: Record<string, string> = {
  purchase_payment: "Purchase payment",
  expense: "Expense",
  investment: "Investment",
  settlement: "Settlement",
};

export const COMPLIANCE_RESOLUTION_MODES = ["manual", "auto_only"] as const;

export const COMPLIANCE_RESOLUTION_MODE_LABELS: Record<string, string> = {
  manual: "Manual — Acknowledge/Resolve allowed, dealer-acknowledgeable at sale time",
  auto_only: "Hard block — blocks completing a sale until fixed, regardless of severity",
};

export interface DefaultCompliancePolicy {
  name: string;
  description: string;
  category: (typeof COMPLIANCE_CATEGORIES)[number];
  rule_type: (typeof COMPLIANCE_RULE_TYPES)[number];
  params: Record<string, unknown>;
  severity: string;
  resolution_mode: (typeof COMPLIANCE_RESOLUTION_MODES)[number];
}

// Only the two policies that guard against an unregistered/undocumented vehicle changing
// hands (RC book) or money not reconciling to the agreed price (amount reconciliation) stay
// `auto_only` — hard blockers on completing a sale. Every other default is dealer-
// acknowledgeable (`manual`): it still raises an alert and shows up as a violation, but a
// dealer can consciously acknowledge it and proceed with the sale instead of being blocked.
export const DEFAULT_COMPLIANCE_POLICIES: DefaultCompliancePolicy[] = [
  { name: "RC book required", description: "Every vehicle must have its Registration Certificate attached.", category: "document", rule_type: "document_required", params: { document_type: "RC book" }, severity: "Critical", resolution_mode: "auto_only" },
  { name: "Insurance required", description: "Every vehicle must have proof of insurance attached.", category: "document", rule_type: "document_required", params: { document_type: "Insurance" }, severity: "High", resolution_mode: "manual" },
  { name: "PUC required", description: "Every vehicle must have a valid PUC certificate attached.", category: "document", rule_type: "document_required", params: { document_type: "PUC" }, severity: "Warning", resolution_mode: "manual" },
  { name: "Seller identity required", description: "Every vehicle must have the seller's ID proof attached.", category: "document", rule_type: "document_required", params: { document_type: "Seller identity" }, severity: "Warning", resolution_mode: "manual" },
  { name: "Purchase payments need proof", description: "Every purchase payment must have a supporting screenshot or receipt.", category: "financial_evidence", rule_type: "evidence_required", params: { entity: "purchase_payment" }, severity: "High", resolution_mode: "manual" },
  { name: "Expenses need bills", description: "Every submitted or approved expense must have a bill or receipt attached.", category: "financial_evidence", rule_type: "evidence_required", params: { entity: "expense" }, severity: "Warning", resolution_mode: "manual" },
  { name: "Vehicle investments need proof", description: "Every investment tied to a specific vehicle must have supporting proof attached.", category: "financial_evidence", rule_type: "evidence_required", params: { entity: "investment" }, severity: "Warning", resolution_mode: "manual" },
  { name: "Settlement payments need proof", description: "Every partner profit-settlement payment must have a supporting screenshot or receipt.", category: "financial_evidence", rule_type: "evidence_required", params: { entity: "settlement" }, severity: "Warning", resolution_mode: "manual" },
  { name: "Purchase payments must match price", description: "Total purchase payments must reconcile exactly to the agreed price plus broker commission and other fees.", category: "financial_reconciliation", rule_type: "amount_reconciliation", params: { target: "purchase_payments_vs_purchase_price", tolerance: 0.01 }, severity: "Critical", resolution_mode: "auto_only" },
];
