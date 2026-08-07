import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSignature,
  RefreshCw,
  Stamp,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatDate, formatINR } from "@/lib/format";
import {
  agreementDownloadUrl,
  agreementPath,
  canCancel,
  canRefresh,
  cancelESignRequest,
  fetchArticleCodes,
  fetchSaleDocumentRequests,
  fetchStampStates,
  openSignedDocument,
  prepareSaleAgreement,
  refreshESignStatus,
  sendSaleAgreementForSignature,
  type ESignSigner,
  type ProteanDocumentRequest,
  type ProteanRequestStatus,
  type StampState,
} from "@/lib/esign";
import type { Party, Sale, SalePayment } from "@/lib/types";

type SaleWithBuyer = Sale & { buyer?: Party | null; payments?: SalePayment[] };

/** Roles the edge function accepts; anyone else sees the history read-only. */
const SIGNING_ROLES = ["owner", "manager", "sales_executive"];

const STATUS_COLORS: Record<ProteanRequestStatus, "emerald" | "amber" | "red" | "slate"> = {
  completed: "emerald",
  pending: "amber",
  initiated: "amber",
  failed: "red",
  cancelled: "slate",
  expired: "slate",
};

export function SaleSigningPanel({ sale }: { sale: SaleWithBuyer }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { orgId, role } = useAuth();
  const canSign = !!role && SIGNING_ROLES.includes(role);

  const [requests, setRequests] = useState<ProteanDocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"prepare" | "send" | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);

  const [buyer, setBuyer] = useState<ESignSigner>({
    name: sale.buyer?.full_name ?? "",
    mobile: sale.buyer?.mobile ?? "",
    email: sale.buyer?.email ?? "",
    dob: "",
    pan: "",
  });

  // Stamping is an option on sending rather than a separate errand: Protean's single API
  // takes the document, the stamp and the signers together and returns one document.
  const [stamped, setStamped] = useState(false);
  const [states, setStates] = useState<StampState[] | null>(null);
  const [articleCodes, setArticleCodes] = useState<string[] | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);
  const [stamp, setStamp] = useState({
    stateId: "",
    articleCode: "",
    amount: "",
    paidBy: "firstParty" as "firstParty" | "secondParty",
  });

  const reload = useCallback(async () => {
    try {
      setRequests(await fetchSaleDocumentRequests(sale.id));
    } catch {
      // A failed history read is not worth a toast on top of whatever else is on screen;
      // the panel shows nothing sent yet, and the next action reloads it.
    } finally {
      setLoading(false);
    }
  }, [sale.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The state list and article codes live at Protean, so this form can only be filled in
  // once the integration is connected. The failure shows inline rather than as a toast,
  // because it is the explanation for why the fields below are empty.
  useEffect(() => {
    if (!stamped || !orgId || states) return;
    let cancelled = false;
    setStampError(null);
    fetchStampStates(orgId)
      .then((result) => !cancelled && setStates(result))
      .catch((e) => !cancelled && setStampError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [stamped, orgId, states]);

  useEffect(() => {
    if (!stamped || !orgId || !stamp.stateId) return;
    let cancelled = false;
    setArticleCodes(null);
    fetchArticleCodes(orgId, Number(stamp.stateId))
      .then((result) => !cancelled && setArticleCodes(result))
      .catch((e) => !cancelled && setStampError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [stamped, orgId, stamp.stateId]);

  const openStoredAgreement = async (path: string) => {
    try {
      window.open(await agreementDownloadUrl(path), "_blank", "noopener");
    } catch {
      toast(t("saleSigning.openFailed"), "error");
    }
  };

  const signerList = (): ESignSigner[] => [{
    name: buyer.name.trim(),
    mobile: buyer.mobile?.trim() || null,
    email: buyer.email?.trim() || null,
    dob: buyer.dob?.trim() || null,
    pan: buyer.pan?.trim() || null,
  }];

  const handlePrepare = async () => {
    if (!orgId) return;
    setBusy("prepare");
    try {
      const prepared = await prepareSaleAgreement(orgId, sale.id, signerList());
      toast(t("saleSigning.generated"), "success");
      await openStoredAgreement(prepared.document.path);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("saleSigning.generateFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (!orgId) return;
    if (stamped && (!stamp.stateId || !stamp.articleCode || !Number(stamp.amount))) {
      toast(t("saleSigning.stampIncomplete"), "error");
      return;
    }
    setBusy("send");
    try {
      const result = await sendSaleAgreementForSignature(
        orgId,
        sale.id,
        signerList(),
        stamped
          ? {
            stateId: Number(stamp.stateId),
            articleCode: stamp.articleCode,
            stampAmount: Number(stamp.amount),
            paidBy: stamp.paidBy,
          }
          : null,
      );
      setSignUrl(result.signUrl ?? null);
      toast(result.message || t("saleSigning.sent"), "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("saleSigning.sendFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async (requestId: string) => {
    if (!orgId) return;
    setWorking(requestId);
    try {
      await refreshESignStatus(orgId, requestId);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("saleSigning.statusFailed"), "error");
    } finally {
      setWorking(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!orgId) return;
    setWorking(requestId);
    try {
      await cancelESignRequest(orgId, requestId, t("saleSigning.cancelReason"));
      toast(t("saleSigning.cancelled"), "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("saleSigning.cancelFailed"), "error");
    } finally {
      setWorking(null);
    }
  };

  const noContact = !buyer.mobile?.trim() && !buyer.email?.trim();
  const stampDetailsMissing = stamped && (!buyer.dob?.trim() || !buyer.pan?.trim());

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <FileSignature size={18} className="text-slate-400" />
          {t("saleSigning.title")}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">{t("saleSigning.subtitle")}</p>
      </div>

      {canSign && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label={t("saleSigning.buyer")}>
              <input
                className="input"
                value={buyer.name}
                onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
              />
            </Field>
            <Field label={t("saleSigning.mobile")} hint={t("saleSigning.mobileHint")}>
              <input
                className="input"
                value={buyer.mobile ?? ""}
                onChange={(e) => setBuyer((b) => ({ ...b, mobile: e.target.value }))}
                placeholder="9876543210"
              />
            </Field>
            <Field label={t("saleSigning.email")}>
              <input
                className="input"
                value={buyer.email ?? ""}
                onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stamped}
              onChange={(e) => setStamped(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <Stamp size={15} className="text-slate-400" />
            {t("saleSigning.addStamp")}
          </label>

          {stamped && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
              <p className="text-xs text-slate-600">{t("saleSigning.stampHint")}</p>
              {stampError && (
                <p className="text-xs text-red-600 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {stampError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("saleSigning.buyerDob")} required>
                  <input
                    className="input"
                    type="date"
                    value={buyer.dob ?? ""}
                    onChange={(e) => setBuyer((b) => ({ ...b, dob: e.target.value }))}
                  />
                </Field>
                <Field label={t("saleSigning.buyerPan")} required>
                  <input
                    className="input uppercase"
                    value={buyer.pan ?? ""}
                    maxLength={10}
                    placeholder="ABCPK1234C"
                    onChange={(e) => setBuyer((b) => ({ ...b, pan: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("saleSigning.stampState")} required>
                  <Select
                    value={stamp.stateId}
                    onChange={(v) => setStamp((s) => ({ ...s, stateId: v, articleCode: "" }))}
                    placeholder={states ? t("saleSigning.selectState") : t("saleSigning.loading")}
                    options={(states ?? []).map((state) => ({
                      value: String(state.stateId),
                      label: state.stateName,
                    }))}
                  />
                </Field>
                <Field label={t("saleSigning.articleCode")} required>
                  <Select
                    value={stamp.articleCode}
                    onChange={(v) => setStamp((s) => ({ ...s, articleCode: v }))}
                    placeholder={
                      !stamp.stateId
                        ? t("saleSigning.selectStateFirst")
                        : articleCodes
                          ? t("saleSigning.selectArticle")
                          : t("saleSigning.loading")
                    }
                    options={(articleCodes ?? []).map((code) => ({ value: code, label: code }))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("saleSigning.stampAmount")} required>
                  <input
                    className="input"
                    type="number"
                    value={stamp.amount}
                    onChange={(e) => setStamp((s) => ({ ...s, amount: e.target.value }))}
                  />
                </Field>
                <Field label={t("saleSigning.stampPaidBy")}>
                  <Select
                    value={stamp.paidBy}
                    onChange={(v) =>
                      setStamp((s) => ({ ...s, paidBy: v as "firstParty" | "secondParty" }))}
                    options={[
                      { value: "firstParty", label: t("saleSigning.paidByDealer") },
                      { value: "secondParty", label: t("saleSigning.paidByBuyer") },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">{t("saleSigning.disclaimer")}</p>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handlePrepare} disabled={busy !== null} className="btn-secondary">
              {busy === "prepare" ? <Spinner size={14} /> : <Download size={16} />}
              {t("saleSigning.generate")}
            </button>
            <button
              onClick={handleSend}
              disabled={busy !== null || noContact || !buyer.name.trim() || stampDetailsMissing}
              className="btn-primary"
            >
              {busy === "send" ? <Spinner size={14} /> : <FileSignature size={16} />}
              {stamped ? t("saleSigning.sendStamped") : t("saleSigning.send")}
            </button>
            {signUrl && (
              <a href={signUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                <ExternalLink size={14} /> {t("saleSigning.openSignLink")}
              </a>
            )}
          </div>
          {(noContact || stampDetailsMissing) && (
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {noContact ? t("saleSigning.contactRequired") : t("saleSigning.stampDetailsRequired")}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-800 mb-3">{t("saleSigning.history")}</h4>
        {loading ? (
          <Spinner size={16} />
        ) : requests.length === 0 ? (
          <p className="text-xs text-slate-500">{t("saleSigning.noRequests")}</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((request) => {
              const path = agreementPath(request);
              return (
                <li key={request.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {request.document_label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(request.initiated_at, { withTime: true })}
                        {request.stamp_duty_amount
                          ? ` · ${t("saleSigning.stamped")} ${formatINR(request.stamp_duty_amount)}`
                          : ""}
                      </p>
                      {request.error_message && (
                        <p className="text-xs text-red-600 mt-1">{request.error_message}</p>
                      )}
                    </div>
                    <Badge color={STATUS_COLORS[request.status]}>
                      {t(`saleSigning.status.${request.status}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {path && (
                      <button
                        onClick={() => void openStoredAgreement(path)}
                        className="text-brand-600 hover:text-brand-700 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Download size={12} /> {t("saleSigning.openAgreement")}
                      </button>
                    )}
                    {request.document_url && (
                      <button
                        onClick={() =>
                          openSignedDocument(
                            request.document_url as string,
                            `${request.document_label}.pdf`,
                          )}
                        className="text-emerald-700 hover:text-emerald-800 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> {t("saleSigning.openSigned")}
                      </button>
                    )}
                    {canSign && canRefresh(request) && (
                      <button
                        onClick={() => void handleRefresh(request.id)}
                        disabled={working === request.id}
                        className="text-slate-600 hover:text-slate-800 text-xs font-medium inline-flex items-center gap-1"
                      >
                        {working === request.id ? <Spinner size={12} /> : <RefreshCw size={12} />}
                        {t("saleSigning.checkStatus")}
                      </button>
                    )}
                    {canSign && canCancel(request) && (
                      <button
                        onClick={() => void handleCancel(request.id)}
                        disabled={working === request.id}
                        className="text-red-600 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <XCircle size={12} /> {t("saleSigning.cancel")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
