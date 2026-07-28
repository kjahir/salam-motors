import { ArrowRight, Check } from "lucide-react";

const HIGHLIGHTS = ["Vehicle inventory & Passport", "Finance & partner tracking", "Compliance alerts", "Ask Salam assistant"];

export function PricingTeaser() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Simple, transparent pricing</h2>
        <p className="mt-3 text-base text-slate-600">
          Plans built for dealerships of every size &mdash; start free and grow into what you need.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {HIGHLIGHTS.map((h) => (
            <span key={h} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Check size={15} className="text-accent-600" />
              {h}
            </span>
          ))}
        </div>

        <a
          href="/pricing"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
        >
          See full pricing
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}
