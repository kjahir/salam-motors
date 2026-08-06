import { useEffect, useRef, useState } from "react";

/**
 * Scrolls to and briefly highlights the row matching `targetId` once it shows up in `rows`
 * — used when a Reports row deep-links into a list+editor screen (e.g. Add Expense) and
 * needs to point the dealer at the specific record they clicked, not just the vehicle.
 */
export function useHighlightRow(rows: { id: string | null }[], targetId: string | undefined) {
  const elRefs = useRef(new Map<string, HTMLElement>());
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    const row = rows.find((r) => r.id === targetId);
    if (!row?.id) return;
    elRefs.current.get(row.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(row.id);
    const timer = setTimeout(() => setHighlighted(null), 2500);
    return () => clearTimeout(timer);
    // Only re-run when the target changes or the rows first arrive, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, rows.length]);

  const setRowRef = (id: string | null) => (el: HTMLDivElement | null) => {
    if (!id) return;
    if (el) elRefs.current.set(id, el);
    else elRefs.current.delete(id);
  };

  return { setRowRef, highlighted };
}
