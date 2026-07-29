import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopBar, Spinner, Card, Field, Select, Button } from "./ui/primitives";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { fetchVehicleFull } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { DOCUMENT_TYPES } from "@/lib/constants";
import type { UploadedFile } from "@/lib/uploadedFile";
import type { Vehicle } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

// Full-screen "Add Document" page (single document: type + file upload, one submit),
// reached via the mobile "+" icon row or MobileDocumentsTab's "Add another document"
// trigger. Mirrors AddVehicle.tsx's one-page pattern: no tabs, no nested sheet.
export function MobileAddDocument({ vehicleId, onNavigate, onBack }: {
  vehicleId: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadSessionId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetchVehicleFull(vehicleId).then((v) => {
      if (!cancelled) {
        setVehicle(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fileUrls = files.map((f) => f.path);
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicleId,
        document_type: docType,
        verification_status: fileUrls.length > 0 ? "Uploaded" : "Not uploaded",
        file_url: fileUrls[0] ?? null,
        file_urls: fileUrls,
      });
      if (error) throw error;
      toast(t("mobileDocuments.added"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
      onNavigate("vehicle", { vehicleId, tab: "documents" });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileDocuments.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title={t("mobileDocuments.addDocument")} onBack={onBack} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t("mobileDocuments.addDocument")} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        {vehicle && (
          <p className="text-xs text-mobile-text-muted font-mono">{vehicle.stock_number} · {vehicle.manufacturer} {vehicle.model}</p>
        )}
        <Card className="p-4 space-y-4">
          <Field label={t("mobileDocuments.documentType")} required>
            <Select value={docType} onChange={setDocType} options={DOCUMENT_TYPES} />
          </Field>
          <FileUploadGrid
            bucket="vehicle-documents"
            pathPrefix={`${vehicleId}/${uploadSessionId}`}
            value={files}
            onChange={setFiles}
            hint={t("mobileDocuments.hint")}
          />
        </Card>

        <Button className="w-full" onClick={handleSubmit} loading={submitting}>
          <Check size={16} /> {t("mobileDocuments.addDocument")}
        </Button>
      </div>
    </div>
  );
}
