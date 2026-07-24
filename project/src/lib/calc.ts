import type { Expense, InspectionItem, Investment, Sale } from "./types";
import { SCORE_WEIGHTS } from "./constants";

export interface CostBreakdown {
  purchaseCost: number;
  refurbishmentCost: number;
  holdingCost: number;
  logisticsCost: number;
  documentationSellingCost: number;
  otherCost: number;
  totalExpense: number;
  totalVehicleCost: number;
}

export interface ProfitBreakdown {
  netSaleRevenue: number;
  totalVehicleCost: number;
  grossProfit: number;
  profitMarginPct: number;
  returnOnCostPct: number;
}

const REFURB_CATEGORIES = new Set(["Spare parts", "Mechanic labour", "Service", "Cleaning and detailing"]);
const HOLDING_CATEGORIES = new Set(["Yard rent"]);
const LOGISTICS_CATEGORIES = new Set(["Transportation", "Fuel", "Test ride"]);
const DOCS_SELLING_CATEGORIES = new Set(["Document transfer", "Insurance", "PUC", "Advertisement", "Broker commission"]);
const OTHER_CATEGORIES = new Set(["Penalty or fine", "Other"]);

function isApproved(e: Expense): boolean {
  return e.approval_status === "Approved" || e.approval_status === "Paid";
}

export function computeCostBreakdown(
  purchase: { agreed_price: number; broker_commission: number; other_fee: number } | null | undefined,
  expenses: Expense[],
): CostBreakdown {
  const approved = expenses.filter(isApproved);
  const purchaseCost = (purchase?.agreed_price ?? 0) + (purchase?.broker_commission ?? 0) + (purchase?.other_fee ?? 0);
  const refurbishmentCost = sumByCategory(approved, REFURB_CATEGORIES);
  const holdingCost = sumByCategory(approved, HOLDING_CATEGORIES);
  const logisticsCost = sumByCategory(approved, LOGISTICS_CATEGORIES);
  const documentationSellingCost = sumByCategory(approved, DOCS_SELLING_CATEGORIES);
  const otherCost = sumByCategory(approved, OTHER_CATEGORIES);
  const totalExpense = approved.reduce((s, e) => s + e.amount, 0);
  const totalVehicleCost = purchaseCost + totalExpense;
  return {
    purchaseCost,
    refurbishmentCost,
    holdingCost,
    logisticsCost,
    documentationSellingCost,
    otherCost,
    totalExpense,
    totalVehicleCost,
  };
}

function sumByCategory(expenses: Expense[], cats: Set<string>): number {
  return expenses.filter((e) => cats.has(e.category)).reduce((s, e) => s + e.amount, 0);
}

export function computeProfit(sale: Sale | null | undefined, cost: CostBreakdown): ProfitBreakdown | null {
  if (!sale || sale.status !== "Completed") return null;
  const netSaleRevenue = sale.sale_price + sale.buyer_charges - sale.discount;
  const grossProfit = netSaleRevenue - cost.totalVehicleCost;
  const profitMarginPct = netSaleRevenue > 0 ? (grossProfit / netSaleRevenue) * 100 : 0;
  const returnOnCostPct = cost.totalVehicleCost > 0 ? (grossProfit / cost.totalVehicleCost) * 100 : 0;
  return { netSaleRevenue, totalVehicleCost: cost.totalVehicleCost, grossProfit, profitMarginPct, returnOnCostPct };
}

export function computeOverallScore(items: Pick<InspectionItem, "category" | "score" | "weight">[]): number | null {
  if (items.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of items) {
    const weight = item.weight || SCORE_WEIGHTS[item.category] || 0;
    if (item.score !== null && item.score !== undefined && weight > 0) {
      weightedSum += item.score * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

export interface PartnerFunding {
  partnerId: string;
  totalInvested: number;
  fundingPct: number;
}

export function computePartnerFunding(investments: Investment[]): PartnerFunding[] {
  const byPartner = new Map<string, number>();
  let total = 0;
  for (const inv of investments) {
    if (inv.status === "Received" || inv.status === "Partially used" || inv.status === "Fully used") {
      byPartner.set(inv.partner_id, (byPartner.get(inv.partner_id) ?? 0) + inv.amount);
      total += inv.amount;
    }
  }
  const result: PartnerFunding[] = [];
  for (const [partnerId, amount] of byPartner) {
    result.push({ partnerId, totalInvested: amount, fundingPct: total > 0 ? (amount / total) * 100 : 0 });
  }
  return result.sort((a, b) => b.totalInvested - a.totalInvested);
}

export function computeProfitShare(
  profit: number,
  allocations: { partner_id: string; percentage: number }[],
  funding: PartnerFunding[],
  method: string,
): { partnerId: string; principalReturn: number; profitShare: number; lossShare: number }[] {
  const isLoss = profit < 0;
  const absProfit = Math.abs(profit);

  if (method === "Proportionate to vehicle investment") {
    const totalFunding = funding.reduce((s, f) => s + f.totalInvested, 0);
    return funding.map((f) => ({
      partnerId: f.partnerId,
      principalReturn: f.totalInvested,
      profitShare: isLoss ? 0 : totalFunding > 0 ? (absProfit * f.fundingPct) / 100 : 0,
      lossShare: isLoss ? (totalFunding > 0 ? (absProfit * f.fundingPct) / 100 : 0) : 0,
    }));
  }

  // Default: fixed percentage (also covers "Return capital first, then split")
  return allocations.map((a) => {
    const fund = funding.find((f) => f.partnerId === a.partner_id);
    return {
      partnerId: a.partner_id,
      principalReturn: fund?.totalInvested ?? 0,
      profitShare: isLoss ? 0 : (absProfit * a.percentage) / 100,
      lossShare: isLoss ? (absProfit * a.percentage) / 100 : 0,
    };
  });
}

export function documentCompleteness(documents: { verification_status: string }[]): {
  pct: number;
  verified: number;
  total: number;
} {
  const total = documents.length;
  if (total === 0) return { pct: 0, verified: 0, total: 0 };
  const verified = documents.filter((d) => d.verification_status === "Verified").length;
  return { pct: Math.round((verified / total) * 100), verified, total };
}

export function generateSlug(base: string): string {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
