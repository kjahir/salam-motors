import { ArrowRight, PlayCircle } from "lucide-react";
import { APP_ENTRY_HREF } from "@/components/marketing/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(31,72,245,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.15), transparent 40%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/20">
          The dealer operating system for used two-wheelers
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Run your dealership on one platform, from purchase to sale
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
          Track every vehicle&apos;s lifecycle, manage finance and partner investments, stay ahead of compliance
          with automated alerts, share a verifiable Vehicle Passport with buyers, and get instant answers from
          Ask Salam &mdash; your role-aware AI assistant.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={APP_ENTRY_HREF}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
          >
            Start free trial
            <ArrowRight size={16} />
          </a>
          <a
            href="#product"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <PlayCircle size={16} />
            See how it works
          </a>
        </div>

        <p className="mt-5 text-xs text-slate-400">No credit card required to start &middot; self-serve setup in minutes</p>
      </div>
    </section>
  );
}
