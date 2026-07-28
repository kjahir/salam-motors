const STEPS = [
  {
    step: "1",
    title: "Create your dealership",
    description: "Sign up and set up your organization in minutes &mdash; no paperwork, no waiting.",
  },
  {
    step: "2",
    title: "Add your inventory",
    description: "Bring vehicles onto the platform and track them through purchase, inspection and readiness.",
  },
  {
    step: "3",
    title: "Track, comply, sell",
    description: "Monitor compliance and finance in real time, and share a Vehicle Passport when you're ready to sell.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
          <p className="mt-3 text-base text-slate-600">Get your dealership up and running without a lengthy onboarding process.</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.step} className="relative text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/30">
                {s.step}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.description}</p>
              {i < STEPS.length - 1 && (
                <div className="absolute right-[-1rem] top-5 hidden h-px w-8 bg-slate-300 sm:block" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
