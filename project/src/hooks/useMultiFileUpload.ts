import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import type { UploadedFile } from "@/lib/uploadedFile";

interface UseMultiFileUploadOptions {
  bucket: string;
  pathPrefix: string;
  value: UploadedFile[];
  onChange: (value: UploadedFile[]) => void;
  maxSizeMB?: number;
}

export function useMultiFileUpload({ bucket, pathPrefix, value, onChange, maxSizeMB = 10 }: UseMultiFileUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { orgId } = useAuth();

  const uploadFiles = async (fileList: FileList | null, inputEl: HTMLInputElement | null) => {
    const files = Array.from(fileList ?? []);
    if (inputEl) inputEl.value = "";
    if (files.length === 0) return;

    if (!orgId) {
      toast("No active organization for this account", "error");
      return;
    }

    const oversized = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (oversized) {
      toast(`"${oversized.name}" is too large (max ${maxSizeMB}MB)`, "error");
      return;
    }

    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${orgId}/${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploaded.push({ path, name: file.name, previewUrl: URL.createObjectURL(file) });
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
    if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((_, i) => i !== index));
  };

  return {
    uploading,
    cameraRef,
    libraryRef,
    fileRef,
    openCamera: () => cameraRef.current?.click(),
    openLibrary: () => libraryRef.current?.click(),
    openFile: () => fileRef.current?.click(),
    handleCameraChange: (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files, cameraRef.current),
    handleLibraryChange: (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files, libraryRef.current),
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files, fileRef.current),
    removeAt,
  };
}
