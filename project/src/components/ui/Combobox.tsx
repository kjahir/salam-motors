import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Suggested values. The typed text is always accepted as-is, so this list is a shortcut, not a constraint. */
  options: readonly string[];
  placeholder?: string;
  className?: string;
}

// Desktop type-or-pick field: behaves like a text input (any value the user types is
// kept verbatim) with the known values offered as a filtered dropdown. Used where a
// list covers the common cases but the user must be able to enter a new one — expense
// categories, document types.
export function Combobox({ value, onChange, options, placeholder, className = "" }: ComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(query));
  const suggestions = matches.length > 0 ? matches : options;
  const isNew = value.trim().length > 0 && !options.some((o) => o.toLowerCase() === query);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      setHighlight((h) => (h + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (e.key === "Enter") {
      if (open && suggestions[highlight]) {
        e.preventDefault();
        commit(suggestions[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        className="input pr-8"
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("combobox.toggle")}
        onClick={() => setOpen((o) => !o)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-card animate-fade-in">
          {isNew && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-accent-700 bg-accent-50">
              <Plus size={12} /> {t("combobox.newValue", { value: value.trim() })}
            </div>
          )}
          {suggestions.map((option, i) => (
            <button
              key={option}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => commit(option)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                i === highlight ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
              } ${option === value ? "font-medium" : ""}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
