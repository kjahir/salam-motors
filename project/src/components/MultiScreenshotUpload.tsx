import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import type { UploadedProof } from "@/components/ScreenshotUpload";

interface MultiScreenshotUploadProps {
  bucket: string;
  pathPrefix: string;
  value: UploadedProof[];
  onChange: (value: UploadedProof[]) => void;
  label?: string;
}

export function MultiScreenshotUpload({ bucket, pathPrefix, value, onChange, label = "Payment Proof" }: MultiScreenshotUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;

    const oversized = files.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      toast(`"${oversized.name}" is too large (max 10MB)`, "error");
      return;
    }

    setUploading(true);
    try {
      const uploaded: UploadedProof[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploaded.push({ path, previewUrl: URL.createObjectURL(file), name: file.name });
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (index: number) => {
    const target = value[index];
    URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="label">{label}</label>
      <p className="text-xs text-slate-500 -mt-1 mb-2">Add one screenshot per transaction — useful for partial payments, broker fees, or other charges paid separately.</p>
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileSelect} className="hidden" />

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {value.map((proof, i) => (
            <div key={proof.path} className="relative rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white"
                aria-label={`Remove ${proof.name}`}
              >
                <X size={12} />
              </button>
              {proof.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img src={proof.previewUrl} alt={proof.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="h-20 w-full flex items-center justify-center bg-slate-50 px-1 text-center text-[11px] text-slate-500 truncate">{proof.name}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm w-full">
        {uploading ? <Spinner size={14} /> : <Upload size={14} />} {value.length > 0 ? "Add More Screenshots" : "Upload Screenshots"}
      </button>
    </div>
  );
}
