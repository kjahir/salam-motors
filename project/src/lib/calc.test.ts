import { describe, expect, it } from "vitest";
import {
  computeCostBreakdown,
  computeOverallScore,
  computePartnerFunding,
  computeProfit,
  computeProfitShare,
  documentCompleteness,
  type CostBreakdown,
} from "./calc";
import type { Expense, InspectionItem, Investment, Sale } from "./types";

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

function makeSale(overrides: Partial<Sale>): Sale {
  return {
    id: "sale-1",
    vehicle_id: "veh-1",
    buyer_party_id: null,
    sale_date: "2026-01-01",
    sale_price: 0,
    discount: 0,
    buyer_charges: 0,
    payment_status: "Paid",
    delivery_status: "Delivered",
    delivered_at: null,
    delivery_location: null,
    odometer_at_sale: null,
    notes: null,
    status: "Completed",
    created_at: "2026-01-01T00:00:00Z",
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

describe("computeCostBreakdown", () => {
  it("computes purchase-only cost when there are no expenses", () => {
    const result = computeCostBreakdown({ agreed_price: 100000, broker_commission: 2000, other_fee: 500 }, []);
    expect(result.purchaseCost).toBe(102500);
    expect(result.totalExpense).toBe(0);
    expect(result.totalVehicleCost).toBe(102500);
    expect(result.refurbishmentCost).toBe(0);
    expect(result.holdingCost).toBe(0);
    expect(result.logisticsCost).toBe(0);
    expect(result.documentationSellingCost).toBe(0);
    expect(result.otherCost).toBe(0);
  });

  it("treats a missing purchase as zero cost", () => {
    const result = computeCostBreakdown(null, []);
    expect(result.purchaseCost).toBe(0);
    expect(result.totalVehicleCost).toBe(0);
  });

  it("includes approved and paid expenses in the total", () => {
    const expenses = [
      makeExpense({ id: "e1", category: "Spare parts", amount: 1000, approval_status: "Approved" }),
      makeExpense({ id: "e2", category: "Yard rent", amount: 500, approval_status: "Paid" }),
    ];
    const result = computeCostBreakdown({ agreed_price: 50000, broker_commission: 0, other_fee: 0 }, expenses);
    expect(result.totalExpense).toBe(1500);
    expect(result.totalVehicleCost).toBe(51500);
    expect(result.refurbishmentCost).toBe(1000);
    expect(result.holdingCost).toBe(500);
  });

  it("excludes unapproved expenses (Draft, Pending, Rejected) from every total", () => {
    const expenses = [
      makeExpense({ id: "e1", category: "Spare parts", amount: 1000, approval_status: "Draft" }),
      makeExpense({ id: "e2", category: "Spare parts", amount: 2000, approval_status: "Pending" }),
      makeExpense({ id: "e3", category: "Spare parts", amount: 3000, approval_status: "Rejected" }),
    ];
    const result = computeCostBreakdown({ agreed_price: 10000, broker_commission: 0, other_fee: 0 }, expenses);
    expect(result.totalExpense).toBe(0);
    expect(result.refurbishmentCost).toBe(0);
    expect(result.totalVehicleCost).toBe(10000);
  });

  it("buckets every expense category into the correct cost bucket", () => {
    const expenses = [
      makeExpense({ id: "e1", category: "Mechanic labour", amount: 100 }),
      makeExpense({ id: "e2", category: "Service", amount: 100 }),
      makeExpense({ id: "e3", category: "Cleaning and detailing", amount: 100 }),
      makeExpense({ id: "e4", category: "Yard rent", amount: 50 }),
      makeExpense({ id: "e5", category: "Transportation", amount: 30 }),
      makeExpense({ id: "e6", category: "Fuel", amount: 20 }),
      makeExpense({ id: "e7", category: "Test ride", amount: 10 }),
      makeExpense({ id: "e8", category: "Document transfer", amount: 40 }),
      makeExpense({ id: "e9", category: "Insurance", amount: 15 }),
      makeExpense({ id: "e10", category: "PUC", amount: 5 }),
      makeExpense({ id: "e11", category: "Advertisement", amount: 25 }),
      makeExpense({ id: "e12", category: "Broker commission", amount: 35 }),
      makeExpense({ id: "e13", category: "Penalty or fine", amount: 12 }),
      makeExpense({ id: "e14", category: "Other", amount: 8 }),
    ];
    const result = computeCostBreakdown(null, expenses);
    expect(result.refurbishmentCost).toBe(300); // mechanic labour + service + cleaning
    expect(result.holdingCost).toBe(50); // yard rent
    expect(result.logisticsCost).toBe(60); // transportation + fuel + test ride
    expect(result.documentationSellingCost).toBe(120); // doc transfer + insurance + PUC + ad + broker commission
    expect(result.otherCost).toBe(20); // penalty + other
    expect(result.totalExpense).toBe(550);
  });
});

describe("computeProfit", () => {
  const cost: CostBreakdown = {
    purchaseCost: 100000,
    refurbishmentCost: 0,
    holdingCost: 0,
    logisticsCost: 0,
    documentationSellingCost: 0,
    otherCost: 0,
    totalExpense: 0,
    totalVehicleCost: 100000,
  };

  it("returns null when there is no sale", () => {
    expect(computeProfit(null, cost)).toBeNull();
    expect(computeProfit(undefined, cost)).toBeNull();
  });

  it("returns null when the sale is not Completed", () => {
    const sale = makeSale({ status: "Pending" });
    expect(computeProfit(sale, cost)).toBeNull();
  });

  it("computes margin math including discount and buyer charges", () => {
    const sale = makeSale({ sale_price: 120000, discount: 2000, buyer_charges: 1000, status: "Completed" });
    const result = computeProfit(sale, cost);
    expect(result).not.toBeNull();
    // netSaleRevenue = 120000 + 1000 - 2000 = 119000
    expect(result!.netSaleRevenue).toBe(119000);
    expect(result!.grossProfit).toBe(19000); // 119000 - 100000
    expect(result!.profitMarginPct).toBeCloseTo((19000 / 119000) * 100);
    expect(result!.returnOnCostPct).toBeCloseTo((19000 / 100000) * 100);
  });

  it("guards against division by zero when net revenue and cost are zero", () => {
    const zeroCost: CostBreakdown = { ...cost, totalVehicleCost: 0 };
    const sale = makeSale({ sale_price: 0, discount: 0, buyer_charges: 0, status: "Completed" });
    const result = computeProfit(sale, zeroCost);
    expect(result).not.toBeNull();
    expect(result!.netSaleRevenue).toBe(0);
    expect(result!.profitMarginPct).toBe(0);
    expect(result!.returnOnCostPct).toBe(0);
  });
});

describe("computeProfitShare", () => {
  const funding = [
    { partnerId: "p1", totalInvested: 60000, fundingPct: 60 },
    { partnerId: "p2", totalInvested: 40000, fundingPct: 40 },
  ];
  const allocations = [
    { partner_id: "p1", percentage: 70 },
    { partner_id: "p2", percentage: 30 },
  ];

  it("splits profit by fixed percentage allocation", () => {
    const result = computeProfitShare(10000, allocations, funding, "Fixed percentage");
    const p1 = result.find((r) => r.partnerId === "p1")!;
    const p2 = result.find((r) => r.partnerId === "p2")!;
    expect(p1.profitShare).toBe(7000);
    expect(p2.profitShare).toBe(3000);
    expect(p1.lossShare).toBe(0);
    expect(p2.lossShare).toBe(0);
    expect(p1.principalReturn).toBe(60000);
    expect(p2.principalReturn).toBe(40000);
  });

  it("splits profit proportionate to vehicle investment", () => {
    const result = computeProfitShare(10000, allocations, funding, "Proportionate to vehicle investment");
    const p1 = result.find((r) => r.partnerId === "p1")!;
    const p2 = result.find((r) => r.partnerId === "p2")!;
    expect(p1.profitShare).toBe(6000);
    expect(p2.profitShare).toBe(4000);
  });

  it("splits losses (not profits) into lossShare for fixed-percentage method", () => {
    const result = computeProfitShare(-10000, allocations, funding, "Fixed percentage");
    const p1 = result.find((r) => r.partnerId === "p1")!;
    const p2 = result.find((r) => r.partnerId === "p2")!;
    expect(p1.profitShare).toBe(0);
    expect(p2.profitShare).toBe(0);
    expect(p1.lossShare).toBe(7000);
    expect(p2.lossShare).toBe(3000);
  });

  it("splits losses proportionate to investment", () => {
    const result = computeProfitShare(-10000, allocations, funding, "Proportionate to vehicle investment");
    const p1 = result.find((r) => r.partnerId === "p1")!;
    const p2 = result.find((r) => r.partnerId === "p2")!;
    expect(p1.lossShare).toBe(6000);
    expect(p2.lossShare).toBe(4000);
    expect(p1.profitShare).toBe(0);
    expect(p2.profitShare).toBe(0);
  });

  it("handles zero funding edge case for proportionate method without throwing", () => {
    const result = computeProfitShare(5000, allocations, [], "Proportionate to vehicle investment");
    expect(result).toEqual([]);
  });

  it("falls back to fixed-percentage behavior for 'Return capital first, then split'", () => {
    const result = computeProfitShare(10000, allocations, funding, "Return capital first, then split");
    const p1 = result.find((r) => r.partnerId === "p1")!;
    expect(p1.profitShare).toBe(7000);
    expect(p1.principalReturn).toBe(60000);
  });
});

describe("computeOverallScore", () => {
  it("returns null for an empty item list", () => {
    expect(computeOverallScore([])).toBeNull();
  });

  it("excludes items whose weight resolves to zero (unknown category, no explicit weight) from the weighted average", () => {
    const items: Pick<InspectionItem, "category" | "score" | "weight">[] = [
      { category: "Unknown category", score: 100, weight: 0 },
      { category: "Brakes", score: 50, weight: 10 },
    ];
    // "Unknown category" has weight 0 and no SCORE_WEIGHTS fallback, so it's excluded entirely;
    // result should equal Brakes' score alone.
    expect(computeOverallScore(items)).toBe(50);
  });

  it("returns null when total weight resolves to zero (e.g. unknown category, no explicit weight)", () => {
    const items: Pick<InspectionItem, "category" | "score" | "weight">[] = [{ category: "Unknown category", score: 80, weight: 0 }];
    expect(computeOverallScore(items)).toBeNull();
  });

  it("computes a weighted average across multiple items using explicit weights", () => {
    const items: Pick<InspectionItem, "category" | "score" | "weight">[] = [
      { category: "Engine", score: 90, weight: 25 },
      { category: "Brakes", score: 60, weight: 10 },
    ];
    // (90*25 + 60*10) / 35 = (2250 + 600) / 35 = 81.43 -> rounds to 81
    expect(computeOverallScore(items)).toBe(81);
  });

  it("falls back to SCORE_WEIGHTS by category when item weight is falsy", () => {
    const items: Pick<InspectionItem, "category" | "score" | "weight">[] = [{ category: "Engine", score: 80, weight: 0 }];
    // weight 0 is falsy, falls back to SCORE_WEIGHTS["Engine"] = 25, so this item counts.
    expect(computeOverallScore(items)).toBe(80);
  });

  it("skips items with a null score", () => {
    const items: Pick<InspectionItem, "category" | "score" | "weight">[] = [
      { category: "Engine", score: null, weight: 25 },
      { category: "Brakes", score: 70, weight: 10 },
    ];
    expect(computeOverallScore(items)).toBe(70);
  });
});

describe("documentCompleteness", () => {
  it("returns zero for an empty document list", () => {
    expect(documentCompleteness([])).toEqual({ pct: 0, verified: 0, total: 0 });
  });

  it("computes rounded percentage of verified documents", () => {
    const docs = [
      { verification_status: "Verified" },
      { verification_status: "Verified" },
      { verification_status: "Pending" },
    ];
    const result = documentCompleteness(docs);
    expect(result.total).toBe(3);
    expect(result.verified).toBe(2);
    expect(result.pct).toBe(67); // 2/3 = 66.67 -> rounds to 67
  });

  it("treats non-Verified statuses as incomplete", () => {
    const docs = [{ verification_status: "Uploaded" }, { verification_status: "Missing" }];
    expect(documentCompleteness(docs)).toEqual({ pct: 0, verified: 0, total: 2 });
  });
});

describe("computePartnerFunding", () => {
  it("only counts Received/Partially used/Fully used investments", () => {
    const investments: Investment[] = [
      makeInvestment({ partner_id: "p1", amount: 1000, status: "Received" }),
      makeInvestment({ partner_id: "p1", amount: 500, status: "Requested" }),
      makeInvestment({ partner_id: "p2", amount: 2000, status: "Partially used" }),
    ];
    const result = computePartnerFunding(investments);
    const p1 = result.find((r) => r.partnerId === "p1")!;
    expect(p1.totalInvested).toBe(1000);
  });

  it("returns an empty array when there are no investments (funding percentage boundary)", () => {
    expect(computePartnerFunding([])).toEqual([]);
  });

  it("returns 100% funding pct for a single-partner investment", () => {
    const investments: Investment[] = [makeInvestment({ partner_id: "p1", amount: 5000, status: "Fully used" })];
    const result = computePartnerFunding(investments);
    expect(result).toEqual([{ partnerId: "p1", totalInvested: 5000, fundingPct: 100 }]);
  });

  it("aggregates multiple investments from the same partner and sorts by total invested descending", () => {
    const investments: Investment[] = [
      makeInvestment({ partner_id: "p1", amount: 1000, status: "Received" }),
      makeInvestment({ partner_id: "p1", amount: 2000, status: "Received" }),
      makeInvestment({ partner_id: "p2", amount: 500, status: "Received" }),
    ];
    const result = computePartnerFunding(investments);
    expect(result[0]).toEqual({ partnerId: "p1", totalInvested: 3000, fundingPct: (3000 / 3500) * 100 });
    expect(result[1]).toEqual({ partnerId: "p2", totalInvested: 500, fundingPct: (500 / 3500) * 100 });
  });
});
