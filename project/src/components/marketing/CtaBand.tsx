import { ArrowRight } from "lucide-react";
import { APP_ENTRY_HREF } from "@/components/marketing/constants";

export function CtaBand() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to run your dealership on VahanExchange?</h2>
        <p className="mt-3 text-sm text-slate-300 sm:text-base">Set up your dealership and start tracking inventory today.</p>
        <a
          href={APP_ENTRY_HREF}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
        >
          Start free trial
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}
