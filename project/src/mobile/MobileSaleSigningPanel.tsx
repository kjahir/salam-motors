import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Download, FileSignature, RefreshCw, Stamp, XCircle } from "lucide-react";
import { Button, Card, Field, Input, Select, Spinner, Tag } from "./ui/primitives";
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

const SIGNING_ROLES = ["owner", "manager", "sales_executive"];

const STATUS_TAGS: Record<ProteanRequestStatus, "success" | "warning" | "error" | "neutral"> = {
  completed: "success",
  pending: "warning",
  initiated: "warning",
  failed: "error",
  cancelled: "neutral",
  expired: "neutral",
};

/**
 * Mobile half of the sale signing flow — the same calls as the desktop panel
 * (`components/SaleSigningPanel.tsx`), laid out for a phone: one column, the stamping
 * fields behind a toggle, and errors shown inline rather than as toasts, which are easy to
 * miss over a full-screen tab.
 */
export function MobileSaleSigningPanel({ sale }: { sale: SaleWithBuyer }) {
  const { t } = useTranslation();
  const { orgId, role } = useAuth();
  const canSign = !!role && SIGNING_ROLES.includes(role);

  const [requests, setRequests] = useState<ProteanDocumentRequest[]>([]);
  const [busy, setBusy] = useState<"prepare" | "send" | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [buyer, setBuyer] = useState<ESignSigner>({
    name: sale.buyer?.full_name ?? "",
    mobile: sale.buyer?.mobile ?? "",
    email: sale.buyer?.email ?? "",
    dob: "",
    pan: "",
  });

  const [stamped, setStamped] = useState(false);
  const [states, setStates] = useState<StampState[] | null>(null);
  const [articleCodes, setArticleCodes] = useState<string[] | null>(null);
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
      // Same as desktop: a failed history read leaves the list empty rather than
      // interrupting; the next action reloads it.
    }
  }, [sale.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fail = (error: unknown, fallback: string) =>
    setMessage({ text: error instanceof Error ? error.message : fallback, tone: "error" });

  useEffect(() => {
    if (!stamped || !orgId || states) return;
    let cancelled = false;
    fetchStampStates(orgId)
      .then((result) => !cancelled && setStates(result))
      .catch((e) => !cancelled && fail(e, t("saleSigning.stampOptionsFailed")));
    return () => {
      cancelled = true;
    };
    // `t` is stable for a given language and including it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamped, orgId, states]);

  useEffect(() => {
    if (!stamped || !orgId || !stamp.stateId) return;
    let cancelled = false;
    setArticleCodes(null);
    fetchArticleCodes(orgId, Number(stamp.stateId))
      .then((result) => !cancelled && setArticleCodes(result))
      .catch((e) => !cancelled && fail(e, t("saleSigning.stampOptionsFailed")));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamped, orgId, stamp.stateId]);

  const openStored = async (path: string) => {
    try {
      window.open(await agreementDownloadUrl(path), "_blank", "noopener");
    } catch {
      setMessage({ text: t("saleSigning.openFailed"), tone: "error" });
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
    setMessage(null);
    try {
      const prepared = await prepareSaleAgreement(orgId, sale.id, signerList());
      setMessage({ text: t("saleSigning.generated"), tone: "ok" });
      await openStored(prepared.document.path);
      await reload();
    } catch (e) {
      fail(e, t("saleSigning.generateFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (!orgId) return;
    if (stamped && (!stamp.stateId || !stamp.articleCode || !Number(stamp.amount))) {
      setMessage({ text: t("saleSigning.stampIncomplete"), tone: "error" });
      return;
    }
    setBusy("send");
    setMessage(null);
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
      setMessage({ text: result.message || t("saleSigning.sent"), tone: "ok" });
      if (result.signUrl) window.open(result.signUrl, "_blank", "noopener");
      await reload();
    } catch (e) {
      fail(e, t("saleSigning.sendFailed"));
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
      fail(e, t("saleSigning.statusFailed"));
    } finally {
      setWorking(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!orgId) return;
    setWorking(requestId);
    try {
      await cancelESignRequest(orgId, requestId, t("saleSigning.cancelReason"));
      setMessage({ text: t("saleSigning.cancelled"), tone: "ok" });
      await reload();
    } catch (e) {
      fail(e, t("saleSigning.cancelFailed"));
    } finally {
      setWorking(null);
    }
  };

  const noContact = !buyer.mobile?.trim() && !buyer.email?.trim();
  const stampDetailsMissing = stamped && (!buyer.dob?.trim() || !buyer.pan?.trim());

  return (
    <Card className="p-4">
      <h3 className="text-sm font-poppins font-semibold text-mobile-text flex items-center gap-2">
        <FileSignature size={15} className="text-mobile-text-muted" />
        {t("saleSigning.title")}
      </h3>
      <p className="text-xs text-mobile-text-muted mt-0.5">{t("saleSigning.subtitle")}</p>

      {canSign && (
        <div className="space-y-3 mt-3">
          <Field label={t("saleSigning.buyer")}>
            <Input value={buyer.name} onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))} />
          </Field>
          <Field
            label={t("saleSigning.mobile")}
            hint={noContact ? t("saleSigning.contactRequired") : t("saleSigning.mobileHint")}
          >
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={buyer.mobile ?? ""}
              onChange={(e) => setBuyer((b) => ({ ...b, mobile: e.target.value }))}
            />
          </Field>
          <Field label={t("saleSigning.email")}>
            <Input
              type="email"
              inputMode="email"
              value={buyer.email ?? ""}
              onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-mobile-text min-h-11">
            <input
              type="checkbox"
              checked={stamped}
              onChange={(e) => setStamped(e.target.checked)}
              className="h-4 w-4 rounded border-mobile-border text-mobile-primary"
            />
            <Stamp size={14} className="text-mobile-text-muted" />
            {t("saleSigning.addStamp")}
          </label>

          {stamped && (
            <div className="rounded-xl border border-mobile-border bg-mobile-bg p-3 space-y-3">
              <p className="text-xs text-mobile-text-muted">{t("saleSigning.stampHint")}</p>
              <Field label={t("saleSigning.buyerDob")} required>
                <Input
                  type="date"
                  value={buyer.dob ?? ""}
                  onChange={(e) => setBuyer((b) => ({ ...b, dob: e.target.value }))}
                />
              </Field>
              <Field label={t("saleSigning.buyerPan")} required>
                <Input
                  className="uppercase"
                  maxLength={10}
                  placeholder="ABCPK1234C"
                  value={buyer.pan ?? ""}
                  onChange={(e) => setBuyer((b) => ({ ...b, pan: e.target.value }))}
                />
              </Field>
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
              <Field label={t("saleSigning.stampAmount")} required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={stamp.amount}
                  onChange={(e) => setStamp((s) => ({ ...s, amount: e.target.value }))}
                />
              </Field>
              <Field label={t("saleSigning.stampPaidBy")}>
                <Select
                  value={stamp.paidBy}
                  onChange={(v) => setStamp((s) => ({ ...s, paidBy: v as "firstParty" | "secondParty" }))}
                  options={[
                    { value: "firstParty", label: t("saleSigning.paidByDealer") },
                    { value: "secondParty", label: t("saleSigning.paidByBuyer") },
                  ]}
                />
              </Field>
            </div>
          )}

          <p className="text-xs text-mobile-text-muted">{t("saleSigning.disclaimer")}</p>

          <div className="flex flex-col gap-2">
            <Button variant="secondary" loading={busy === "prepare"} disabled={busy !== null} onClick={handlePrepare}>
              <Download size={15} /> {t("saleSigning.generate")}
            </Button>
            <Button
              loading={busy === "send"}
              disabled={busy !== null || noContact || !buyer.name.trim() || stampDetailsMissing}
              onClick={handleSend}
            >
              <FileSignature size={15} />
              {stamped ? t("saleSigning.sendStamped") : t("saleSigning.send")}
            </Button>
          </div>
          {stampDetailsMissing && (
            <p className="text-xs text-mobile-warning">{t("saleSigning.stampDetailsRequired")}</p>
          )}
        </div>
      )}

      {message && (
        <p
          className={`text-xs mt-3 rounded-xl px-3 py-2 ${
            message.tone === "ok"
              ? "bg-mobile-success-bg text-mobile-success"
              : "bg-mobile-error-bg text-mobile-error"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-mobile-border">
        <p className="text-xs font-medium text-mobile-text-secondary mb-2">
          {t("saleSigning.history")}
        </p>
        {requests.length === 0 ? (
          <p className="text-xs text-mobile-text-muted">{t("saleSigning.noRequests")}</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((request) => {
              const path = agreementPath(request);
              return (
                <li key={request.id} className="rounded-xl border border-mobile-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-mobile-text break-words">
                      {request.document_label}
                    </p>
                    <Tag color={STATUS_TAGS[request.status]}>
                      {t(`saleSigning.status.${request.status}`)}
                    </Tag>
                  </div>
                  <p className="text-[10px] text-mobile-text-muted mt-1">
                    {formatDate(request.initiated_at)}
                    {request.stamp_duty_amount
                      ? ` · ${t("saleSigning.stamped")} ${formatINR(request.stamp_duty_amount)}`
                      : ""}
                  </p>
                  {request.error_message && (
                    <p className="text-[10px] text-mobile-error mt-1">{request.error_message}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {path && (
                      <button
                        onClick={() => void openStored(path)}
                        className="text-xs font-medium text-mobile-primary inline-flex items-center gap-1 min-h-11"
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
                        className="text-xs font-medium text-mobile-success inline-flex items-center gap-1 min-h-11"
                      >
                        <CheckCircle2 size={12} /> {t("saleSigning.openSigned")}
                      </button>
                    )}
                    {canSign && canRefresh(request) && (
                      <button
                        onClick={() => void handleRefresh(request.id)}
                        disabled={working === request.id}
                        className="text-xs font-medium text-mobile-text-secondary inline-flex items-center gap-1 min-h-11"
                      >
                        {working === request.id ? <Spinner size={12} /> : <RefreshCw size={12} />}
                        {t("saleSigning.checkStatus")}
                      </button>
                    )}
                    {canSign && canCancel(request) && (
                      <button
                        onClick={() => void handleCancel(request.id)}
                        disabled={working === request.id}
                        className="text-xs font-medium text-mobile-error inline-flex items-center gap-1 min-h-11"
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
