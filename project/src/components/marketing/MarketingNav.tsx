import { useState } from "react";
import { Bike, Menu, X } from "lucide-react";
import { APP_ENTRY_HREF } from "@/components/marketing/constants";

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Bike size={18} />
          </span>
          <span className="text-base font-bold text-white">VahanExchange</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#product" className="text-sm font-medium text-slate-300 hover:text-white">
            Product
          </a>
          <a href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white">
            Pricing
          </a>
          <a href={APP_ENTRY_HREF} className="text-sm font-medium text-slate-300 hover:text-white">
            Sign in
          </a>
          <a
            href={APP_ENTRY_HREF}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
          >
            Start free trial
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            <a href="#product" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
              Product
            </a>
            <a href="/pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
              Pricing
            </a>
            <a href={APP_ENTRY_HREF} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
              Sign in
            </a>
            <a
              href={APP_ENTRY_HREF}
              className="mt-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Start free trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
