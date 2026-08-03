import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Receipt } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { AttachButton, MoreDetailsButton, RowCommitButton, RowDeleteButton, ROW_ACTIONS_WIDTH, type QuickRowState } from "@/components/QuickEntryControls";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchPartners } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { formatINR } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { fileFromPath, type UploadedFile } from "@/lib/uploadedFile";
import type { Expense, Partner } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

const BUCKET = "finance-proofs";

interface ExpenseRow {
  key: string;
  /** null until the row has been written to the database. */
  id: string | null;
  /** Saved during this visit, so deleting it needs no confirmation. */
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
/** Gates the commit button, so an empty row's "+" is visibly unavailable rather than erroring on click. */
const rowComplete = (row: ExpenseRow) => Boolean(row.category.trim()) && Boolean(row.amount) && Number(row.amount) > 0;
const hasDetails = (row: ExpenseRow) => Boolean(row.vendor || row.description || row.paid_by_partner_id);

// Desktop counterpart to src/mobile/MobileAddExpense.tsx. Each expense is one line —
// category, amount, attach, details, commit, delete — and rows are saved individually, so
// there is no page-level save button. See QuickEntryControls.tsx for what each trailing
// slot means; the state machine here is draft -> saved, and saved -> dirty on any edit.
export function QuickAddExpense({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rows, setRows] = useState<ExpenseRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchPartners().then(setPartners).catch(() => {});
  }, []);

  // The vehicle's existing expenses load as saved rows, so this page is both the entry
  // form and the editable list of what has already been recorded against the vehicle.
  useEffect(() => {
    if (!vehicleId) {
      setRows([emptyRow()]);
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    supabase
      .from("expenses")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast(error.message, "error");
        setRows([...((data ?? []) as Expense[]).map(rowFromExpense), emptyRow()]);
        setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const patchRow = useCallback((key: string, patch: Partial<ExpenseRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  // Any user edit on an already-saved row flips it to "dirty", which is what turns its
  // commit slot from an inert tick into an active save button.
  const editRow = useCallback((key: string, patch: Partial<ExpenseRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.id !== null } : r)));
  }, []);

  const validate = (row: ExpenseRow) => {
    if (!row.category.trim()) {
      toast(t("quickEntry.categoryRequired"), "error");
      return false;
    }
    if (!row.amount || Number(row.amount) <= 0) {
      toast(t("mobileExpenses.validAmount"), "error");
      return false;
    }
    return true;
  };

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
    if (!validate(row)) return;
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
    if (!row.id || !validate(row)) return;
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
    if (!row.createdHere && !confirm(t("mobileExpenses.deleteConfirm"))) return;
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

  const savedTotal = rows.filter((r) => r.id).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <PageHeader
        title={t("mobileExpenses.addExpenses")}
        icon={<Receipt size={20} />}
        actions={
          vehicleId ? (
            <button onClick={() => onNavigate("vehicle", { vehicleId, tab: "expenses" })} className="btn-secondary">
              <ExternalLink size={16} /> {t("quickEntry.openVehicle")}
            </button>
          ) : undefined
        }
      />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {!vehicleId && (
        <Card className="p-6">
          <EmptyState icon={<Receipt size={20} />} title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleExpense")} />
        </Card>
      )}

      {vehicleId && loadingRows && (
        <div className="flex items-center justify-center py-12"><Spinner size={28} /></div>
      )}

      {/* The card deliberately has no overflow-hidden: the category dropdown must escape it. */}
      {vehicleId && !loadingRows && (
        <Card>
          <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="grid flex-1 grid-cols-12 gap-2">
              <span className="col-span-7 text-xs font-medium text-slate-500">{t("mobileExpenses.category")}</span>
              <span className="col-span-5 text-xs font-medium text-slate-500">{t("mobileExpenses.amount")}</span>
            </div>
            <div className={`${ROW_ACTIONS_WIDTH} shrink-0`} />
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const state = rowState(row);
              return (
                <div key={row.key} className={`last:rounded-b-xl ${state === "draft" ? "bg-brand-50/40" : ""}`}>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <div className="grid flex-1 grid-cols-12 gap-2">
                      <Combobox
                        className="col-span-7"
                        value={row.category}
                        onChange={(v) => editRow(row.key, { category: v })}
                        options={EXPENSE_CATEGORIES}
                        placeholder={t("quickEntry.categoryPlaceholder")}
                      />
                      <input
                        className="input col-span-5"
                        type="number"
                        min={0}
                        value={row.amount}
                        onChange={(e) => editRow(row.key, { amount: e.target.value })}
                        placeholder=""
                      />
                    </div>
                    <AttachButton
                      bucket={BUCKET}
                      pathPrefix={`${vehicleId}/${row.key}`}
                      value={row.files}
                      onChange={(files) => editRow(row.key, { files })}
                    />
                    <MoreDetailsButton
                      open={row.expanded}
                      onToggle={() => patchRow(row.key, { expanded: !row.expanded })}
                      badge={hasDetails(row)}
                    />
                    <RowCommitButton state={state} busy={row.busy} disabled={!rowComplete(row)} onAdd={() => handleAdd(row)} onSave={() => handleSave(row)} />
                    <RowDeleteButton state={state} busy={row.busy} onDelete={() => handleDelete(row)} />
                  </div>

                  {row.expanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label={t("mobileExpenses.description")}>
                          <input className="input" value={row.description} onChange={(e) => editRow(row.key, { description: e.target.value })} placeholder="Brake pads + air filter" />
                        </Field>
                        <Field label={t("mobileExpenses.vendor")}>
                          <input className="input" value={row.vendor} onChange={(e) => editRow(row.key, { vendor: e.target.value })} placeholder="Sai Spares" />
                        </Field>
                        <Field label={t("mobileExpenses.paidBy")}>
                          <Select
                            value={row.paid_by_partner_id}
                            onChange={(v) => editRow(row.key, { paid_by_partner_id: v })}
                            placeholder={t("mobileExpenses.business")}
                            options={partners.map((p) => ({ value: p.id, label: p.name }))}
                          />
                        </Field>
                        <Field label={t("quickEntry.date")}>
                          <input className="input" type="date" value={row.expense_date} onChange={(e) => editRow(row.key, { expense_date: e.target.value })} />
                        </Field>
                      </div>
                   {/*    <FileUploadGrid
                        bucket={BUCKET}
                        pathPrefix={`${vehicleId}/${row.key}`}
                        value={row.files}
                        onChange={(files) => editRow(row.key, { files })}
                        label={t("quickEntry.bill")}
                        hint={t("mobileExpenses.hint")}
                      /> */}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {savedTotal > 0 && (
            <div className="flex items-center justify-between rounded-b-xl border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-900">{t("quickEntry.total")}</span>
              <span className="text-sm font-bold text-slate-900">{formatINR(savedTotal)}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
