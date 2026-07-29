import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, Spinner, Tag, EmptyState, Sheet, Button, Field, Select } from "./ui/primitives";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { type UploadedFile } from "@/lib/uploadedFile";
import { syncVehicleAlerts } from "@/lib/compliance";
import { DOCUMENT_TYPES } from "@/lib/constants";
import type { VehicleWithRelations, VehicleDocument } from "@/lib/types";

// The mobile design's 5-document checklist, mapped onto our real DOCUMENT_TYPES values
// so the same documents show up in desktop's fuller 16-type Documents tab.
const CORE_DOCUMENTS: { type: string; label: string }[] = [
  { type: "RC book", label: "Registration Certificate (RC)" },
  { type: "Insurance", label: "Insurance" },
  { type: "PUC", label: "PUC Certificate" },
  { type: "Seller identity", label: "ID Proof" },
  { type: "Sale agreement", label: "Sale Agreement" },
];

export function MobileDocumentsTab({ vehicle, onChanged, highlightIds, autoAdd, onAutoAddConsumed }: { vehicle: VehicleWithRelations; onChanged: () => void; highlightIds?: string[]; autoAdd?: boolean; onAutoAddConsumed?: () => void }) {
  const seeded = useRef(false);
  const [seeding, setSeeding] = useState(false);
  const [activeDoc, setActiveDoc] = useState<VehicleDocument | null>(null);
  const [docFiles, setDocFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeHighlights, setActiveHighlights] = useState<Set<string>>(new Set());
  const [showAddNew, setShowAddNew] = useState(false);
  const [newDocType, setNewDocType] = useState(DOCUMENT_TYPES[0]);
  const [newDocFiles, setNewDocFiles] = useState<UploadedFile[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());
  const { toast } = useToast();
  const { t } = useTranslation();

  const docLabel = (type: string) => t("mobileDocuments.core." + type, { defaultValue: CORE_DOCUMENTS.find((c) => c.type === type)?.label ?? type });

  useEffect(() => {
    if (!highlightIds || highlightIds.length === 0) return;
    setActiveHighlights(new Set(highlightIds));
    const el = document.getElementById(`document-card-${highlightIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setActiveHighlights(new Set()), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIds?.join(",")]);

  useEffect(() => {
    if (seeded.current) return;
    if ((vehicle.documents ?? []).length > 0) return;
    seeded.current = true;
    setSeeding(true);
    (async () => {
      try {
        const { error } = await supabase.from("vehicle_documents").insert(
          CORE_DOCUMENTS.map((d) => ({
            vehicle_id: vehicle.id,
            document_type: d.type,
            verification_status: "Not uploaded",
          })),
        );
        if (error) throw error;
        onChanged();
      } catch {
        toast(t("mobileDocuments.prepFailed"), "error");
      } finally {
        setSeeding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const openAddNew = () => {
    setNewDocType(DOCUMENT_TYPES[0]);
    setNewDocFiles([]);
    setUploadSessionId(crypto.randomUUID());
    setShowAddNew(true);
  };

  const closeAddNew = () => {
    setShowAddNew(false);
    setNewDocType(DOCUMENT_TYPES[0]);
    setNewDocFiles([]);
  };

  const handleAddNew = async () => {
    setAddingNew(true);
    try {
      const fileUrls = newDocFiles.map((f) => f.path);
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicle.id,
        document_type: newDocType,
        verification_status: fileUrls.length > 0 ? "Uploaded" : "Not uploaded",
        file_url: fileUrls[0] ?? null,
        file_urls: fileUrls,
      });
      if (error) throw error;
      toast(t("mobileDocuments.added"), "success");
      closeAddNew();
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileDocuments.saveFailed"), "error");
    } finally {
      setAddingNew(false);
    }
  };

  // Reached via the mobile "+" -> Document autoAdd target: opens the add-new-document
  // sheet once on mount, guarded so it doesn't reopen on re-renders.
  const autoAddFired = useRef(false);
  useEffect(() => {
    if (!autoAdd || autoAddFired.current || seeding) return;
    autoAddFired.current = true;
    openAddNew();
    onAutoAddConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdd, seeding]);

  const openDoc = (d: VehicleDocument) => {
    const existing = d.file_urls?.length ? d.file_urls : d.file_url ? [d.file_url] : [];
    setDocFiles(existing.map((path) => ({ path, name: path.split("/").pop() ?? path })));
    setActiveDoc(d);
  };

  const closeSheet = () => {
    setActiveDoc(null);
    setDocFiles([]);
  };

  const handleFilesChange = async (files: UploadedFile[]) => {
    setDocFiles(files);
    if (!activeDoc) return;
    setSaving(true);
    try {
      const fileUrls = files.map((f) => f.path);
      const { error } = await supabase
        .from("vehicle_documents")
        .update({
          file_url: fileUrls[0] ?? null,
          file_urls: fileUrls,
          verification_status: fileUrls.length > 0 ? (activeDoc.verification_status === "Verified" ? "Verified" : "Uploaded") : "Not uploaded",
        })
        .eq("id", activeDoc.id);
      if (error) throw error;
      syncVehicleAlerts(vehicle.id).catch(() => {});
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("mobileDocuments.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (seeding) {
    return <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>;
  }

  const documents = vehicle.documents ?? [];

  return (
    <div className="space-y-2.5 pt-3">
      {documents.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<FileText size={20} />} title={t("mobileDocuments.noDocuments")} /></Card>
      ) : (
        documents.map((d) => {
          const fileCount = d.file_urls?.length ?? (d.file_url ? 1 : 0);
          return (
            <Card
              key={d.id}
              id={`document-card-${d.id}`}
              className={`p-3.5 transition-colors ${activeHighlights.has(d.id) ? "ring-2 ring-amber-400 bg-amber-50/50" : ""}`}
              onClick={() => openDoc(d)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-mobile-text truncate">{docLabel(d.document_type)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Tag color={d.verification_status === "Verified" ? "success" : d.verification_status === "Not uploaded" ? "neutral" : "primary"}>
                      {t("status." + d.verification_status, { defaultValue: d.verification_status })}
                    </Tag>
                    {fileCount > 1 && <span className="text-[11px] text-mobile-text-muted">{t("mobileDocuments.fileCount", { count: fileCount })}</span>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
      {documents.some((d) => d.verification_status !== "Not uploaded") && (
        <div className="flex items-center gap-2 text-xs text-mobile-text-muted px-1 pt-1">
          <CheckCircle2 size={13} className="text-mobile-success" />
          {t("mobileDocuments.uploadedCount", { uploaded: documents.filter((d) => d.verification_status !== "Not uploaded").length, total: documents.length })}
        </div>
      )}

      <button
        onClick={openAddNew}
        className="flex items-center justify-center gap-1.5 w-full rounded-2xl border border-dashed border-mobile-border py-3 text-sm font-medium text-mobile-primary active:bg-mobile-bg"
      >
        <Plus size={16} /> {t("mobileDocuments.addAnother")}
      </button>

      <Sheet
        open={activeDoc !== null}
        onClose={closeSheet}
        title={activeDoc ? docLabel(activeDoc.document_type) : ""}
        footer={<Button onClick={closeSheet} className="w-full">{t("mobileDocuments.done")}</Button>}
      >
        {activeDoc && (
          <FileUploadGrid
            bucket="vehicle-documents"
            pathPrefix={vehicle.id}
            value={docFiles}
            onChange={handleFilesChange}
            hint={saving ? t("mobileDocuments.saving") : t("mobileDocuments.hint")}
          />
        )}
      </Sheet>

      <Sheet
        open={showAddNew}
        onClose={closeAddNew}
        title={t("mobileDocuments.addDocument")}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={closeAddNew}>{t("mobileVehicle.cancel")}</Button>
            <Button className="flex-1" onClick={handleAddNew} loading={addingNew}>{addingNew ? <Spinner size={14} /> : null} {t("mobileDocuments.addDocument")}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label={t("mobileDocuments.documentType")} required>
            <Select value={newDocType} onChange={setNewDocType} options={DOCUMENT_TYPES} />
          </Field>
          <FileUploadGrid
            bucket="vehicle-documents"
            pathPrefix={`${vehicle.id}/${uploadSessionId}`}
            value={newDocFiles}
            onChange={setNewDocFiles}
            hint={t("mobileDocuments.hint")}
          />
        </div>
      </Sheet>
    </div>
  );
}
