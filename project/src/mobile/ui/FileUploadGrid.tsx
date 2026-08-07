import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Paperclip, Upload, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { uploading, cameraRef, libraryRef, fileRef, openCamera, openLibrary, openFile, handleCameraChange, handleLibraryChange, handleFileChange, removeAt } =
    useMultiFileUpload({ bucket, pathPrefix, value, onChange, maxSizeMB });

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (e: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("touchstart", dismiss);
    };
  }, [menuOpen]);

  const pick = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

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

      <div ref={menuRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={uploading}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            value.length > 0
              ? "border-mobile-success bg-mobile-success-bg text-mobile-success"
              : "border-mobile-border bg-white text-mobile-text-secondary"
          }`}
        >
          {uploading ? <Spinner size={13} /> : <Paperclip size={13} />}
          {value.length > 0 ? `${value.length} ${t("uploads.attached")}` : t("uploads.addAttachment")}
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-mobile-border bg-white py-1 shadow-mobile-lg animate-fade-in">
            <button type="button" onClick={() => pick(openCamera)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <Camera size={15} className="text-mobile-text-secondary" /> {t("uploads.camera")}
            </button>
            <button type="button" onClick={() => pick(openLibrary)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <ImageIcon size={15} className="text-mobile-text-secondary" /> {t("uploads.photoLibrary")}
            </button>
            <button type="button" onClick={() => pick(openFile)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-mobile-text active:bg-mobile-bg">
              <Upload size={15} className="text-mobile-text-secondary" /> {t("uploads.file")}
            </button>
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </div>
  );
}
