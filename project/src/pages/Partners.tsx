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
import { fetchPartners, fetchInvestments, fetchProfitDistributions } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { AddInvestmentModal } from "@/components/AddInvestmentModal";
import { SettlementModal } from "@/components/SettlementModal";
import { Lightbox } from "@/components/ui/Lightbox";
import { useProofLightbox } from "@/hooks/useProofLightbox";
import type { Partner, Investment, ProfitDistribution, ProfitSettlementPayment, Vehicle } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

type DistributionRow = ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };

interface PartnersProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

export function Partners({ onNavigate }: PartnersProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [investments, setInvestments] = useState<(Investment & { partner: Partner | null; vehicle: Vehicle | null })[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", default_profit_share_pct: "50" });
  const [submitting, setSubmitting] = useState(false);
  const [investingPartner, setInvestingPartner] = useState<Partner | null>(null);
  const [settlingDistribution, setSettlingDistribution] = useState<DistributionRow | null>(null);
  const [invitingPartner, setInvitingPartner] = useState<Partner | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingSubmitting, setInvitingSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, orgId, role } = useAuth();
  const isOwner = role === "owner";
  const proofLightbox = useProofLightbox("finance-proofs");
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  const reload = useCallback(async () => {
    try {
      const [p, i, d] = await Promise.all([fetchPartners(), fetchInvestments(), fetchProfitDistributions()]);
      setPartners(p);
      setInvestments(i);
      setDistributions(d);
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
        .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
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
          {partnerStats.map(({ partner: p, totalInvested, totalProfit, totalPaid, balancePayable, activeVehicles, investmentCount }) => (
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
                      <KeyRound size={13} /> Invite to Portal
                    </button>
                  ) : null}
                  <button onClick={() => setInvestingPartner(p)} className="btn-secondary btn-sm"><Plus size={13} /> {t("partnersPage.investment")}</button>
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

              {/* Recent investments */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">{t("partnersPage.recentInvestments", { count: investmentCount })}</p>
                {investments.filter((i) => i.partner_id === p.id).slice(0, 3).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between w-full p-2 rounded hover:bg-slate-50 text-sm">
                    <button
                      onClick={() => inv.vehicle_id && onNavigate("vehicle", { vehicleId: inv.vehicle_id })}
                      className="text-left flex-1 min-w-0"
                      disabled={!inv.vehicle_id}
                    >
                      <span className="text-slate-700">{inv.vehicle ? `${inv.vehicle.manufacturer} ${inv.vehicle.model}` : t("partnersPage.generalCapital")}</span>
                      {inv.vehicle && <span className="text-xs text-slate-400 ml-1.5">{inv.vehicle.stock_number}</span>}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium text-slate-900">{formatINR(inv.amount)}</span>
                      {(() => {
                        const paths = inv.proof_urls?.length ? inv.proof_urls : inv.proof_url ? [inv.proof_url] : [];
                        return paths.length > 0 ? (
                          <button onClick={() => proofLightbox.open(paths)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            {paths.length > 1 ? t("partnersPage.proofWithCount", { count: paths.length }) : t("partnersPage.proof")}
                          </button>
                        ) : null;
                      })()}
                    </div>
                  </div>
                ))}
                {investmentCount === 0 && <p className="text-xs text-slate-400"> {t("partnersPage.noInvestmentsYet")}</p>}
              </div>

              {/* Pending settlements */}
              {(() => {
                const partnerDistributions = distributions.filter((d) => d.partner_id === p.id);
                const pending = partnerDistributions.filter((d) => d.status !== "Paid");
                const settledCount = partnerDistributions.length - pending.length;
                return (
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">
                      {t("partnersPage.pendingSettlements", { count: pending.length })}{settledCount > 0 && <span className="text-slate-400"> Â· {t("partnersPage.settledCount", { count: settledCount })}</span>}
                    </p>
                    {pending.length === 0 ? (
                      <p className="text-xs text-slate-400"> {t("partnersPage.nothingPending")}</p>
                    ) : (
                      <div className="space-y-2">
                        {pending.map((d) => (
                          <div key={d.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 text-sm">
                            <button
                              onClick={() => d.vehicle_id && onNavigate("vehicle", { vehicleId: d.vehicle_id })}
                              className="text-left flex-1 min-w-0"
                            >
                              <span className="text-slate-700">{d.vehicle?.stock_number ?? "â€”"}</span>
                              <span className="text-xs text-slate-400 ml-1.5">{t("partnersPage.dueOf", { due: formatINR(d.balance_payable), total: formatINR(d.total_entitlement) })}</span>
                            </button>
                            <button onClick={() => setSettlingDistribution(d)} className="btn-primary btn-sm shrink-0">
                              <Banknote size={13} /> {t("partnersPage.settle")}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {partners.length > 0 && (
        <div className="mt-5">
          <PartnerLedgerReport partners={partners} investments={investments} distributions={distributions} />
        </div>
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

      {investingPartner && (
        <AddInvestmentModal
          partner={investingPartner}
          open={Boolean(investingPartner)}
          onClose={() => setInvestingPartner(null)}
          onSaved={reload}
        />
      )}
      {settlingDistribution && (
        <SettlementModal
          distribution={settlingDistribution}
          open={Boolean(settlingDistribution)}
          onClose={() => setSettlingDistribution(null)}
          onSaved={reload}
        />
      )}
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

function PartnerLedgerReport({ partners, investments, distributions }: {
  partners: Partner[];
  investments: (Investment & { partner: Partner | null; vehicle: Vehicle | null })[];
  distributions: (ProfitDistribution & { partner: Partner | null; vehicle: Vehicle | null })[];
}) {
  const { t } = useTranslation();
  const rows = partners.map((p) => {
    const inv = investments.filter((i) => i.partner_id === p.id);
    const dist = distributions.filter((d) => d.partner_id === p.id);
    const totalInvested = inv.filter((i) => ["Received", "Partially used", "Fully used"].includes(i.status)).reduce((s, i) => s + i.amount, 0);
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
                <td className="px-4 py-3 text-right">{formatINR(r.principalReturned)}</td>
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
              <td className="px-4 py-3 text-right">{formatINR(rows.reduce((s, r) => s + r.principalReturned, 0))}</td>
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

