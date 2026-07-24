import { useRef, useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";

export interface UploadedProof {
  path: string;
  previewUrl: string;
  name: string;
}

interface ScreenshotUploadProps {
  bucket: string;
  pathPrefix: string;
  value: UploadedProof | null;
  onChange: (value: UploadedProof | null) => void;
  label?: string;
}

export function ScreenshotUpload({ bucket, pathPrefix, value, onChange, label = "Transaction Screenshot" }: ScreenshotUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("File too large (max 10MB)", "error");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      if (value) URL.revokeObjectURL(value.previewUrl);
      onChange({ path, previewUrl: URL.createObjectURL(file), name: file.name });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <label className="label">{label}</label>
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="text-sm text-slate-700 truncate">{value.name}</span>
          </div>
          <button type="button" onClick={clear} className="text-xs text-red-500 hover:text-red-700 shrink-0">Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm w-full">
          {uploading ? <Spinner size={14} /> : <Upload size={14} />} Upload Screenshot
        </button>
      )}
      {value && value.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) && (
        <img src={value.previewUrl} alt="Preview" className="mt-2 rounded-lg max-h-40 object-contain border border-slate-200" />
      )}
    </div>
  );
}
