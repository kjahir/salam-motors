import { describe, expect, it, vi } from "vitest";

// evaluateVehicleCompliance/findViolatingRecordIds are pure functions, but compliance.ts also
// imports the live Supabase client at module scope (used by the async sync* functions we don't
// exercise here). Mock it out so the test file doesn't need real VITE_SUPABASE_* env vars.
vi.mock("./supabase", () => ({ supabase: {} }));

import { evaluateVehicleCompliance, findViolatingRecordIds, isHardBlocking } from "./compliance";
import type {
  CompliancePolicy,
  Expense,
  Investment,
  Purchase,
  PurchasePayment,
  VehicleDocument,
  VehicleWithRelations,
} from "./types";

function makePolicy(overrides: Partial<CompliancePolicy>): CompliancePolicy {
  return {
    id: "policy-1",
    name: "Test policy",
    description: null,
    category: "documentation",
    rule_type: "document_required",
    params: {},
    severity: "High",
    is_active: true,
    resolution_mode: "manual",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<VehicleWithRelations>): VehicleWithRelations {
  return {
    id: "veh-1",
    ...overrides,
  } as VehicleWithRelations;
}

function makeDocument(overrides: Partial<VehicleDocument>): VehicleDocument {
  return {
    id: "doc-1",
    vehicle_id: "veh-1",
    document_type: "RC",
    document_number: null,
    issue_date: null,
    expiry_date: null,
    issuer: null,
    verification_status: "Verified",
    verified_by: null,
    verified_at: null,
    file_url: null,
    file_urls: null,
    version: 1,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as VehicleDocument;
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: "exp-1",
    vehicle_id: "veh-1",
    category: "Other",
    amount: 0,
    expense_date: "2026-01-01",
    paid_by_partner_id: null,
    vendor: null,
    bill_available: false,
    bill_url: null,
    bill_urls: null,
    description: null,
    approval_status: "Approved",
    approved_by: null,
    approved_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeInvestment(overrides: Partial<Investment>): Investment {
  return {
    id: "inv-1",
    partner_id: "partner-1",
    vehicle_id: "veh-1",
    amount: 0,
    investment_date: "2026-01-01",
    purpose: null,
    payment_method: "Bank transfer",
    reference: null,
    status: "Received",
    notes: null,
    proof_url: null,
    proof_urls: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePurchase(overrides: Partial<Purchase & { payments?: PurchasePayment[] }>): Purchase & { payments?: PurchasePayment[] } {
  return {
    id: "purch-1",
    vehicle_id: "veh-1",
    seller_party_id: null,
    purchase_date: "2026-01-01",
    agreed_price: 0,
    broker_commission: 0,
    other_fee: 0,
    payment_status: "Paid",
    handover_location: null,
    odometer_at_purchase: null,
    keys_received: true,
    documents_received: true,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    payments: [],
    ...overrides,
  };
}

function makePayment(overrides: Partial<PurchasePayment>): PurchasePayment {
  return {
    id: "pay-1",
    purchase_id: "purch-1",
    amount: 0,
    payment_method: "Bank transfer",
    reference: null,
    paid_at: "2026-01-01T00:00:00Z",
    notes: null,
    ...overrides,
  } as PurchasePayment;
}

describe("evaluateVehicleCompliance - document_required", () => {
  it("is violated when the required document type is missing entirely", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" } });
    const vehicle = makeVehicle({ documents: [] });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
    expect(violations[0].policyId).toBe("p1");
    expect(violations[0].ruleType).toBe("document_required");
  });

  it("is violated when the document exists but is not in an accepted status", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" } });
    const vehicle = makeVehicle({ documents: [makeDocument({ document_type: "RC", verification_status: "Pending" })] });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
  });

  it("is satisfied when the document is present with an accepted status", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" } });
    const vehicle = makeVehicle({ documents: [makeDocument({ document_type: "RC", verification_status: "Verified" })] });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("respects a custom accepted_statuses list from policy params", () => {
    const policy = makePolicy({
      id: "p1",
      rule_type: "document_required",
      params: { document_type: "Insurance", accepted_statuses: ["Uploaded"] },
    });
    const vehicle = makeVehicle({ documents: [makeDocument({ document_type: "Insurance", verification_status: "Uploaded" })] });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });
});

describe("evaluateVehicleCompliance - evidence_required", () => {
  it("is violated when a purchase payment has no proof_urls", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "purchase_payment" } });
    const vehicle = makeVehicle({ purchase: makePurchase({ payments: [makePayment({ proof_urls: null } as Partial<PurchasePayment>)] }) });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
  });

  it("is satisfied when all purchase payments have proof_urls", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "purchase_payment" } });
    const vehicle = makeVehicle({ purchase: makePurchase({ payments: [makePayment({ proof_urls: ["url1"] } as Partial<PurchasePayment>)] }) });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("is violated when a non-draft/rejected/reversed expense is missing bill_urls", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "expense" } });
    const vehicle = makeVehicle({ expenses: [makeExpense({ approval_status: "Approved", bill_urls: null })] });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
  });

  it("ignores Draft/Rejected/Reversed expenses when checking for missing evidence", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "expense" } });
    const vehicle = makeVehicle({
      expenses: [
        makeExpense({ id: "e1", approval_status: "Draft", bill_urls: null }),
        makeExpense({ id: "e2", approval_status: "Rejected", bill_urls: null }),
        makeExpense({ id: "e3", approval_status: "Reversed", bill_urls: null }),
      ],
    });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("is violated when an investment has no proof_urls", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "investment" } });
    const vehicle = makeVehicle({ investments: [makeInvestment({ proof_urls: null })] });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
  });

  it("is satisfied when the evidence entity is unrecognized", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "unknown_entity" } });
    const vehicle = makeVehicle({ expenses: [makeExpense({ bill_urls: null })] });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });
});

describe("evaluateVehicleCompliance - amount_reconciliation", () => {
  it("is violated when total payments don't match the agreed purchase amount beyond tolerance", () => {
    const policy = makePolicy({ id: "p1", rule_type: "amount_reconciliation", params: {} });
    const vehicle = makeVehicle({
      purchase: makePurchase({
        agreed_price: 100000,
        broker_commission: 1000,
        other_fee: 0,
        payments: [makePayment({ amount: 90000 })],
      }),
    });
    const violations = evaluateVehicleCompliance(vehicle, [policy]);
    expect(violations).toHaveLength(1);
  });

  it("is satisfied when total payments match the expected amount within default tolerance", () => {
    const policy = makePolicy({ id: "p1", rule_type: "amount_reconciliation", params: {} });
    const vehicle = makeVehicle({
      purchase: makePurchase({
        agreed_price: 100000,
        broker_commission: 1000,
        other_fee: 500,
        payments: [makePayment({ amount: 60000 }), makePayment({ amount: 41500 })],
      }),
    });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("respects a custom tolerance from policy params", () => {
    const policy = makePolicy({ id: "p1", rule_type: "amount_reconciliation", params: { tolerance: 100 } });
    const vehicle = makeVehicle({
      purchase: makePurchase({
        agreed_price: 100000,
        broker_commission: 0,
        other_fee: 0,
        payments: [makePayment({ amount: 99950 })],
      }),
    });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("is satisfied (not violated) when there is no purchase at all", () => {
    const policy = makePolicy({ id: "p1", rule_type: "amount_reconciliation", params: {} });
    const vehicle = makeVehicle({ purchase: null });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });
});

describe("evaluateVehicleCompliance - aggregation and active flag", () => {
  it("ignores inactive policies even if they would otherwise be violated", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" }, is_active: false });
    const vehicle = makeVehicle({ documents: [] });
    expect(evaluateVehicleCompliance(vehicle, [policy])).toHaveLength(0);
  });

  it("aggregates violations across multiple active policies of different rule types", () => {
    const policies = [
      makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" } }),
      makePolicy({ id: "p2", rule_type: "evidence_required", params: { entity: "expense" } }),
      makePolicy({ id: "p3", rule_type: "amount_reconciliation", params: {} }),
    ];
    const vehicle = makeVehicle({
      documents: [],
      expenses: [makeExpense({ approval_status: "Approved", bill_urls: null })],
      purchase: makePurchase({ agreed_price: 1000, broker_commission: 0, other_fee: 0, payments: [] }),
    });
    const violations = evaluateVehicleCompliance(vehicle, policies);
    expect(violations.map((v) => v.policyId).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("evaluateVehicleCompliance - resolution_mode propagation", () => {
  it("carries each policy's resolution_mode onto its violation", () => {
    const policies = [
      makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" }, resolution_mode: "auto_only" }),
      makePolicy({ id: "p2", rule_type: "document_required", params: { document_type: "Insurance" }, resolution_mode: "manual" }),
    ];
    const vehicle = makeVehicle({ documents: [] });
    const violations = evaluateVehicleCompliance(vehicle, policies);
    expect(violations.find((v) => v.policyId === "p1")?.resolutionMode).toBe("auto_only");
    expect(violations.find((v) => v.policyId === "p2")?.resolutionMode).toBe("manual");
  });
});

describe("isHardBlocking", () => {
  it("is true only for auto_only violations", () => {
    expect(isHardBlocking({ resolutionMode: "auto_only" })).toBe(true);
    expect(isHardBlocking({ resolutionMode: "manual" })).toBe(false);
  });
});

describe("findViolatingRecordIds", () => {
  it("returns the ids of documents that fail the document_required check", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: { document_type: "RC" } });
    const vehicle = makeVehicle({
      documents: [
        makeDocument({ id: "doc-bad", document_type: "RC", verification_status: "Pending" }),
        makeDocument({ id: "doc-good", document_type: "RC", verification_status: "Verified" }),
        makeDocument({ id: "doc-other", document_type: "Insurance", verification_status: "Pending" }),
      ],
    });
    expect(findViolatingRecordIds(vehicle, policy)).toEqual(["doc-bad"]);
  });

  it("returns an empty list for document_required when params has no document_type", () => {
    const policy = makePolicy({ id: "p1", rule_type: "document_required", params: {} });
    const vehicle = makeVehicle({ documents: [makeDocument({ verification_status: "Pending" })] });
    expect(findViolatingRecordIds(vehicle, policy)).toEqual([]);
  });

  it("returns ids of expenses missing bill_urls for evidence_required/expense", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "expense" } });
    const vehicle = makeVehicle({
      expenses: [
        makeExpense({ id: "e-bad", approval_status: "Approved", bill_urls: null }),
        makeExpense({ id: "e-good", approval_status: "Approved", bill_urls: ["u"] }),
        makeExpense({ id: "e-draft", approval_status: "Draft", bill_urls: null }),
      ],
    });
    expect(findViolatingRecordIds(vehicle, policy)).toEqual(["e-bad"]);
  });

  it("returns an empty list for evidence_required/purchase_payment (no per-row edit UI)", () => {
    const policy = makePolicy({ id: "p1", rule_type: "evidence_required", params: { entity: "purchase_payment" } });
    const vehicle = makeVehicle({ purchase: makePurchase({ payments: [makePayment({ proof_urls: null } as Partial<PurchasePayment>)] }) });
    expect(findViolatingRecordIds(vehicle, policy)).toEqual([]);
  });

  it("returns an empty list for amount_reconciliation (fixed as a whole, not per-row)", () => {
    const policy = makePolicy({ id: "p1", rule_type: "amount_reconciliation", params: {} });
    const vehicle = makeVehicle({ purchase: makePurchase({ agreed_price: 1000, payments: [] }) });
    expect(findViolatingRecordIds(vehicle, policy)).toEqual([]);
  });
});
