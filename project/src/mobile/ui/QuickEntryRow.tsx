import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Minus, MoreHorizontal, Paperclip, Plus, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./primitives";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import type { UploadedFile } from "@/lib/uploadedFile";

/**
 * Mobile counterpart of src/components/QuickEntryControls.tsx — same one-line-per-record
 * model and the same commit/delete state machine, drawn with mobile.* tokens and 44px
 * touch targets. Kept as a separate implementation on purpose: the two design systems
 * share the behaviour, never the classes.
 */
export type QuickRowState = "draft" | "saved" | "dirty";

const SLOT = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors";

export function RowCommitButton({ state, busy, disabled, onAdd, onSave }: {
  state: QuickRowState;
  busy?: boolean;
  disabled?: boolean;
  onAdd: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  if (state === "saved") {
    return (
      <div className={`${SLOT} border border-mobile-border bg-mobile-bg text-mobile-text-muted`} aria-label={t("quickEntry.rowSaved")}>
        {busy ? <Spinner size={16} /> : <Check size={18} />}
      </div>
    );
  }

  const isDraft = state === "draft";
  const label = isDraft ? t("quickEntry.addRow") : t("quickEntry.saveChanges");
  return (
    <button
      type="button"
      onClick={isDraft ? onAdd : onSave}
      disabled={busy || disabled}
      aria-label={label}
      className={`${SLOT} text-white disabled:opacity-40 bg-mobile-success active:bg-mobile-success/80`}
    >
      {busy ? <Spinner size={16} /> : <Save size={18} />}
    </button>
  );
}

export function RowDeleteButton({ state, busy, onDelete }: { state: QuickRowState; busy?: boolean; onDelete: () => void }) {
  const { t } = useTranslation();
  if (state === "draft") return <div className="h-11 w-11 shrink-0" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      aria-label={t("quickEntry.deleteRow")}
      className={`${SLOT} border border-mobile-border bg-mobile-card text-mobile-error active:bg-mobile-error-bg disabled:opacity-40`}
    >
      <Minus size={18} />
    </button>
  );
}

export function AttachButton({ bucket, pathPrefix, value, onChange }: {
  bucket: string;
  pathPrefix: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const { t } = useTranslation();
  const { uploading, fileRef, openFile, handleFileChange } = useMultiFileUpload({ bucket, pathPrefix, value, onChange });
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileChange} className="hidden" />
      <button
        type="button"
        onClick={openFile}
        disabled={uploading}
        aria-label={t("quickEntry.attach")}
        className={`${SLOT} relative border disabled:opacity-50 ${
          value.length > 0
            ? "border-mobile-success bg-mobile-success-bg text-mobile-success"
            : "border-mobile-border bg-mobile-card text-mobile-text-secondary"
        }`}
      >
        {uploading ? <Spinner size={16} /> : <Paperclip size={18} />}
        {value.length > 0 && !uploading && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-mobile-success px-1 text-[10px] font-semibold text-white">
            {value.length}
          </span>
        )}
      </button>
    </>
  );
}

export function MoreDetailsButton({ open, onToggle, badge }: { open: boolean; onToggle: () => void; badge?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t("quickEntry.moreDetails")}
      aria-expanded={open}
      className={`${SLOT} relative border ${
        open ? "border-mobile-primary bg-mobile-primary/10 text-mobile-primary" : "border-mobile-border bg-mobile-card text-mobile-text-secondary"
      }`}
    >
      <MoreHorizontal size={18} />
      {badge && !open && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-mobile-primary" />}
    </button>
  );
}

/**
 * Type-or-pick field. The typed text is kept verbatim, so a dealer can enter a category or
 * document type the list does not cover. Stays at the shell's 16px input size — shrinking
 * it would make iOS Safari zoom on focus.
 */
export function Combobox({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(query));
  const suggestions = matches.length > 0 ? matches : options;
  const isNew = value.trim().length > 0 && !options.some((o) => o.toLowerCase() === query);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 pr-9 text-mobile-text placeholder:text-mobile-text-muted"
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("combobox.toggle")}
        onClick={() => setOpen((o) => !o)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-mobile-text-muted"
      >
        <ChevronDown size={16} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-mobile-border bg-white py-1 shadow-mobile-lg animate-fade-in">
          {/* Tappable, not a caption: this row used to be a <div>, so "+ Add …" looked like an
              option but did nothing, and the typed value was only ever kept by dismissing the
              dropdown some other way. Committing the trimmed text is what it always implied. */}
          {isNew && (
            <button
              type="button"
              onClick={() => {
                onChange(value.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 bg-mobile-success-bg px-3.5 py-2.5 text-left text-xs font-medium text-mobile-success active:bg-mobile-success/20"
            >
              <Plus size={12} className="shrink-0" /> {t("combobox.newValue", { value: value.trim() })}
            </button>
          )}
          {suggestions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`block w-full px-3.5 py-2.5 text-left text-sm active:bg-mobile-bg ${
                option === value ? "font-medium text-mobile-primary" : "text-mobile-text"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
