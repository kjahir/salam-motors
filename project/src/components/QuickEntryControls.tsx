import { Check, Minus, MoreHorizontal, Paperclip, Plus, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/Primitives";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import type { UploadedFile } from "@/lib/uploadedFile";

/**
 * Shared row controls for the desktop single-line quick-entry pages (Add Expense, Add
 * Document). Rows are saved individually, so there is no page-level save button.
 *
 * Each trailing slot has exactly one meaning, and that meaning never moves:
 *   [attach] [details] [commit] [delete]
 * The commit slot is the only one that changes appearance — plus while the row is an
 * unsaved draft, an active save once a saved row has edits, and an inert "saved" tick
 * otherwise. Delete keeps its own slot so it can never land under a cursor aiming at
 * add or save; on a draft row that slot is a spacer, which is what keeps every row's
 * columns lined up.
 */
export type QuickRowState = "draft" | "saved" | "dirty";

const SLOT = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150";
/** Width of the four trailing slots plus their gaps — use for the header's spacer. */
export const ROW_ACTIONS_WIDTH = "w-[168px]";

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
      <div
        className={`${SLOT} border border-slate-200 bg-slate-50 text-slate-400`}
        title={t("quickEntry.rowSaved")}
        aria-label={t("quickEntry.rowSaved")}
      >
        {busy ? <Spinner size={14} /> : <Check size={16} />}
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
      title={label}
      aria-label={label}
      className={`${SLOT} text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
        isDraft ? "bg-brand-600 hover:bg-brand-700" : "bg-accent-600 hover:bg-accent-700"
      }`}
    >
      {busy ? <Spinner size={14} /> : isDraft ? <Plus size={16} /> : <Save size={16} />}
    </button>
  );
}

export function RowDeleteButton({ state, busy, onDelete }: { state: QuickRowState; busy?: boolean; onDelete: () => void }) {
  const { t } = useTranslation();

  // Draft rows have nothing to delete; the slot stays as a spacer so columns still align.
  if (state === "draft") return <div className="h-9 w-9 shrink-0" aria-hidden="true" />;

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      title={t("quickEntry.deleteRow")}
      aria-label={t("quickEntry.deleteRow")}
      className={`${SLOT} border border-slate-300 bg-white text-slate-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40`}
    >
      <Minus size={16} />
    </button>
  );
}

// Single-icon attach: opens the file picker straight away and uploads in place. The
// thumbnails/remove controls live in the row's expanded details panel, so this stays
// one icon wide on the line itself.
export function AttachButton({ bucket, pathPrefix, value, onChange, fileAccept }: {
  bucket: string;
  pathPrefix: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  fileAccept?: string;
}) {
  const { t } = useTranslation();
  const { uploading, fileRef, openFile, handleFileChange } = useMultiFileUpload({ bucket, pathPrefix, value, onChange });

  return (
    <>
      <input ref={fileRef} type="file" accept={fileAccept ?? "image/*,.pdf,.doc,.docx"} multiple onChange={handleFileChange} className="hidden" />
      <button
        type="button"
        onClick={openFile}
        disabled={uploading}
        title={value.length > 0 ? t("quickEntry.attachedCount", { count: value.length }) : t("quickEntry.attach")}
        aria-label={t("quickEntry.attach")}
        className={`${SLOT} border disabled:opacity-50 ${
          value.length > 0
            ? "relative border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100"
            : "relative border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`}
      >
        {uploading ? <Spinner size={14} /> : <Paperclip size={16} />}
        {value.length > 0 && !uploading && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-600 px-1 text-[10px] font-semibold text-white">
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
      title={t("quickEntry.moreDetails")}
      aria-label={t("quickEntry.moreDetails")}
      aria-expanded={open}
      className={`${SLOT} relative border ${
        open ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <MoreHorizontal size={16} />
      {badge && !open && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
    </button>
  );
}
