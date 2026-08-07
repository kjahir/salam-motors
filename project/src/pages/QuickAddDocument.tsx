import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText } from "lucide-react";
import { PageHeader, Field, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { AttachButton, MoreDetailsButton, RowCommitButton, RowDeleteButton, ROW_ACTIONS_WIDTH, type QuickRowState } from "@/components/QuickEntryControls";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { syncVehicleAlerts } from "@/lib/compliance";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { fileFromPath, type UploadedFile } from "@/lib/uploadedFile";
import type { VehicleDocument } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

const BUCKET = "vehicle-documents";

interface DocumentRow {
  key: string;
  /** null until the row has been written to the database. */
  id: string | null;
  /** Saved during this visit, so deleting it needs no confirmation. */
  createdHere: boolean;
  docType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuer: string;
  notes: string;
  files: UploadedFile[];
  expanded: boolean;
  dirty: boolean;
  busy: boolean;
}

const emptyRow = (): DocumentRow => ({
  key: crypto.randomUUID(),
  id: null,
  createdHere: false,
  docType: "",
  documentNumber: "",
  issueDate: "",
  expiryDate: "",
  issuer: "",
  notes: "",
  files: [],
  expanded: false,
  dirty: false,
  busy: false,
});

const rowFromDocument = (d: VehicleDocument): DocumentRow => ({
  key: d.id,
  id: d.id,
  createdHere: false,
  docType: d.document_type,
  documentNumber: d.document_number ?? "",
  issueDate: d.issue_date?.slice(0, 10) ?? "",
  expiryDate: d.expiry_date?.slice(0, 10) ?? "",
  issuer: d.issuer ?? "",
  notes: d.notes ?? "",
  files: (d.file_urls?.length ? d.file_urls : d.file_url ? [d.file_url] : []).map(fileFromPath),
  expanded: false,
  dirty: false,
  busy: false,
});

const rowState = (row: DocumentRow): QuickRowState => (row.id === null ? "draft" : row.dirty ? "dirty" : "saved");
/** Gates the commit button, so an empty row's "+" is visibly unavailable rather than erroring on click. */
const rowComplete = (row: DocumentRow) => Boolean(row.docType.trim());
const hasDetails = (row: DocumentRow) => Boolean(row.documentNumber || row.issueDate || row.expiryDate || row.issuer || row.notes);

// Desktop counterpart to src/mobile/MobileAddDocument.tsx, and the same one-line-per-record
// pattern as QuickAddExpense.tsx: document type, attach, details, commit, delete. Rows are
// saved individually — see QuickEntryControls.tsx for what each trailing slot means.
export function QuickAddDocument({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [rows, setRows] = useState<DocumentRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // The vehicle's existing documents load as saved rows, so this page is both the entry
  // form and the editable list of what is already on file for the vehicle.
  useEffect(() => {
    if (!vehicleId) {
      setRows([emptyRow()]);
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    supabase
      .from("vehicle_documents")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast(error.message, "error");
        setRows([...((data ?? []) as VehicleDocument[]).map(rowFromDocument), emptyRow()]);
        setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const patchRow = useCallback((key: string, patch: Partial<DocumentRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  // Any user edit on an already-saved row flips it to "dirty", which is what turns its
  // commit slot from an inert tick into an active save button.
  const editRow = useCallback((key: string, patch: Partial<DocumentRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.id !== null } : r)));
  }, []);

  const validate = (row: DocumentRow) => {
    if (!row.docType.trim()) {
      toast(t("quickEntry.documentTypeRequired"), "error");
      return false;
    }
    return true;
  };

  const payload = (row: DocumentRow) => {
    const filePaths = row.files.map((f) => f.path);
    return {
      vehicle_id: vehicleId,
      document_type: row.docType.trim(),
      document_number: row.documentNumber.trim() || null,
      issue_date: row.issueDate || null,
      expiry_date: row.expiryDate || null,
      issuer: row.issuer.trim() || null,
      notes: row.notes.trim() || null,
      verification_status: filePaths.length > 0 ? "Uploaded" : "Not uploaded",
      file_url: filePaths[0] ?? null,
      file_urls: filePaths,
    };
  };

  const handleAdd = async (row: DocumentRow) => {
    if (!validate(row)) return;
    patchRow(row.key, { busy: true });
    try {
      const { data, error } = await supabase.from("vehicle_documents").insert(payload(row)).select("id").single();
      if (error) throw error;
      setRows((rs) => [
        ...rs.map((r) => (r.key === row.key ? { ...r, id: data.id as string, createdHere: true, dirty: false, busy: false, expanded: false } : r)),
        emptyRow(),
      ]);
      toast(t("mobileDocuments.added"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileDocuments.saveFailed"), "error");
    }
  };

  const handleSave = async (row: DocumentRow) => {
    if (!row.id || !validate(row)) return;
    patchRow(row.key, { busy: true });
    try {
      const { error } = await supabase.from("vehicle_documents").update(payload(row)).eq("id", row.id);
      if (error) throw error;
      patchRow(row.key, { dirty: false, busy: false });
      toast(t("quickEntry.documentUpdated"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileDocuments.saveFailed"), "error");
    }
  };

  const handleDelete = async (row: DocumentRow) => {
    if (!row.id) return;
    if (!row.createdHere && !confirm(t("quickEntry.deleteDocumentConfirm"))) return;
    patchRow(row.key, { busy: true });
    try {
      const { error } = await supabase.from("vehicle_documents").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({ entity_type: "vehicle_document", entity_id: row.id, action: "deleted", performed_by: user?.email ?? "Unknown" })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log document deletion", auditErr);
        });
      setRows((rs) => rs.filter((r) => r.key !== row.key));
      toast(t("quickEntry.documentRemoved"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
    } catch (e) {
      patchRow(row.key, { busy: false });
      toast(e instanceof Error ? e.message : t("mobileExpenses.deleteFailed"), "error");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <PageHeader
        title={t("mobileDocuments.addDocuments")}
        icon={<FileText size={20} />}
        actions={
          vehicleId ? (
            <button onClick={() => onNavigate("vehicle", { vehicleId, tab: "documents" })} className="btn-secondary">
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
          <EmptyState icon={<FileText size={20} />} title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleDocument")} />
        </Card>
      )}

      {vehicleId && loadingRows && (
        <div className="flex items-center justify-center py-12"><Spinner size={28} /></div>
      )}

      {/* The card deliberately has no overflow-hidden: the type dropdown must escape it. */}
      {vehicleId && !loadingRows && (
        <Card>
          <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="flex-1 text-xs font-medium text-slate-500">{t("mobileDocuments.documentType")}</span>
            <div className={`${ROW_ACTIONS_WIDTH} shrink-0`} />
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const state = rowState(row);
              return (
                <div key={row.key} className={`last:rounded-b-xl ${state === "draft" ? "bg-brand-50/40" : ""}`}>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Combobox
                      className="flex-1"
                      value={row.docType}
                      onChange={(v) => editRow(row.key, { docType: v })}
                      options={DOCUMENT_TYPES}
                      placeholder={t("quickEntry.documentTypePlaceholder")}
                    />
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
                        <Field label={t("quickEntry.documentNumber")}>
                          <input className="input" value={row.documentNumber} onChange={(e) => editRow(row.key, { documentNumber: e.target.value })} />
                        </Field>
                        <Field label={t("quickEntry.issueDate")}>
                          <input className="input" type="date" value={row.issueDate} onChange={(e) => editRow(row.key, { issueDate: e.target.value })} />
                        </Field>
                        <Field label={t("quickEntry.expiryDate")}>
                          <input className="input" type="date" value={row.expiryDate} onChange={(e) => editRow(row.key, { expiryDate: e.target.value })} />
                        </Field>
                        <Field label={t("quickEntry.issuer")}>
                          <input className="input" value={row.issuer} onChange={(e) => editRow(row.key, { issuer: e.target.value })} />
                        </Field>
                        <Field label={t("quickEntry.notes")} className="sm:col-span-2">
                          <input className="input" value={row.notes} onChange={(e) => editRow(row.key, { notes: e.target.value })} />
                        </Field>
                      </div>
                      <FileUploadGrid
                        bucket={BUCKET}
                        pathPrefix={`${vehicleId}/${row.key}`}
                        value={row.files}
                        onChange={(files) => editRow(row.key, { files })}
                        hint={t("mobileDocuments.hint")}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
