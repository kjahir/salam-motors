import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, description, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mobile-page-header">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

interface TabsProps {
  tabs: { key: string; label: string; badge?: ReactNode }[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="border-b border-slate-200 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive ? "text-brand-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.badge}
              </span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, required, error, hint, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ({ value: string; label: string }[] | string[]) | Array<{ value: string; label: string } | string>;
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, className = "" }: SelectProps) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${className}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingPage() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <Spinner size={32} />
    </div>
  );
}
