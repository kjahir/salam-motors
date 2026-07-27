import { type ReactNode, useState } from "react";
import {
  Bike,
  Users,
  UserCircle,
  Bell,
  PlusCircle,
  Menu,
  X,
  LogOut,
  ChevronDown,
  History,
  ShieldCheck,
  LayoutDashboard,
  FileBarChart,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { usePermissions } from "@/lib/usePermissions";
import { ROLE_LABELS } from "@/lib/constants";

export type PageKey =
  | "dashboard"
  | "inventory"
  | "add-vehicle"
  | "vehicle"
  | "parties"
  | "partners"
  | "finance"
  | "alerts"
  | "passport"
  | "history"
  | "policies"
  | "team";

export interface NavigateParams {
  vehicleId?: string;
  historyVehicleId?: string;
  tab?: string;
  openEditVehicle?: boolean;
  highlightPolicyId?: string;
}

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
  alertCount?: number;
}

const navItems: { key: PageKey; label: string; icon: ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "add-vehicle", label: "Add Vehicle", icon: <PlusCircle size={18} /> },
  { key: "inventory", label: "Inventory", icon: <Bike size={18} /> },
  { key: "finance", label: "Reports", icon: <FileBarChart size={18} /> },
  { key: "parties", label: "Parties", icon: <UserCircle size={18} /> },
  { key: "partners", label: "Partners", icon: <Users size={18} /> },
  { key: "alerts", label: "Alerts", icon: <Bell size={18} /> },
  { key: "history", label: "History", icon: <History size={18} /> },
  { key: "policies", label: "Policies", icon: <ShieldCheck size={18} /> },
  { key: "team", label: "Team", icon: <UserCog size={18} /> },
];

const navSections: { key: PageKey }[][] = [
  [{ key: "dashboard" }, { key: "add-vehicle" }, { key: "inventory" }, { key: "finance" }],
  [{ key: "parties" }, { key: "partners" }],
  [{ key: "alerts" }, { key: "history" }, { key: "policies" }, { key: "team" }],
];

export function Layout({ current, onNavigate, children, alertCount = 0 }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canAccessPage } = usePermissions();
  const { orgName } = useAuth();

  const isActive = (key: PageKey) => {
    if (key === "inventory" && (current === "vehicle" || current === "parties")) return true;
    return current === key;
  };

  const handleNav = (key: PageKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const visibleNavSections = navSections
    .map((section) => section.filter(({ key }) => canAccessPage(key)))
    .filter((section) => section.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Bike size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{orgName ?? "VahanExchange Dealer"}</p>
          <p className="text-[11px] text-slate-400 leading-tight">Dealer Operating System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleNavSections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className={`space-y-0.5 ${sectionIndex > 0 ? "mt-4 pt-4 border-t border-slate-800" : ""}`}
          >
            {section.map(({ key }) => {
              const item = navItems.find((n) => n.key === key)!;
              const active = isActive(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === "alerts" && alertCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <UserMenu />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-60 animate-slide-up">{sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost btn-sm" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Bike size={18} className="text-brand-600 shrink-0" />
            <span className="text-sm font-semibold truncate">{orgName ?? "VahanExchange Dealer"}</span>
          </div>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>

      {/* Mobile close overlay handler */}
      {mobileOpen && (
        <button
          className="fixed top-2 right-2 z-50 lg:hidden text-white p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const email = user?.email ?? "";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold shrink-0">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-white truncate">{email || "User"}</p>
          <p className="text-[10px] text-slate-400 truncate">{role ? ROLE_LABELS[role] : "Signed in"}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-20">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
