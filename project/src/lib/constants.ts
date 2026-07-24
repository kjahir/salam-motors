import type { VehicleStatus, PartySubtype } from "./types";

export const VEHICLE_STATUSES: VehicleStatus[] = [
  "DRAFT",
  "PURCHASE_PENDING",
  "PURCHASED",
  "IN_TRANSIT",
  "IN_YARD",
  "UNDER_INSPECTION",
  "UNDER_REPAIR",
  "READY_FOR_SALE",
  "RESERVED",
  "SOLD",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "WRITTEN_OFF",
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
