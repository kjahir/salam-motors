import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Field, Select, Input, Spinner, EmptyState, Sheet, Button } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { AttachButton, Combobox, MoreDetailsButton, RowCommitButton, RowDeleteButton, type QuickRowState } from "./ui/QuickEntryRow";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchPartners } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { formatINR } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { fileFromPath, type UploadedFile } from "@/lib/uploadedFile";
import type { Expense, Partner, Purchase } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const BUCKET = "finance-proofs";

interface ExpenseRow {
  key: string;
  id: string | null;
  createdHere: boolean;
  category: string;
  amount: string;
  vendor: string;
  description: string;
  paid_by_partner_id: string;
  expense_date: string;
  files: UploadedFile[];
  expanded: boolean;
  dirty: boolean;
  busy: boolean;
}

const emptyRow = (): ExpenseRow => ({
  key: crypto.randomUUID(),
  id: null,
  createdHere: false,
  category: "",
  amount: "",
  vendor: "",
  description: "",
  paid_by_partner_id: "",
  expense_date: new Date().toISOString().slice(0, 10),
  files: [],
  expanded: false,
  dirty: false,
  busy: false,
});

const rowFromExpense = (e: Expense): ExpenseRow => ({
  key: e.id,
  id: e.id,
  createdHere: false,
  category: e.category,
  amount: String(e.amount),
  vendor: e.vendor ?? "",
  description: e.description ?? "",
  paid_by_partner_id: e.paid_by_partner_id ?? "",
  expense_date: e.expense_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  files: (e.bill_urls?.length ? e.bill_urls : e.bill_url ? [e.bill_url] : []).map(fileFromPath),
  expanded: false,
  dirty: false,
  busy: false,
});

const rowState = (row: ExpenseRow): QuickRowState => (row.id === null ? "draft" : row.dirty ? "dirty" : "saved");
const rowComplete = (row: ExpenseRow) => Boolean(row.category.trim()) && Boolean(row.amount) && Number(row.amount) > 0;
const hasDetails = (row: ExpenseRow) => Boolean(row.vendor || row.description || row.paid_by_partner_id);

// Mobile counterpart of src/pages/QuickAddExpense.tsx — the same one-line-per-expense
// model, saved row by row with no page-level save button. Two lines per row here rather
// than one, because a phone cannot fit category, amount and four 44px controls across.
export function MobileAddExpense({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rows, setRows] = useState<ExpenseRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [purchaseCost, setPurchaseCost] = useState(0);
  /** Row awaiting delete confirmation — see the Sheet at the bottom of this file. */
  const [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchPartners().then(setPartners).catch(() => {});
  }, []);

  useEffect(() => {
    if (!vehicleId) {
      setRows([emptyRow()]);
      setPurchaseCost(0);
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    (async () => {
      const [expensesRes, purchaseRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("vehicle_id", vehicleId)
          .is("deleted_at", null)
          .order("expense_date", { ascending: false }),
        supabase.from("purchases").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (expensesRes.error) toast(expensesRes.error.message, "error");
      setRows([...((expensesRes.data ?? []) as Expense[]).map(rowFromExpense), emptyRow()]);
      // Same three components computeCostBreakdown() treats as purchase cost, so the
      // "Purchase" line here matches the vehicle's own Total Cost rather than just the
      // sticker price.
      const purchase = purchaseRes.data as Purchase | null;
      setPurchaseCost(
        (purchase?.agreed_price ?? 0) + (purchase?.broker_commission ?? 0) + (purchase?.other_fee ?? 0),
      );
      setLoadingRows(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const patchRow = useCallback((key: string, patch: Partial<ExpenseRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const editRow = useCallback((key: string, patch: Partial<ExpenseRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.id !== null } : r)));
  }, []);

  const payload = (row: ExpenseRow) => {
    const billPaths = row.files.map((f) => f.path);
    return {
      vehicle_id: vehicleId,
      category: row.category.trim(),
      amount: Number(row.amount),
      expense_date: row.expense_date,
      paid_by_partner_id: row.paid_by_partner_id || null,
      vendor: row.vendor.trim() || null,
      description: row.description.trim() || null,
      bill_available: billPaths.length > 0,
      bill_url: billPaths[0] ?? null,
      bill_urls: billPaths,
    };
  };

  const handleAdd = async (row: ExpenseRow) => {
    if (!rowComplete(row)) return;
    patchRow(row.key, { busy: true });
    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          ...payload(row),
          approval_status: "Approved",
          approved_by: user?.email ?? "Unknown",
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      setRows((rs) => [
        ...rs.map((r) => (r.key === row.key ? { ...r, id: data.id as string, createdHere: true, dirty: false, busy: false, expanded: false } : r)),
        emptyRow(),
      ]);
      toast(t("mobileExpenses.added"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileExpenses.saveFailed"), "error");
    }
  };

  const handleSave = async (row: ExpenseRow) => {
    if (!row.id || !rowComplete(row)) return;
    patchRow(row.key, { busy: true });
    try {
      const { error } = await supabase.from("expenses").update(payload(row)).eq("id", row.id);
      if (error) throw error;
      patchRow(row.key, { dirty: false, busy: false });
      toast(t("mobileExpenses.updated"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileExpenses.saveFailed"), "error");
    }
  };

  const handleDelete = async (row: ExpenseRow) => {
    if (!row.id) return;
    setPendingDelete(null);
    patchRow(row.key, { busy: true });
    try {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({ entity_type: "expense", entity_id: row.id, action: "deleted", performed_by: user?.email ?? "Unknown" })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log expense deletion", auditErr);
        });
      setRows((rs) => rs.filter((r) => r.key !== row.key));
      toast(t("mobileExpenses.removed"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileExpenses.deleteFailed"), "error");
    }
  };

  // A row typed and committed in this session deletes straight away — it is an obvious
  // undo of something the dealer just did. Anything already on file gets a confirmation,
  // via the Sheet below rather than window.confirm(): several mobile in-app browsers
  // suppress the native dialog outright, which silently made the minus button do nothing.
  const requestDelete = (row: ExpenseRow) => {
    if (!row.id) return;
    if (row.createdHere) {
      handleDelete(row);
      return;
    }
    setPendingDelete(row);
  };

  // Derived from `rows`, so it moves the moment a row is added, deleted, or retyped.
  const savedTotal = rows.filter((r) => r.id).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div>
      <TopBar title={t("mobileExpenses.addExpenses")} onBack={onBack} />
      <div className="p-4 space-y-3 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {vehicleId && !loadingRows && (
          <Card className="p-3.5">
            <TotalLine label={t("mobileExpenses.purchaseCost")} value={formatINR(purchaseCost)} />
            <TotalLine label={t("mobileExpenses.totalExpense")} value={formatINR(savedTotal)} />
            <TotalLine label={t("mobileExpenses.combinedTotal")} value={formatINR(purchaseCost + savedTotal)} emphasis />
          </Card>
        )}

        {!vehicleId && (
          <Card className="p-5">
            <EmptyState title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleExpense")} />
          </Card>
        )}

        {vehicleId && loadingRows && (
          <div className="flex items-center justify-center py-10"><Spinner size={24} /></div>
        )}

        {vehicleId && !loadingRows && (
          <>
            {rows.map((row) => {
              const state = rowState(row);
              return (
                <Card key={row.key} className={`p-3 space-y-2.5 ${state === "draft" ? "border-mobile-primary/30" : ""}`}>
                  <Combobox
                    value={row.category}
                    onChange={(v) => editRow(row.key, { category: v })}
                    options={EXPENSE_CATEGORIES}
                    placeholder={t("quickEntry.categoryPlaceholder")}
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      className="flex-1 min-w-0"
                      value={row.amount}
                      onChange={(e) => editRow(row.key, { amount: e.target.value })}
                      placeholder=""
                    />
                    <AttachButton
                      bucket={BUCKET}
                      pathPrefix={`${vehicleId}/${row.key}`}
                      value={row.files}
                      onChange={(files) => editRow(row.key, { files })}
                    />
                    <MoreDetailsButton open={row.expanded} onToggle={() => patchRow(row.key, { expanded: !row.expanded })} badge={hasDetails(row)} />
                    <RowCommitButton state={state} busy={row.busy} disabled={!rowComplete(row)} onAdd={() => handleAdd(row)} onSave={() => handleSave(row)} />
                    <RowDeleteButton state={state} busy={row.busy} onDelete={() => requestDelete(row)} />
                  </div>

                  {row.expanded && (
                    <div className="space-y-3 border-t border-mobile-border pt-3 animate-fade-in">
                      <Field label={t("mobileExpenses.description")}>
                        <Input value={row.description} onChange={(e) => editRow(row.key, { description: e.target.value })} placeholder="Brake pads + air filter" />
                      </Field>
                      <Field label={t("mobileExpenses.vendor")}>
                        <Input value={row.vendor} onChange={(e) => editRow(row.key, { vendor: e.target.value })} placeholder="Sai Spares" />
                      </Field>
                      <Field label={t("mobileExpenses.paidBy")}>
                        <Select
                          value={row.paid_by_partner_id}
                          onChange={(v) => editRow(row.key, { paid_by_partner_id: v })}
                          placeholder={t("mobileExpenses.business")}
                          options={partners.map((p) => ({ value: p.id, label: p.name }))}
                        />
                      </Field>
                      {/* No upload grid here on purpose: the paperclip on the row above already
                          attaches bills, and having camera/library/file in both places made the
                          same job look like two different jobs. */}
                      <Field label={t("quickEntry.date")}>
                        <Input type="date" value={row.expense_date} onChange={(e) => editRow(row.key, { expense_date: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </Card>
              );
            })}

            {/* The running total lives in the summary card under the vehicle picker now, so
                there is no second copy of it down here. */}
            <button
              onClick={() => onNavigate("vehicle", { vehicleId, tab: "expenses" })}
              className="w-full py-2 text-sm font-medium text-mobile-primary"
            >
              {t("quickEntry.openVehicle")}
            </button>
          </>
        )}
      </div>

      <Sheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("mobileExpenses.deleteConfirm")}
        description={
          pendingDelete
            ? `${pendingDelete.category || t("mobileExpenses.category")} · ${formatINR(Number(pendingDelete.amount) || 0)}`
            : undefined
        }
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setPendingDelete(null)}>
              {t("mobileExpenses.cancel")}
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => pendingDelete && handleDelete(pendingDelete)}>
              {t("mobileVehicle.delete")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-mobile-text-secondary">{t("mobileExpenses.deleteConfirmBody")}</p>
      </Sheet>
    </div>
  );
}

/** One label/value line in the purchase / expense / combined summary. */
function TotalLine({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${emphasis ? "border-t border-mobile-border mt-1 pt-2.5" : ""}`}>
      <span className={`text-sm ${emphasis ? "font-semibold text-mobile-text" : "text-mobile-text-secondary"}`}>{label}</span>
      <span className={`shrink-0 ${emphasis ? "text-base font-poppins font-bold text-mobile-text" : "text-sm font-medium text-mobile-text"}`}>{value}</span>
    </div>
  );
}
