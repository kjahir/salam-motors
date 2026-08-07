import { Bike } from "lucide-react";
import { APP_ENTRY_HREF } from "@/components/marketing/constants";

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
          <div>
            <a href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Bike size={16} />
              </span>
              <span className="text-sm font-bold text-slate-900">VahanExchange</span>
            </a>
            <p className="mt-2 max-w-xs text-xs text-slate-500">
              Dealer Operating System for used two-wheeler dealerships &mdash; inventory, finance, compliance and
              customer-facing Vehicle Passports in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:gap-16">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Product</p>
              <ul className="space-y-1.5 text-slate-600">
                <li>
                  <a href="/#product" className="hover:text-brand-600">
                    Features
                  </a>
                </li>
                <li>
                  <a href="/pricing" className="hover:text-brand-600">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href={APP_ENTRY_HREF} className="hover:text-brand-600">
                    Sign in
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Company</p>
              <ul className="space-y-1.5 text-slate-600">
                <li>
                  <a href="mailto:sales@vahanexchange.in" className="hover:text-brand-600">
                    Contact sales
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">
          &copy; {year} VahanExchange. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
