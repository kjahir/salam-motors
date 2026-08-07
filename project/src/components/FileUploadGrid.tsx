import { useEffect, useState } from "react";
import { Camera, Image as ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Primitives";
import { Lightbox, type LightboxItem } from "@/components/ui/Lightbox";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { supabase } from "@/lib/supabase";
import { isImageName, type UploadedFile } from "@/lib/uploadedFile";

interface FileUploadGridProps {
  bucket: string;
  pathPrefix: string;
  value: UploadedFile[];
  onChange: (value: UploadedFile[]) => void;
  label?: string;
  /** Shows the same red-asterisk marker as Field's `required` prop. */
  required?: boolean;
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
    <div className="relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer" onClick={onClick}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white"
        aria-label={t("uploads.remove", { name: file.name })}
      >
        <X size={12} />
      </button>
      {isImage && url ? (
        <img src={url} alt={file.name} className="h-20 w-full object-cover" />
      ) : isImage ? (
        <div className="h-20 w-full flex items-center justify-center bg-slate-50"><Spinner size={14} /></div>
      ) : (
        <div className="h-20 w-full flex items-center justify-center bg-slate-50 px-1 text-center text-[11px] text-slate-500 truncate">{file.name}</div>
      )}
    </div>
  );
}

export function FileUploadGrid({ bucket, pathPrefix, value, onChange, label, required, hint, maxSizeMB = 10, fileAccept = "image/*,.pdf,.doc,.docx" }: FileUploadGridProps) {
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
      <label className="label">
        {label ?? t("uploads.files")}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 -mt-1 mb-2">{hint}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={handleLibraryChange} className="hidden" />
      <input ref={fileRef} type="file" accept={fileAccept} multiple onChange={handleFileChange} className="hidden" />

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
          {value.map((file, i) => (
            <Thumb key={file.path} file={file} bucket={bucket} onClick={() => setLightboxIndex(i)} onRemove={() => removeAt(i)} />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={openCamera} disabled={uploading} className="btn-secondary btn-sm flex-1">
          {uploading ? <Spinner size={14} /> : <Camera size={14} />} {t("uploads.takePhoto")}
        </button>
        <button type="button" onClick={openLibrary} disabled={uploading} className="btn-secondary btn-sm flex-1">
          {uploading ? <Spinner size={14} /> : <ImageIcon size={14} />} {t("uploads.photoLibrary")}
        </button>
        <button type="button" onClick={openFile} disabled={uploading} className="btn-secondary btn-sm flex-1">
          {uploading ? <Spinner size={14} /> : <Upload size={14} />} {t("uploads.chooseFile")}
        </button>
      </div>

      {lightboxIndex !== null && (
        <Lightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </div>
  );
}
