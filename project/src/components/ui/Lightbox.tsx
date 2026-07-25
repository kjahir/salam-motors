import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Spinner } from "@/components/ui/Primitives";

export interface LightboxItem {
  name: string;
  isImage: boolean;
  /** Resolves to a displayable URL (blob: for freshly-picked files, a signed URL for stored ones). */
  resolve: () => Promise<string>;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function Lightbox({ items, index, onClose, onIndexChange }: LightboxProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = items[index];

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    item
      .resolve()
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load file");
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && onIndexChange && index < items.length - 1) onIndexChange(index + 1);
      else if (e.key === "ArrowLeft" && onIndexChange && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onIndexChange, index, items.length]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 animate-fade-in" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={onClose} />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X size={20} />
      </button>

      {onIndexChange && items.length > 1 && index > 0 && (
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          aria-label="Previous"
          className="absolute left-2 sm:left-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {onIndexChange && items.length > 1 && index < items.length - 1 && (
        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          aria-label="Next"
          className="absolute right-2 sm:right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      )}

      <div className="relative z-[1] flex flex-col items-center gap-3 max-w-full max-h-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center min-h-[120px]">
          {!url && !error && <Spinner size={28} />}
          {error && <p className="text-sm text-red-200 bg-red-950/40 rounded-lg px-4 py-3">{error}</p>}
          {url && item.isImage && (
            <img src={url} alt={item.name} className="max-h-[80vh] max-w-[92vw] object-contain rounded-lg shadow-2xl" />
          )}
          {url && !item.isImage && (
            <iframe title={item.name} src={url} className="w-[92vw] max-w-3xl h-[80vh] bg-white rounded-lg shadow-2xl border-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-white/70">
          <span className="truncate max-w-[60vw]">{item.name}</span>
          {items.length > 1 && <span>{index + 1} / {items.length}</span>}
          {url && (
            <a href={url} download={item.name} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white hover:text-white/80">
              <Download size={13} /> Download
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
