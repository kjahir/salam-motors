import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`card ${hover ? "card-hover cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
  color?: "brand" | "emerald" | "amber" | "red" | "slate" | "orange";
  onClick?: () => void;
  /** Denser padding/type for tile grids that double as click-to-filter controls. */
  compact?: boolean;
  /** Highlights the tile as the current filter selection. Only meaningful with onClick. */
  active?: boolean;
}

export function StatCard({ label, value, icon, hint, trend, color = "slate", onClick, compact, active }: StatCardProps) {
  const iconColors = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={`${compact ? "p-3" : "p-5"} ${active ? "border-brand-400 ring-1 ring-brand-400" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className={compact ? "text-xs font-medium text-slate-500 truncate" : "stat-label"}>{label}</p>
          <p className={compact ? "text-lg font-bold text-slate-900 mt-1 truncate" : "stat-value mt-1.5 truncate"}>{value}</p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
          {trend && <div className="mt-2">{trend}</div>}
        </div>
        {icon && (
          <div className={`${compact ? "h-8 w-8 ml-2" : "h-10 w-10 ml-3"} flex shrink-0 items-center justify-center rounded-lg ${iconColors[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
