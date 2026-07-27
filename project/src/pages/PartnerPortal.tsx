import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, TrendingUp, IndianRupee, LogOut, Bike, AlertTriangle } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Lightbox } from "@/components/ui/Lightbox";
import { useProofLightbox } from "@/hooks/useProofLightbox";
import { useAuth } from "@/lib/useAuth";
import { formatINR, formatDate } from "@/lib/format";
import { fetchMyInvestments, fetchMyProfitDistributions } from "@/lib/queries";
import type { Investment, ProfitDistribution, ProfitSettlementPayment, Vehicle } from "@/lib/types";

type DistributionRow = ProfitDistribution & { vehicle: Vehicle | null; payments: ProfitSettlementPayment[] };

export function PartnerPortal() {
  const { partner, orgName, signOut } = useAuth();
  const [investments, setInvestments] = useState<(Investment & { vehicle: Vehicle | null })[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const proofLightbox = useProofLightbox("finance-proofs");
  const { t } = useTranslation();
  const trStatus = (value: string) => t("status." + value, { defaultValue: value });

  useEffect(() => {
    if (!partner) return;
    Promise.all([fetchMyInvestments(partner.id), fetchMyProfitDistributions(partner.id)])
      .then(([i, d]) => {
        setInvestments(i);
        setDistributions(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("partnerPortal.failedToLoad")))
      .finally(() => setLoading(false));
  }, [partner, t]);

  const stats = useMemo(() => {
    const totalInvested = investments
      .filter((i) => i.status === "Received" || i.status === "Partially used" || i.status === "Fully used")
      .reduce((s, i) => s + i.amount, 0);
    const totalProfit = distributions.reduce((s, d) => s + d.profit_share, 0);
    const balancePayable = distributions.reduce((s, d) => s + d.balance_payable, 0);
    return { totalInvested, totalProfit, balancePayable };
  }, [investments, distributions]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold leading-tight">{orgName ?? t("partnerPortal.defaultOrg")}</p>
            <p className="text-[11px] text-slate-400 leading-tight"> {t("partnerPortal.partnerPortal")}</p>
          </div>
          <button onClick={() => signOut()} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <LogOut size={16} /> {t("partnerPortal.signOut")}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title={t("partnerPortal.welcome", { name: partner?.name ?? t("partnerPortal.partner") })} description={t("partnerPortal.description")} icon={<Wallet size={20} />} />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
        ) : error ? (
          <Card className="p-6"><EmptyState icon={<AlertTriangle size={24} />} title={t("partnerPortal.failedToLoad")} description={error} /></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard label={t("partnerPortal.totalInvested")} value={formatINR(stats.totalInvested)} icon={<Wallet size={18} />} color="brand" />
              <StatCard label={t("partnerPortal.profitEarned")} value={formatINR(stats.totalProfit)} icon={<TrendingUp size={18} />} color="emerald" />
              <StatCard label={t("partnerPortal.balancePayableToYou")} value={formatINR(stats.balancePayable)} icon={<IndianRupee size={18} />} color="amber" />
            </div>

            <Card className="p-5 mb-6">
              <h3 className="font-semibold text-slate-900 mb-3"> {t("partnerPortal.investments")}</h3>
              {investments.length === 0 ? (
                <EmptyState icon={<Wallet size={24} />} title={t("partnerPortal.noInvestments")} description={t("partnerPortal.noInvestmentsDescription")} />
              ) : (
                <div className="space-y-2">
                  {investments.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{formatINR(i.amount)}</span>
                          <Badge color="slate">{trStatus(i.status)}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          {formatDate(i.investment_date)}
                          {i.vehicle && (
                            <>
                              <Bike size={11} className="ml-1" /> {i.vehicle.stock_number}
                            </>
                          )}
                        </p>
                      </div>
                      {i.proof_urls && i.proof_urls.length > 0 && (
                        <button onClick={() => proofLightbox.open(i.proof_urls ?? [])} className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">
                          {t("partnerPortal.viewProof")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3"> {t("partnerPortal.profitDistributions")}</h3>
              {distributions.length === 0 ? (
                <EmptyState icon={<TrendingUp size={24} />} title={t("partnerPortal.noSettlements")} description={t("partnerPortal.noSettlementsDescription")} />
              ) : (
                <div className="space-y-2">
                  {distributions.map((d) => (
                    <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{d.vehicle?.stock_number ?? t("partnerPortal.vehicle")}</span>
                          <Badge color="slate">{trStatus(d.status)}</Badge>
                        </div>
                        <span className="text-sm text-slate-600">{t("partnerPortal.entitled", { amount: formatINR(d.total_entitlement) })}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2 text-xs text-slate-500">
                        <div>{t("partnerPortal.principal", { amount: formatINR(d.principal_return) })}</div>
                        <div>{t("partnerPortal.profit", { amount: formatINR(d.profit_share) })}</div>
                        <div>{t("partnerPortal.balance", { amount: formatINR(d.balance_payable) })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {proofLightbox.lightbox && (
        <Lightbox
          items={proofLightbox.lightbox.items}
          index={proofLightbox.lightbox.index}
          onIndexChange={proofLightbox.setIndex}
          onClose={proofLightbox.close}
        />
      )}
    </div>
  );
}


