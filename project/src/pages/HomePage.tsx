import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { CtaBand } from "@/components/marketing/CtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

// Public marketing homepage, mounted at "/" by src/main.tsx.
// English-only plain strings for now -- this is a new, unauthenticated surface,
// so it intentionally does not use useTranslation()/react-i18next.
export function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <CtaBand />
      <MarketingFooter />
    </div>
  );
}
