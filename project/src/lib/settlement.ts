import { supabase } from "./supabase";
import type { ProfitDistribution } from "./types";

export interface SettlementPaymentInput {
  amount: number;
  paidAt: string; // yyyy-mm-dd
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  proofUrls: string[];
}

export interface SettlementResult {
  fullyPaid: boolean;
  newAmountPaid: number;
  newBalance: number;
  principalPortion: number;
}

/**
 * Records one settlement payment against one distribution: the payment ledger row, the
 * distribution's running totals, and — when the payment covers any of the principal still
 * outstanding — a matching negative "Returned" investment row.
 *
 * Shared by SettlementModal (single distribution, dealer-typed amount) and
 * MultiSettlementModal (several distributions for one partner, each paid off in full from a
 * single physical payment) so both stay in exact agreement on the waterfall rule: principal
 * before profit, ledger-append rather than mutating the original investment.
 *
 * Throws on the first failure — the payment row or distribution update — so the caller can
 * roll back what it already inserted. The trailing investment-return insert is deliberately
 * best-effort instead: by that point the settlement itself is real and already committed, so
 * a failure there shouldn't undo money that has genuinely been paid, only leave that one
 * ledger entry to be corrected by hand.
 */
export async function recordSettlementPayment(
  distribution: Pick<ProfitDistribution, "id" | "partner_id" | "vehicle_id" | "amount_paid" | "total_entitlement" | "principal_return">,
  vehicleStockNumber: string,
  input: SettlementPaymentInput,
  onInvestmentReturnError?: (error: unknown) => void,
): Promise<SettlementResult> {
  const { data: paymentRec, error: payErr } = await supabase.from("profit_settlement_payments").insert({
    distribution_id: distribution.id,
    amount: input.amount,
    payment_method: input.paymentMethod,
    reference: input.reference,
    notes: input.notes,
    proof_url: input.proofUrls[0] ?? null,
    proof_urls: input.proofUrls,
    paid_at: new Date(input.paidAt).toISOString(),
  }).select().single();
  if (payErr) throw payErr;

  try {
    const newAmountPaid = distribution.amount_paid + input.amount;
    const newBalance = Math.max(0, distribution.total_entitlement - newAmountPaid);
    const fullyPaid = newBalance <= 0;
    const { error: updErr } = await supabase.from("profit_distributions").update({
      amount_paid: newAmountPaid,
      balance_payable: newBalance,
      status: fullyPaid ? "Paid" : "Partially paid",
    }).eq("id", distribution.id);
    if (updErr) throw updErr;

    const principalPaidSoFar = Math.min(distribution.amount_paid, distribution.principal_return);
    const principalRemaining = distribution.principal_return - principalPaidSoFar;
    const principalPortion = Math.min(input.amount, principalRemaining);

    if (principalPortion > 0) {
      const { error: investErr } = await supabase.from("investments").insert({
        partner_id: distribution.partner_id,
        vehicle_id: distribution.vehicle_id,
        amount: -principalPortion,
        status: "Returned",
        investment_date: new Date(input.paidAt).toISOString(),
        payment_method: input.paymentMethod,
        reference: input.reference,
        notes: `Capital returned via settlement (${vehicleStockNumber})`,
        proof_url: input.proofUrls[0] ?? null,
        proof_urls: input.proofUrls,
      });
      if (investErr) onInvestmentReturnError?.(investErr);
    }

    return { fullyPaid, newAmountPaid, newBalance, principalPortion };
  } catch (e) {
    await supabase.from("profit_settlement_payments").delete().eq("id", paymentRec.id);
    throw e;
  }
}
