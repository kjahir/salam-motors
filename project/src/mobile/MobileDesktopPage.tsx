import { type ReactNode } from "react";
import { TopBar } from "./ui/primitives";

/**
 * Hosts an unmodified desktop page (src/pages/*) inside the mobile shell, behind a mobile
 * TopBar for the back affordance.
 *
 * These are the More screens - Parties, Partners, Team, Alerts, History, Policies, Audit.
 * They are reference/admin surfaces a dealer visits occasionally, not the daily
 * inventory-and-sales path the hand-built mobile screens cover, so they reuse the desktop
 * component rather than getting a second implementation that would drift from it. The
 * desktop tokens they carry (slate text, `.card`, `brand.*`) are intentionally left as they
 * are: restyling them would mean editing the shared page and so changing the desktop too.
 *
 * The horizontal scroll container is the one accommodation: desktop pages contain wide
 * tables, and `.mobile-shell` clamps `overflow-x` at the shell level, so the overflow has
 * to be absorbed here instead of pushing the whole page sideways.
 */
export function MobileDesktopPage({ title, onBack, children }: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <TopBar title={title} onBack={onBack} />
      <div className="overflow-x-auto">
        <div className="min-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
