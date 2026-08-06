import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { vehicleRef } from "@/lib/vehicleLabel";
import type { Partner, ProfitDistribution, Vehicle } from "@/lib/types";

type Row = ProfitDistribution & { partner: Partner | null };
type PartnerWithNet = Partner & { netInvestment: number };

interface AssignVehicleCostModalProps {
  vehicleId: string;
  vehicle: Vehicle | null;
  /** Total cost minus whatever principal_return is already attributed across this vehicle's
   *  distributions — the gap nobody's investment ever covered. */
  unattributedAmount: number;
  /** This vehicle's existing distribution rows, so assigning to a partner who already has
   *  one (created at sale time for their profit share) tops it up instead of duplicating it. */
  distributions: Row[];
  /** Every partner with their current net investment (sum of INVESTMENT_TOTAL_STATUSES
   *  amounts, so an already-settled "Returned" row already nets it down) — only those with
   *  at least `unattributedAmount` still standing are offered, so this action can never hand
   *  a partner back more capital than they've actually put into the business. */
  partners: PartnerWithNet[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AssignVehicleCostModal({ vehicleId, vehicle, unattributedAmount, distributions, partners, open, onClose, onSaved }: AssignVehicleCostModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [partnerId, setPartnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const eligiblePartners = partners.filter((p) => p.netInvestment >= unattributedAmount);

  const handleClose = () => {
    setPartnerId("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!partnerId) {
      toast(t("financeModals.selectPartnerRequired"), "error");
      return;
    }
    if (!eligiblePartners.some((p) => p.id === partnerId)) {
      toast(t("partnersPage.insufficientNetInvestment"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const existing = distributions.find((d) => d.partner_id === partnerId);
      let distributionId: string;

      if (existing) {
        const newPrincipal = existing.principal_return + unattributedAmount;
        const newTotalEntitlement = newPrincipal + existing.profit_share - existing.loss_share;
        const newBalance = newTotalEntitlement - existing.amount_paid;
        const { error } = await supabase.from("profit_distributions").update({
          principal_return: newPrincipal,
          total_entitlement: newTotalEntitlement,
          balance_payable: newBalance,
          status: newBalance <= 0 ? "Paid" : existing.amount_paid > 0 ? "Partially paid" : "Calculated",
        }).eq("id", existing.id);
        if (error) throw error;
        distributionId = existing.id;
      } else {
        const { data, error } = await supabase.from("profit_distributions").insert({
          vehicle_id: vehicleId,
          partner_id: partnerId,
          principal_return: unattributedAmount,
          profit_share: 0,
          loss_share: 0,
          total_entitlement: unattributedAmount,
          amount_paid: 0,
          balance_payable: unattributedAmount,
          status: "Calculated",
        }).select().single();
        if (error) throw error;
        distributionId = data.id;
      }

      const partnerName = partners.find((p) => p.id === partnerId)?.name ?? partnerId;
      supabase.from("audit_logs").insert({
        entity_type: "profit_distribution",
        entity_id: distributionId,
        action: "vehicle_cost_assigned",
        performed_by: user?.email ?? "Unknown",
        reason: `Vehicle cost of ${formatINR(unattributedAmount)} manually assigned to ${partnerName} for ${vehicleRef(vehicle)} — no investment was logged at purchase.`,
      }).then(({ error: auditErr }) => {
        if (auditErr) console.error("Failed to log vehicle cost assignment", auditErr);
      });

      toast(t("partnersPage.costAssigned"), "success");
      onSaved();
      handleClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("partnersPage.costAssignFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("partnersPage.assignCostTitle", { vehicle: vehicleRef(vehicle) })}
      description={t("partnersPage.assignCostDescription", { amount: formatINR(unattributedAmount) })}
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary">{t("financeModals.cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting || !partnerId || eligiblePartners.length === 0} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} {t("partnersPage.assign")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {eligiblePartners.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {t("partnersPage.noEligiblePartners", { amount: formatINR(unattributedAmount) })}
          </p>
        ) : (
          <Field label={t("financeModals.partner")} required hint={t("partnersPage.assignCostHint")}>
            <Select
              value={partnerId}
              onChange={setPartnerId}
              placeholder={t("financeModals.selectPartnerPlaceholder")}
              options={eligiblePartners.map((p) => ({ value: p.id, label: `${p.name} (${formatINR(p.netInvestment)})` }))}
            />
          </Field>
        )}
        <div className="rounded-lg bg-slate-50 p-3 text-sm flex items-center justify-between">
          <span className="text-slate-500">{t("partnersPage.amountToAssign")}</span>
          <span className="font-semibold text-slate-900">{formatINR(unattributedAmount)}</span>
        </div>
      </div>
    </Modal>
  );
}
