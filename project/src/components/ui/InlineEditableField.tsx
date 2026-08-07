import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Spinner } from "./Primitives";

interface InlineEditableFieldProps {
  value: string | number;
  onSave: (next: string | number) => Promise<void>;
  type?: "text" | "number" | "select" | "textarea";
  options?: ({ value: string; label: string } | string)[];
  formatDisplay?: (value: string | number) => ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function InlineEditableField({
  value,
  onSave,
  type = "text",
  options,
  formatDisplay,
  placeholder,
  disabled,
  className = "",
  ariaLabel,
}: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current && type !== "select") inputRef.current.select();
    }
  }, [editing, type]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`group inline-flex items-center gap-1.5 rounded px-1 -mx-1 text-left ${disabled ? "cursor-default" : "hover:bg-slate-50"} ${className}`}
      >
        <span className={disabled ? "" : "border-b border-dashed border-slate-300 group-hover:border-brand-400"}>
          {formatDisplay ? formatDisplay(value) : value || <span className="text-slate-400">{placeholder ?? "—"}</span>}
        </span>
        {!disabled && <Pencil size={11} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
      </button>
    );
  }

  const opts = (options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {type === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className="input py-1 text-sm"
            value={String(draft)}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="input py-1 text-sm"
            rows={2}
            value={String(draft)}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className="input py-1 text-sm"
            type={type}
            value={draft}
            disabled={saving}
            placeholder={placeholder}
            onChange={(e) => setDraft(type === "number" ? e.target.valueAsNumber || 0 : e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
          />
        )}
        {saving && <Spinner size={14} />}
      </div>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}
