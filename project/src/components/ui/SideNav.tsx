import type { ReactNode } from "react";
import { Card } from "./Card";

interface SideNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
}

interface SideNavProps {
  items: SideNavItem[];
  active: string;
  onChange: (key: string) => void;
}

export function SideNav({ items, active, onChange }: SideNavProps) {
  return (
    <Card className="p-2 h-fit">
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={isActive ? "text-brand-600" : "text-slate-400"}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge}
            </button>
          );
        })}
      </nav>
    </Card>
  );
}
