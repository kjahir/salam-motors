import type { LucideIcon } from "lucide-react";
import { Boxes, Landmark, ShieldCheck, FileCheck2, Bot } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    icon: Boxes,
    color: "bg-brand-50 text-brand-600",
    title: "Vehicle inventory & lifecycle tracking",
    description:
      "Every two-wheeler moves through purchase, inspection, repair, readiness and sale in one tracked pipeline, so you always know exactly where each vehicle stands.",
    points: ["Full lifecycle status from purchase to delivery", "Structured records per vehicle", "Fast search across your live inventory"],
  },
  {
    icon: Landmark,
    color: "bg-accent-50 text-accent-600",
    title: "Finance & partner investment tracking",
    description:
      "Keep purchase costs, repair spend and sale proceeds reconciled, and track how much each financing partner has invested in your inventory.",
    points: ["Vehicle-level cost & payout tracking", "Partner investment ledgers", "Clear view of margins across your yard"],
  },
  {
    icon: ShieldCheck,
    color: "bg-amber-50 text-amber-600",
    title: "Compliance & automated alerts",
    description:
      "Admin-editable compliance rules watch every vehicle's documents, evidence and reconciliation status, and raise alerts the moment something needs attention.",
    points: ["Configurable compliance policies", "Automatic health checks per vehicle", "Proactive alerts before issues become risk"],
  },
  {
    icon: FileCheck2,
    color: "bg-blue-50 text-blue-600",
    title: "Vehicle Passport",
    description:
      "Generate a shareable, verifiable Vehicle Passport for every unit &mdash; a public page buyers can trust, backed by your dealership's own records.",
    points: ["One shareable link per vehicle", "Verification badges buyers understand", "Builds trust before the sale"],
  },
  {
    icon: Bot,
    color: "bg-purple-50 text-purple-600",
    title: "Ask Salam, your AI assistant",
    description:
      "A live, role-aware assistant built into the dealership app that understands your data and can answer questions or take action on your behalf.",
    points: ["Context-aware answers about your business", "Works across dashboard, inventory, finance & more", "Available to every role, scoped to what they can see"],
  },
];

export function Features() {
  return (
    <section id="product" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything your dealership runs on, in one place</h2>
          <p className="mt-3 text-base text-slate-600">
            VahanExchange replaces spreadsheets and WhatsApp threads with one operating system built for used
            two-wheeler dealers.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-6">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon size={22} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
              <ul className="mt-4 space-y-1.5">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
