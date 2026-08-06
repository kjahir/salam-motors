import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useEffect } from "react";
import { ChevronLeft, X } from "lucide-react";

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-mobile-border border-t-mobile-primary"
      style={{ width: size, height: size }}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const variants: Record<string, string> = {
    primary: "bg-mobile-primary text-white active:bg-mobile-primary-active hover:bg-mobile-primary-hover shadow-mobile-sm",
    secondary: "bg-white text-mobile-text border border-mobile-border active:bg-mobile-bg",
    ghost: "text-mobile-text-secondary active:bg-mobile-bg",
    danger: "bg-mobile-error text-white active:opacity-90",
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-mobile-text placeholder-mobile-text-muted transition-colors focus:border-mobile-primary focus:outline-none focus:ring-2 focus:ring-mobile-primary/15 ${className}`}
      {...rest}
    />
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string } | string>;
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, className = "" }: SelectProps) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`mobile-input-scale w-full rounded-xl border border-mobile-border bg-white px-3.5 py-2.5 text-mobile-text focus:border-mobile-primary focus:outline-none focus:ring-2 focus:ring-mobile-primary/15 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Field({ label, required, hint, children, className = "" }: { label: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-mobile-text-secondary mb-1.5">
        {label}
        {required && <span className="text-mobile-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-mobile-text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Card({ children, className = "", onClick, id }: { children: ReactNode; className?: string; onClick?: () => void; id?: string }) {
  return (
    <div id={id} onClick={onClick} className={`bg-mobile-card rounded-2xl border border-mobile-border shadow-mobile-sm ${onClick ? "active:bg-mobile-bg cursor-pointer" : ""} ${className}`}>
      {children}
    </div>
  );
}

type TagColor = "primary" | "secondary" | "success" | "error" | "warning" | "neutral" | "navy";

const tagColors: Record<TagColor, string> = {
  primary: "bg-mobile-primary/10 text-mobile-primary",
  secondary: "bg-mobile-secondary/25 text-mobile-navy",
  success: "bg-mobile-success-bg text-mobile-success",
  error: "bg-mobile-error-bg text-mobile-error",
  warning: "bg-mobile-warning-bg text-mobile-warning",
  neutral: "bg-slate-100 text-mobile-text-secondary",
  navy: "bg-mobile-navy/10 text-mobile-navy",
};

export function Tag({ color = "neutral", children, className = "" }: { color?: TagColor; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium ${tagColors[color]} ${className}`}>{children}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mobile-bg text-mobile-text-muted">{icon}</div>}
      <p className="text-sm font-medium text-mobile-text">{title}</p>
      {description && <p className="mt-1 text-xs text-mobile-text-muted max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TopBar({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 h-14 px-3 bg-mobile-card/95 backdrop-blur border-b border-mobile-border">
      {onBack && (
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-mobile-text active:bg-mobile-bg shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
      )}
      <h1 className="flex-1 min-w-0 truncate text-base font-poppins font-semibold text-mobile-text">{title}</h1>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Smaller heading and tighter header/body padding, for sheets that are mostly a single
   *  control (like a search field) rather than a list of labelled rows. */
  compact?: boolean;
  /** Extra classes for the scrollable body wrapper — e.g. "flex flex-col min-h-[50vh]" to
   *  give a body that lays out its own scrollable child (a list) real room to expand into,
   *  instead of the sheet shrinking to hug that child's collapsed/empty state. */
  bodyClassName?: string;
}

export function Sheet({ open, onClose, title, description, children, footer, compact, bodyClassName = "" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-mobile-navy/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-mobile-card rounded-t-3xl shadow-mobile-lg max-h-[88vh] flex flex-col animate-slide-up">
        <div className={`flex items-start justify-between gap-3 border-b border-mobile-border shrink-0 ${compact ? "px-4 py-2.5" : "p-4"}`}>
          <div className="min-w-0">
            <h2 className={`font-poppins font-semibold text-mobile-text ${compact ? "text-sm" : "text-base"}`}>{title}</h2>
            {description && <p className="text-xs text-mobile-text-muted mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-mobile-text-muted active:bg-mobile-bg shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={`overflow-y-auto flex-1 ${compact ? "px-4 pt-2 pb-3" : "p-4"} ${bodyClassName}`}>{children}</div>
        {footer && <div className="flex items-center gap-3 p-4 border-t border-mobile-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function SegmentedTabs({ tabs, active, onChange }: { tabs: { key: string; label: string; badge?: ReactNode }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`shrink-0 flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              isActive ? "bg-mobile-primary text-white" : "bg-white text-mobile-text-secondary border border-mobile-border"
            }`}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

/** Compact icon-only nav button for "More" grids — no background tile, just a colored icon, so a growing feature list stays scannable. */
export function MoreButton({ icon, label, color, onClick, disabled }: {
  icon: ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 py-2 active:opacity-60 disabled:opacity-30 disabled:pointer-events-none"
    >
      <span className={color}>{icon}</span>
      <span className="text-[10px] font-medium text-mobile-text-secondary text-center leading-tight">{label}</span>
    </button>
  );
}
