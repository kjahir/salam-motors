import { useEffect, useState } from "react";
import { Camera, Image as ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./primitives";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { supabase } from "@/lib/supabase";
import { isImageName, type UploadedFile } from "@/lib/uploadedFile";

interface FileUploadGridProps {
  bucket: string;
  pathPrefix: string;
  value: UploadedFile[];
  onChange: (value: UploadedFile[]) => void;
  hint?: string;
  maxSizeMB?: number;
  fileAccept?: string;
}

function Thumb({ file, bucket, onClick, onRemove }: { file: UploadedFile; bucket: string; onClick: () => void; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(file.previewUrl ?? null);
  const isImage = isImageName(file.name);
  const { t } = useTranslation();

  useEffect(() => {
    if (file.previewUrl) {
      setUrl(file.previewUrl);
      return;
    }
    if (!isImage) return;
    let cancelled = false;
    supabase.storage.from(bucket).createSignedUrl(file.path, 300).then(({ data }) => {
      if (!cancelled && data) setUrl(data.signedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [file.path, file.previewUrl, bucket, isImage]);

  return (
    <div className="relative rounded-xl border border-mobile-border overflow-hidden" onClick={onClick}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-mobile-navy/70 text-white"
        aria-label={t("uploads.remove", { name: file.name })}
      >
        <X size={12} />
      </button>
      {isImage && url ? (
        <img src={url} alt={file.name} className="h-20 w-full object-cover" />
      ) : isImage ? (
        <div className="h-20 w-full flex items-center justify-center bg-mobile-bg"><Spinner size={14} /></div>
      ) : (
        <div className="h-20 w-full flex items-center justify-center bg-mobile-bg px-1 text-center text-[11px] text-mobile-text-muted truncate">{file.name}</div>
      )}
    </div>
  );
}

export function FileUploadGrid({ bucket, pathPrefix, value, onChange, hint, maxSizeMB = 10, fileAccept = "image/*,.pdf,.doc,.docx" }: FileUploadGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { t } = useTranslation();
  const { uploading, cameraRef, libraryRef, fileRef, openCamera, openLibrary, openFile, handleCameraChange, handleLibraryChange, handleFileChange, removeAt } =
    useMultiFileUpload({ bucket, pathPrefix, value, onChange, maxSizeMB });

  const lightboxItems: LightboxItem[] = value.map((f) => ({
    name: f.name,
    isImage: isImageName(f.name),
    resolve: async () => {
      if (f.previewUrl) return f.previewUrl;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(f.path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  }));

  return (
    <div>
      {hint && <p className="text-xs text-mobile-text-muted mb-2">{hint}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={handleLibraryChange} className="hidden" />
      <input ref={fileRef} type="file" accept={fileAccept} multiple onChange={handleFileChange} className="hidden" />

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {value.map((file, i) => (
            <Thumb key={file.path} file={file} bucket={bucket} onClick={() => setLightboxIndex(i)} onRemove={() => removeAt(i)} />
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={openCamera}
          disabled={uploading}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-mobile-border bg-white px-2 py-2 text-xs font-medium text-mobile-text active:bg-mobile-bg disabled:opacity-50"
        >
          {uploading ? <Spinner size={13} /> : <Camera size={13} />} {t("uploads.camera")}
        </button>
        <button
          type="button"
          onClick={openLibrary}
          disabled={uploading}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-mobile-border bg-white px-2 py-2 text-xs font-medium text-mobile-text active:bg-mobile-bg disabled:opacity-50"
        >
          {uploading ? <Spinner size={13} /> : <ImageIcon size={13} />} {t("uploads.library")}
        </button>
        <button
          type="button"
          onClick={openFile}
          disabled={uploading}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-mobile-border bg-white px-2 py-2 text-xs font-medium text-mobile-text active:bg-mobile-bg disabled:opacity-50"
        >
          {uploading ? <Spinner size={13} /> : <Upload size={13} />} {t("uploads.file")}
        </button>
      </div>

      {lightboxIndex !== null && (
        <Lightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </div>
  );
}
