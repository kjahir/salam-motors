import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar, Card, Field, Input, Spinner, EmptyState } from "./ui/primitives";
import { VehicleSelectField } from "./ui/VehicleSelectField";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { AttachButton, Combobox, MoreDetailsButton, RowCommitButton, RowDeleteButton, type QuickRowState } from "./ui/QuickEntryRow";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { syncVehicleAlerts } from "@/lib/compliance";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { fileFromPath, type UploadedFile } from "@/lib/uploadedFile";
import type { VehicleDocument } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

const BUCKET = "vehicle-documents";

interface DocumentRow {
  key: string;
  id: string | null;
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
const rowComplete = (row: DocumentRow) => Boolean(row.docType.trim());
const hasDetails = (row: DocumentRow) => Boolean(row.documentNumber || row.issueDate || row.expiryDate || row.issuer || row.notes);

// Mobile counterpart of src/pages/QuickAddDocument.tsx — same one-line-per-document model,
// saved row by row, laid out over two lines to keep 44px touch targets.
export function MobileAddDocument({ vehicleId: initialVehicleId, onNavigate, onBack }: {
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [rows, setRows] = useState<DocumentRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

  const editRow = useCallback((key: string, patch: Partial<DocumentRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.id !== null } : r)));
  }, []);

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
    if (!rowComplete(row)) return;
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
    if (!row.id || !rowComplete(row)) return;
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
    <div>
      <TopBar title={t("mobileDocuments.addDocuments")} onBack={onBack} />
      <div className="p-4 space-y-3 pb-28">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />

        {!vehicleId && (
          <Card className="p-5">
            <EmptyState title={t("quickEntry.pickVehicle")} description={t("quickEntry.pickVehicleDocument")} />
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
                    value={row.docType}
                    onChange={(v) => editRow(row.key, { docType: v })}
                    options={DOCUMENT_TYPES}
                    placeholder={t("quickEntry.documentTypePlaceholder")}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <AttachButton
                      bucket={BUCKET}
                      pathPrefix={`${vehicleId}/${row.key}`}
                      value={row.files}
                      onChange={(files) => editRow(row.key, { files })}
                    />
                    <MoreDetailsButton open={row.expanded} onToggle={() => patchRow(row.key, { expanded: !row.expanded })} badge={hasDetails(row)} />
                    <RowCommitButton state={state} busy={row.busy} disabled={!rowComplete(row)} onAdd={() => handleAdd(row)} onSave={() => handleSave(row)} />
                    <RowDeleteButton state={state} busy={row.busy} onDelete={() => handleDelete(row)} />
                  </div>

                  {row.expanded && (
                    <div className="space-y-3 border-t border-mobile-border pt-3 animate-fade-in">
                      <Field label={t("quickEntry.documentNumber")}>
                        <Input value={row.documentNumber} onChange={(e) => editRow(row.key, { documentNumber: e.target.value })} />
                      </Field>
                      <Field label={t("quickEntry.issueDate")}>
                        <Input type="date" value={row.issueDate} onChange={(e) => editRow(row.key, { issueDate: e.target.value })} />
                      </Field>
                      <Field label={t("quickEntry.expiryDate")}>
                        <Input type="date" value={row.expiryDate} onChange={(e) => editRow(row.key, { expiryDate: e.target.value })} />
                      </Field>
                      <Field label={t("quickEntry.issuer")}>
                        <Input value={row.issuer} onChange={(e) => editRow(row.key, { issuer: e.target.value })} />
                      </Field>
                      <Field label={t("quickEntry.notes")}>
                        <Input value={row.notes} onChange={(e) => editRow(row.key, { notes: e.target.value })} />
                      </Field>
                      <FileUploadGrid
                        bucket={BUCKET}
                        pathPrefix={`${vehicleId}/${row.key}`}
                        value={row.files}
                        onChange={(files) => editRow(row.key, { files })}
                        hint={t("mobileDocuments.hint")}
                      />
                    </div>
                  )}
                </Card>
              );
            })}

            <button
              onClick={() => onNavigate("vehicle", { vehicleId, tab: "documents" })}
              className="w-full py-2 text-sm font-medium text-mobile-primary"
            >
              {t("quickEntry.openVehicle")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
