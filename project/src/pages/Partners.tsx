import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Wallet, TrendingUp, IndianRupee, AlertTriangle, Trash2, Banknote, Download, KeyRound, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, Field, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatDate, formatPercent, initials } from "@/lib/format";
import { downloadCSV } from "@/lib/calc";
import { fetchPartners, fetchInvestments, fetchProfitDistributions, fetchFinancialSummaries } from "@/lib/queries";
import { INVESTMENT_TOTAL_STATUSES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { AddInvestmentModal } from "@/components/AddInvestmentModal";
import { SettlementModal } from "@/components/SettlementModal";
import { MultiSettlementModal } from "@/components/MultiSettlementModal";
import { AssignVehicleCostModal } from "@/components/AssignVehicleCostModal";
import { Lightbox } from "@/components/ui/Lightbox";
import { useProofLightbox } from "@/hooks/useProofLightbox";
import type { Partner, Investment, ProfitDistribution, ProfitSettlementPayment, Vehicle, VehicleFinancialSummary } from "@/lib/types";
import { vehicleRef } from "@/lib/vehicleLabel";
import type { PageKey, NavigateParams } from "@/components/Layout";

type DistributionRow = ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };
type InvestmentRow = Investment & { partner: Partner | null; vehicle: Vehicle | null };

interface PartnersProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Partners({ onNavigate }: PartnersProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [summaries, setSummaries] = useState<VehicleFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", default_profit_share_pct: "50" });
  const [submitting, setSubmitting] = useState(false);
  const [addInvestmentOpen, setAddInvestmentOpen] = useState(false);
  const [settlingDistribution, setSettlingDistribution] = useState<DistributionRow | null>(null);
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<Set<string>>(new Set());
  const [multiSettleRows, setMultiSettleRows] = useState<DistributionRow[] | null>(null);
  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null);
  const [invitingPartner, setInvitingPartner] = useState<Partner | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingSubmitting, setInvitingSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, orgId, role } = useAuth();
  const isOwner = role === "owner";
  const proofLightbox = useProofLightbox("finance-proofs");
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  const pendingDistributions = useMemo(() => distributions.filter((d) => d.status !== "Paid"), [distributions]);
  const selectedPartnerId = useMemo(() => {
    for (const d of pendingDistributions) {
      if (selectedSettlementIds.has(d.id)) return d.partner_id;
    }
    return null;
  }, [pendingDistributions, selectedSettlementIds]);

  const toggleSettlementSelect = (d: DistributionRow) => {
    setSelectedSettlementIds((prev) => {
      const next = new Set(prev);
      if (next.has(d.id)) {
        next.delete(d.id);
        return next;
      }
      // Switching to a different partner starts a fresh selection rather than mixing
      // partners — a combined settlement is one payment to one partner.
      if (selectedPartnerId && selectedPartnerId !== d.partner_id) {
        toast(t("partnersPage.differentPartnerSelected"), "info");
        return new Set([d.id]);
      }
      next.add(d.id);
      return next;
    });
  };

  // A sold vehicle's distributions should collectively return its full total_vehicle_cost
  // as principal — that only happens automatically when an investment was logged against
  // the vehicle at purchase time (computePartnerFunding in calc.ts). When nothing was
  // logged, every partner's principal_return silently stays 0 and this gap never surfaces
  // anywhere else, so it's computed fresh here from the same summaries the rest of the app
  // already treats as the source of truth for "what this vehicle cost".
  const unattributedCostRows = useMemo(() => {
    const summaryMap = new Map(summaries.map((s) => [s.vehicle_id, s]));
    const byVehicle = new Map<string, { vehicle: Vehicle | null; principalSum: number; rows: DistributionRow[] }>();
    for (const d of distributions) {
      const entry = byVehicle.get(d.vehicle_id) ?? { vehicle: d.vehicle, principalSum: 0, rows: [] };
      entry.principalSum += d.principal_return;
      entry.rows.push(d);
      byVehicle.set(d.vehicle_id, entry);
    }
    const rows: { vehicleId: string; vehicle: Vehicle | null; unattributed: number; distributions: DistributionRow[] }[] = [];
    for (const [vehicleId, entry] of byVehicle) {
      const totalCost = summaryMap.get(vehicleId)?.total_vehicle_cost ?? 0;
      const unattributed = totalCost - entry.principalSum;
      // Half-rupee guard against float drift, not a real gap worth surfacing.
      if (unattributed > 0.5) rows.push({ vehicleId, vehicle: entry.vehicle, unattributed, distributions: entry.rows });
    }
    return rows.sort((a, b) => b.unattributed - a.unattributed);
  }, [distributions, summaries]);

  const reload = useCallback(async () => {
    try {
      const [p, i, d, s] = await Promise.all([fetchPartners(), fetchInvestments(), fetchProfitDistributions(), fetchFinancialSummaries()]);
      setPartners(p);
      setInvestments(i);
      setDistributions(d);
      setSummaries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("partnersPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const partnerStats = useMemo(() => {
    return partners.map((p) => {
      const inv = investments.filter((i) => i.partner_id === p.id);
      const totalInvested = inv
        .filter((i) => INVESTMENT_TOTAL_STATUSES.includes(i.status))
        .reduce((s, i) => s + i.amount, 0);
      const dist = distributions.filter((d) => d.partner_id === p.id);
      const totalProfit = dist.reduce((s, d) => s + d.profit_share, 0);
      const totalPaid = dist.reduce((s, d) => s + d.amount_paid, 0);
      const balancePayable = dist.reduce((s, d) => s + d.balance_payable, 0);
      const activeVehicles = new Set(inv.filter((i) => i.vehicle_id).map((i) => i.vehicle_id)).size;
      return { partner: p, totalInvested, totalProfit, totalPaid, balancePayable, activeVehicles, investmentCount: inv.length };
    });
  }, [partners, investments, distributions]);

  const totalInvestedAll = partnerStats.reduce((s, p) => s + p.totalInvested, 0);

  // A partner can only be the destination for a vehicle-cost assignment if they currently
  // stand to have that much capital with the business — net of every return already settled
  // anywhere, not just on this vehicle (totalInvested already nets "Returned" rows per
  // INVESTMENT_TOTAL_STATUSES). Otherwise the assignment would be handing back money the
  // partner never actually put in.
  const partnersWithNetInvestment = useMemo(
    () => partnerStats.map(({ partner, totalInvested }) => ({ ...partner, netInvestment: totalInvested })),
    [partnerStats],
  );
  const totalProfitAll = partnerStats.reduce((s, p) => s + p.totalProfit, 0);
  const totalPayableAll = partnerStats.reduce((s, p) => s + p.balancePayable, 0);

  const handleAdd = async () => {
    if (!form.name) {
      toast(t("partnersPage.enterName"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("partners").insert({
        name: form.name,
        mobile: form.mobile || null,
        email: form.email || null,
        default_profit_share_pct: Number(form.default_profit_share_pct) || 0,
      });
      if (error) throw error;
      toast(t("partnersPage.partnerAdded"), "success");
      setShowAdd(false);
      setForm({ name: "", mobile: "", email: "", default_profit_share_pct: "50" });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("partnersPage.addFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("partnersPage.deleteConfirm"))) return;
    try {
      const { error } = await supabase.from("partners").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({ entity_type: "partner", entity_id: id, action: "deleted", performed_by: user?.email ?? "Unknown" })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log partner deletion", auditErr);
        });
      toast(t("partnersPage.partnerRemoved"), "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("partnersPage.deleteFailed"), "error");
    }
  };

  const openInvite = (p: Partner) => {
    setInvitingPartner(p);
    setInviteEmail("");
  };

  const handleInvitePartner = async () => {
    if (!invitingPartner) return;
    if (!inviteEmail.trim()) {
      toast("Enter an email address", "error");
      return;
    }
    if (!orgId) {
      toast("No active organization", "error");
      return;
    }
    setInvitingSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          org_id: orgId,
          email: inviteEmail.trim(),
          kind: "partner",
          partner_id: invitingPartner.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast("Portal invite sent", "success");
      setInvitingPartner(null);
      setInviteEmail("");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send invite", "error");
    } finally {
      setInvitingSubmitting(false);
    }
  };

  const handleRevokePortalAccess = async (p: Partner) => {
    if (!confirm(`Revoke ${p.name}'s portal access? They will no longer be able to sign in to view their investments.`)) return;
    try {
      const { error } = await supabase.from("partners").update({ auth_user_id: null }).eq("id", p.id);
      if (error) throw error;
      toast("Portal access revoked", "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to revoke access", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("partnersPage.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("partnersPage.title")} />
        <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("partnersPage.failedToLoad")} description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("partnersPage.title")}
        description={t("partnersPage.description")}
        icon={<Users size={20} />}
        actions={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> {t("partnersPage.addPartner")}</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label={t("partnersPage.totalCapitalInvested")} value={formatINR(totalInvestedAll, { compact: true })} icon={<Wallet size={20} />} color="brand" />
        <StatCard label={t("partnersPage.totalProfitEarned")} value={formatINR(totalProfitAll, { compact: true })} icon={<TrendingUp size={20} />} color="emerald" />
        <StatCard label={t("partnersPage.balancePayable")} value={formatINR(totalPayableAll, { compact: true })} icon={<IndianRupee size={20} />} color="amber" />
      </div>

      {partnerStats.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Users size={24} />} title={t("partnersPage.noPartners")} description={t("partnersPage.noPartnersDescription")} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {partnerStats.map(({ partner: p, totalInvested, totalProfit, totalPaid, balancePayable, activeVehicles }) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
                    {initials(p.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.mobile ?? t("partnersPage.noMobile")} Â· {t("partnersPage.joined", { date: formatDate(p.joining_date) })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={p.status === "active" ? "emerald" : "slate"}>{trStatus(p.status)}</Badge>
                  {p.auth_user_id ? (
                    <Badge color="blue">Portal linked</Badge>
                  ) : isOwner ? (
                    <button
                      onClick={() => openInvite(p)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100 hover:ring-blue-600/30 transition-colors"
                    >
                      <KeyRound size={13} /> Invite
                    </button>
                  ) : null}
                  {p.auth_user_id && isOwner && (
                    <button onClick={() => handleRevokePortalAccess(p)} className="text-slate-400 hover:text-amber-600 p-1" title="Revoke portal access">
                      <Unlink size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.defaultProfitShare")}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatPercent(p.default_profit_share_pct, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.activeVehicles")}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{activeVehicles}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.capitalInvested")}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatINR(totalInvested)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.profitEarned")}</p>
                  <p className="text-sm font-semibold text-emerald-600 mt-0.5">{formatINR(totalProfit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.amountPaid")}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatINR(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500"> {t("partnersPage.balancePayable")}</p>
                  <p className="text-sm font-semibold text-amber-600 mt-0.5">{formatINR(balancePayable)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {partners.length > 0 && (
        <>
          <div className="mt-6">
            <InvestmentLedgerTable
              investments={investments}
              partners={partners}
              onAddInvestment={() => setAddInvestmentOpen(true)}
              onNavigate={onNavigate}
              proofLightbox={proofLightbox}
            />
          </div>

          {unattributedCostRows.length > 0 && (
            <div className="mt-6">
              <UnattributedVehicleCostTable rows={unattributedCostRows} onNavigate={onNavigate} onAssign={setAssigningVehicleId} />
            </div>
          )}

          <div className="mt-6">
            <SettlementQueueTable
              distributions={pendingDistributions}
              selectedIds={selectedSettlementIds}
              selectedPartnerId={selectedPartnerId}
              onToggle={toggleSettlementSelect}
              onSettleOne={setSettlingDistribution}
              onSettleSelected={() => setMultiSettleRows(pendingDistributions.filter((d) => selectedSettlementIds.has(d.id)))}
              onNavigate={onNavigate}
            />
          </div>

          <div className="mt-6">
            <PartnerLedgerReport partners={partners} investments={investments} distributions={distributions} />
          </div>
        </>
      )}

      {/* Profit-share allocations note */}
      <Card className="p-4 mt-5 bg-slate-50/50">
        <p className="text-xs text-slate-600">
          <strong className="font-medium">{t("partnersPage.profitModelLabel")}</strong> {t("partnersPage.profitModel", { percentages: partners.map((p) => `${p.default_profit_share_pct}%`).join(" / ") })}
        </p>
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={t("partnersPage.addPartner")}
        footer={<>
          <button onClick={() => setShowAdd(false)} className="btn-secondary"> {t("partnersPage.cancel")}</button>
          <button onClick={handleAdd} disabled={submitting} className="btn-primary">{submitting ? <Spinner size={14} /> : null} {t("partnersPage.addPartner")}</button>
        </>}
      >
        <div className="space-y-4">
          <Field label={t("partnersPage.fullName")} required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Arjun Mehta" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("partnersPage.mobile")}><input className="input" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="9876543210" /></Field>
            <Field label={t("partnersPage.email")}><input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="arjun@example.com" /></Field>
          </div>
          <Field label={t("partnersPage.defaultShare")} hint={t("partnersPage.defaultShareHint")}><input className="input" type="number" value={form.default_profit_share_pct} onChange={(e) => setForm((f) => ({ ...f, default_profit_share_pct: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(invitingPartner)}
        onClose={() => setInvitingPartner(null)}
        title={`Invite ${invitingPartner?.name ?? "Partner"} to the Portal`}
        footer={
          <>
            <button onClick={() => setInvitingPartner(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleInvitePartner} disabled={invitingSubmitting} className="btn-primary">
              {invitingSubmitting ? <Spinner size={14} /> : null} Send Invite
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            They&apos;ll be able to sign in and view only their own investments and profit distributions - read-only, nothing else in the app.
          </p>
          <Field label="Email" required>
            <input
              className="input"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="partner@example.com"
            />
          </Field>
        </div>
      </Modal>

      <AddInvestmentModal
        partner={null}
        partners={partners}
        open={addInvestmentOpen}
        onClose={() => setAddInvestmentOpen(false)}
        onSaved={reload}
      />
      {settlingDistribution && (
        <SettlementModal
          distribution={settlingDistribution}
          open={Boolean(settlingDistribution)}
          onClose={() => setSettlingDistribution(null)}
          onSaved={reload}
        />
      )}
      {multiSettleRows && (
        <MultiSettlementModal
          distributions={multiSettleRows}
          open={Boolean(multiSettleRows)}
          onClose={() => setMultiSettleRows(null)}
          onSaved={() => {
            setSelectedSettlementIds(new Set());
            setMultiSettleRows(null);
            reload();
          }}
        />
      )}
      {assigningVehicleId && (() => {
        const row = unattributedCostRows.find((r) => r.vehicleId === assigningVehicleId);
        if (!row) return null;
        return (
          <AssignVehicleCostModal
            vehicleId={row.vehicleId}
            vehicle={row.vehicle}
            unattributedAmount={row.unattributed}
            distributions={row.distributions}
            partners={partnersWithNetInvestment}
            open={Boolean(assigningVehicleId)}
            onClose={() => setAssigningVehicleId(null)}
            onSaved={() => {
              setAssigningVehicleId(null);
              reload();
            }}
          />
        );
      })()}
      {proofLightbox.lightbox && (
        <Lightbox
          items={proofLightbox.lightbox.items}
          index={proofLightbox.lightbox.index}
          onClose={proofLightbox.close}
          onIndexChange={proofLightbox.setIndex}
        />
      )}
    </div>
  );
}

/** All investment rows across every partner, including the negative "Returned" ledger
 *  entries a settlement appends (src/lib/settlement.ts) — this is the full ledger, not a
 *  per-partner summary, so an admin can audit any single money movement in one place. */
function InvestmentLedgerTable({ investments, partners, onAddInvestment, onNavigate, proofLightbox }: {
  investments: InvestmentRow[];
  partners: Partner[];
  onAddInvestment: () => void;
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  proofLightbox: ReturnType<typeof useProofLightbox>;
}) {
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });
  const rows = useMemo(
    () => [...investments].sort((a, b) => +new Date(b.investment_date) - +new Date(a.investment_date)),
    [investments],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">{t("partnersPage.investmentLedgerTitle")}</h3>
        <button onClick={onAddInvestment} className="btn-primary btn-sm" disabled={partners.length === 0}>
          <Plus size={14} /> {t("partnersPage.addInvestment")}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="p-6"><EmptyState icon={<Wallet size={20} />} title={t("partnersPage.noInvestmentsYet")} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600">
                <th className="px-4 py-3 font-medium">{t("financePage.columns.partner")}</th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.vehicle")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("financePage.columns.amount")}</th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.date")}</th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.status")}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((inv) => {
                const isReturn = inv.amount < 0;
                const paths = inv.proof_urls?.length ? inv.proof_urls : inv.proof_url ? [inv.proof_url] : [];
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.partner?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {inv.vehicle_id ? (
                        <button onClick={() => onNavigate("vehicle", { vehicleId: inv.vehicle_id! })} className="text-left text-brand-600 hover:text-brand-700">
                          {vehicleRef(inv.vehicle)}
                        </button>
                      ) : (
                        <span className="text-slate-500">{t("partnersPage.generalCapital")}</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${isReturn ? "text-red-600" : "text-slate-900"}`}>{formatINR(inv.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.investment_date)}</td>
                    <td className="px-4 py-3"><Badge color={isReturn ? "slate" : "emerald"}>{trStatus(inv.status)}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {paths.length > 0 && (
                        <button onClick={() => proofLightbox.open(paths)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                          {paths.length > 1 ? t("partnersPage.proofWithCount", { count: paths.length }) : t("partnersPage.proof")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Every distribution still owed, across every partner — the checkbox column only lets a
 *  combined selection span one partner at a time (a combined settlement is one physical
 *  payment to one partner), enforced by the parent's toggle handler. */
/** Sold vehicles whose distributions don't yet account for the full total_vehicle_cost as
 *  principal — nobody logged an investment against them at purchase time, so the cost has
 *  no owner to settle to until an admin picks one. Only rendered when non-empty: this is a
 *  data-integrity flag to act on, not a permanent ledger like the two tables above it. */
function UnattributedVehicleCostTable({ rows, onNavigate, onAssign }: {
  rows: { vehicleId: string; vehicle: Vehicle | null; unattributed: number }[];
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
  onAssign: (vehicleId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden border-amber-200">
      <div className="p-4 border-b border-amber-100 bg-amber-50/50">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" /> {t("partnersPage.unattributedCostTitle")}
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">{t("partnersPage.unattributedCostHint")}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-600">
              <th className="px-4 py-3 font-medium">{t("financePage.columns.vehicle")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("partnersPage.amountToAssign")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.vehicleId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button onClick={() => onNavigate("vehicle", { vehicleId: r.vehicleId })} className="text-left text-brand-600 hover:text-brand-700">
                    {vehicleRef(r.vehicle)}
                  </button>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatINR(r.unattributed)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onAssign(r.vehicleId)} className="btn-secondary btn-sm">
                    {t("partnersPage.assign")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SettlementQueueTable({ distributions, selectedIds, selectedPartnerId, onToggle, onSettleOne, onSettleSelected, onNavigate }: {
  distributions: DistributionRow[];
  selectedIds: Set<string>;
  selectedPartnerId: string | null;
  onToggle: (d: DistributionRow) => void;
  onSettleOne: (d: DistributionRow) => void;
  onSettleSelected: () => void;
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}) {
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });
  const rows = useMemo(
    () => [...distributions].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [distributions],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-slate-900">{t("partnersPage.settlementQueueTitle")}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t("partnersPage.multiSelectHint")}</p>
        </div>
        <button onClick={onSettleSelected} disabled={selectedIds.size < 2} className="btn-primary btn-sm">
          <Banknote size={14} /> {t("partnersPage.settleSelected", { count: selectedIds.size })}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="p-6"><EmptyState icon={<Banknote size={20} />} title={t("partnersPage.nothingPending")} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.partner")}</th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.vehicle")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("financePage.columns.principal")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("financePage.columns.profit")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("financePage.columns.total")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("financePage.columns.paid")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("partnersPage.balance")}</th>
                <th className="px-4 py-3 font-medium">{t("financePage.columns.status")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((d) => {
                const disabled = selectedPartnerId !== null && selectedPartnerId !== d.partner_id && !selectedIds.has(d.id);
                return (
                  <tr key={d.id} className={`hover:bg-slate-50 ${disabled ? "opacity-40" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        disabled={disabled}
                        onChange={() => onToggle(d)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.partner?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {d.vehicle_id ? (
                        <button onClick={() => onNavigate("vehicle", { vehicleId: d.vehicle_id })} className="text-left text-brand-600 hover:text-brand-700">
                          {vehicleRef(d.vehicle)}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{formatINR(d.principal_return)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(d.profit_share)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatINR(d.total_entitlement)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(d.amount_paid)}</td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">{formatINR(d.balance_payable)}</td>
                    <td className="px-4 py-3"><Badge color={d.status === "Partially paid" ? "amber" : "slate"}>{trStatus(d.status)}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onSettleOne(d)} className="btn-primary btn-sm shrink-0">
                        <Banknote size={13} /> {t("partnersPage.settle")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PartnerLedgerReport({ partners, investments, distributions }: {
  partners: Partner[];
  investments: (Investment & { partner: Partner | null; vehicle: Vehicle | null })[];
  distributions: (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null })[];
}) {
  const { t } = useTranslation();
  const rows = partners.map((p) => {
    const inv = investments.filter((i) => i.partner_id === p.id);
    const dist = distributions.filter((d) => d.partner_id === p.id);
    const totalInvested = inv.filter((i) => INVESTMENT_TOTAL_STATUSES.includes(i.status)).reduce((s, i) => s + i.amount, 0);
    const principalReturned = dist.reduce((s, d) => s + d.principal_return, 0);
    const profitCredited = dist.reduce((s, d) => s + d.profit_share, 0);
    const paid = dist.reduce((s, d) => s + d.amount_paid, 0);
    const balance = dist.reduce((s, d) => s + d.balance_payable, 0);
    const closingBalance = totalInvested - principalReturned;
    return { partner: p, totalInvested, principalReturned, profitCredited, paid, balance, closingBalance, invCount: inv.length };
  });

  const exportCsv = () => {
    downloadCSV("partner-ledger.csv", rows.map((r) => ({
      Partner: r.partner.name,
      "Total Invested": r.totalInvested,
      "Principal Returned": r.principalReturned,
      "Profit Credited": r.profitCredited,
      "Amount Paid": r.paid,
      "Balance Payable": r.balance,
      "Closing Balance": r.closingBalance,
      "Investment Count": r.invCount,
    })));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900"> {t("partnersPage.ledgerTitle")}</h3>
        <button onClick={exportCsv} className="btn-secondary btn-sm"><Download size={14} /> {t("partnersPage.exportCsv")}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-600">
              <th className="px-4 py-3 font-medium"> {t("financePage.columns.partner")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.invested")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.principalReturned")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.profitCredited")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.paid")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.balance")}</th>
              <th className="px-4 py-3 font-medium text-right"> {t("partnersPage.closing")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.partner.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{r.partner.name}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.totalInvested)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(r.principalReturned)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(r.profitCredited)}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.paid)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{formatINR(r.balance)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatINR(r.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr className="font-semibold">
              <td className="px-4 py-3"> {t("partnersPage.total")}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.totalInvested, 0))}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatINR(rows.reduce((s, r) => s + r.principalReturned, 0))}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatINR(rows.reduce((s, r) => s + r.profitCredited, 0))}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.paid, 0))}</td>
              <td className="px-4 py-3 text-right text-amber-600">{formatINR(rows.reduce((s, r) => s + r.balance, 0))}</td>
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.closingBalance, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

