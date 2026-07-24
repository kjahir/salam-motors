import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Eye, FileText } from "lucide-react";
import { Card, Spinner, Tag, EmptyState } from "./ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
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

export function MobileDocumentsTab({ vehicle, onChanged }: { vehicle: VehicleWithRelations; onChanged: () => void }) {
  const seeded = useRef(false);
  const [seeding, setSeeding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetDocRef = useRef<VehicleDocument | null>(null);
  const { toast } = useToast();

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
        toast("Failed to prepare document checklist", "error");
      } finally {
        setSeeding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const storagePathFor = (fileUrl: string) => (fileUrl.includes("/vehicle-documents/") ? fileUrl.split("/vehicle-documents/")[1] : fileUrl);

  const openPicker = (doc: VehicleDocument) => {
    targetDocRef.current = doc;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const doc = targetDocRef.current;
    e.target.value = "";
    if (!file || !doc) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("File too large (max 10MB)", "error");
      return;
    }
    setUploadingId(doc.id);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${vehicle.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vehicle-documents").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("vehicle_documents")
        .update({ file_url: path, verification_status: "Uploaded" })
        .eq("id", doc.id);
      if (updErr) throw updErr;
      toast("Document uploaded", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const handleView = async (d: VehicleDocument) => {
    if (!d.file_url) return;
    setViewingId(d.id);
    try {
      const path = storagePathFor(d.file_url);
      const { data, error } = await supabase.storage.from("vehicle-documents").createSignedUrl(path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to open document", "error");
    } finally {
      setViewingId(null);
    }
  };

  if (seeding) {
    return <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>;
  }

  const documents = vehicle.documents ?? [];

  return (
    <div className="space-y-2.5 pt-3">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" capture="environment" onChange={handleFileSelect} className="hidden" />
      {documents.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<FileText size={20} />} title="No documents" /></Card>
      ) : (
        documents.map((d) => (
          <Card key={d.id} className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-mobile-text truncate">{CORE_DOCUMENTS.find((c) => c.type === d.document_type)?.label ?? d.document_type}</p>
                <div className="mt-1">
                  <Tag color={d.verification_status === "Verified" ? "success" : d.verification_status === "Not uploaded" ? "neutral" : "primary"}>
                    {d.verification_status}
                  </Tag>
                </div>
              </div>
              {d.file_url ? (
                <button onClick={() => handleView(d)} disabled={viewingId === d.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-mobile-bg text-mobile-primary shrink-0">
                  {viewingId === d.id ? <Spinner size={14} /> : <Eye size={16} />}
                </button>
              ) : (
                <button onClick={() => openPicker(d)} disabled={uploadingId === d.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-mobile-primary/10 text-mobile-primary shrink-0">
                  {uploadingId === d.id ? <Spinner size={14} /> : <Camera size={16} />}
                </button>
              )}
            </div>
          </Card>
        ))
      )}
      {documents.some((d) => d.verification_status !== "Not uploaded") && (
        <div className="flex items-center gap-2 text-xs text-mobile-text-muted px-1 pt-1">
          <CheckCircle2 size={13} className="text-mobile-success" />
          {documents.filter((d) => d.verification_status !== "Not uploaded").length}/{documents.length} uploaded
        </div>
      )}
    </div>
  );
}
