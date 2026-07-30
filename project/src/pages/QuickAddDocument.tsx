import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { VehicleSelectField } from "@/components/VehicleSelectField";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { syncVehicleAlerts } from "@/lib/compliance";
import { DOCUMENT_TYPES } from "@/lib/constants";
import type { UploadedFile } from "@/lib/uploadedFile";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface DocumentDraftRow {
  key: string;
  docType: string;
  files: UploadedFile[];
}

const emptyDocRow = (): DocumentDraftRow => ({ key: crypto.randomUUID(), docType: DOCUMENT_TYPES[0], files: [] });

// Desktop counterpart to src/mobile/MobileAddDocument.tsx: pick a vehicle, then
// repeatable rows (type + upload), one bulk insert — deliberately kept to just
// type + file, unlike VehicleDetail.tsx's DocumentsTab panel which also captures
// document number/dates/issuer/notes for a single document at a time.
export function QuickAddDocument({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [rows, setRows] = useState<DocumentDraftRow[]>([emptyDocRow()]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setRows([emptyDocRow()]);
  }, [vehicleId]);

  const addRow = () => setRows((r) => [...r, emptyDocRow()]);
  const updateRow = (key: string, patch: Partial<DocumentDraftRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));

  const isValid = Boolean(vehicleId) && rows.length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vehicle_documents").insert(
        rows.map((r) => {
          const fileUrls = r.files.map((f) => f.path);
          return {
            vehicle_id: vehicleId,
            document_type: r.docType,
            verification_status: fileUrls.length > 0 ? "Uploaded" : "Not uploaded",
            file_url: fileUrls[0] ?? null,
            file_urls: fileUrls,
          };
        }),
      );
      if (error) throw error;
      toast(t("mobileDocuments.addedCount", { count: rows.length }), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
      onNavigate("vehicle", { vehicleId, tab: "documents" });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileDocuments.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title={t("mobileDocuments.addDocuments")} />

      <Card className="p-6">
        <VehicleSelectField value={vehicleId} onChange={setVehicleId} />
      </Card>

      {vehicleId && (
        <>
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.key} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-full max-w-xs">
                    <Field label={t("mobileDocuments.documentType")} required>
                      <Select value={row.docType} onChange={(v) => updateRow(row.key, { docType: v })} options={DOCUMENT_TYPES} />
                    </Field>
                  </div>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.key)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <FileUploadGrid
                  bucket="vehicle-documents"
                  pathPrefix={`${vehicleId}/${row.key}`}
                  value={row.files}
                  onChange={(files) => updateRow(row.key, { files })}
                  hint={t("mobileDocuments.hint")}
                />
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={addRow} className="btn-secondary btn-sm"><Plus size={14} /> {t("mobileDocuments.addRow")}</button>
            <button onClick={handleSubmit} disabled={submitting || !isValid} className="btn-primary">
              {submitting ? <Spinner size={14} /> : <Check size={16} />} {t("mobileDocuments.saveCount", { count: rows.length })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
