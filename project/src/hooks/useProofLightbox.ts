import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { isImageName } from "@/lib/uploadedFile";
import type { LightboxItem } from "@/components/ui/Lightbox";

export function useProofLightbox(bucket: string) {
  const [state, setState] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const open = (paths: string[]) => {
    if (paths.length === 0) return;
    setState({
      items: paths.map((path) => ({
        name: path.split("/").pop() ?? path,
        isImage: isImageName(path),
        resolve: async () => {
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
          if (error) throw error;
          return data.signedUrl;
        },
      })),
      index: 0,
    });
  };

  return {
    lightbox: state,
    open,
    close: () => setState(null),
    setIndex: (index: number) => setState((s) => (s ? { ...s, index } : s)),
  };
}
