import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "salam-motors-assistant-launcher";
const EDGE_MARGIN = 8;
/** Below this much movement a pointer sequence is a tap, not a drag. */
const DRAG_THRESHOLD = 6;

interface Position {
  x: number;
  y: number;
}

function clampToViewport({ x, y }: Position, size: number): Position {
  return {
    x: Math.min(Math.max(x, EDGE_MARGIN), Math.max(EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN)),
    y: Math.min(Math.max(y, EDGE_MARGIN), Math.max(EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN)),
  };
}

/**
 * Lets the mobile assistant launcher be dragged out of the way when it covers something
 * the dealer needs — the action row, a form field, a table cell. The position survives
 * reloads, and is re-clamped if the viewport shrinks so the button can never strand itself
 * off-screen. Returns `null` position until the user actually moves it, so the default
 * CSS placement stays in charge.
 */
export function useDraggableLauncher(enabled: boolean) {
  const [position, setPosition] = useState<Position | null>(null);
  const dragState = useRef<{ dx: number; dy: number; size: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Position;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") setPosition(parsed);
      }
    } catch {
      // a corrupt entry just means we fall back to the default placement
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !position) return;
    const onResize = () => setPosition((p) => (p ? clampToViewport(p, 48) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, position]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      dragState.current = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        size: rect.width,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;
    const next = clampToViewport({ x: event.clientX - state.dx, y: event.clientY - state.dy }, state.size);
    if (!state.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (Math.abs(next.x - rect.left) + Math.abs(next.y - rect.top) < DRAG_THRESHOLD) return;
      state.moved = true;
      setDragging(true);
    }
    setPosition(next);
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state?.moved) return;
    setDragging(false);
    setPosition((p) => {
      if (p) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          // storage full or blocked — the position just won't persist
        }
      }
      return p;
    });
  }, []);

  return {
    /** null while the button sits at its default CSS position. */
    position: enabled ? position : null,
    /** True mid-drag, so the click that ends a drag can be suppressed. */
    dragging,
    wasDragged: () => dragState.current?.moved ?? false,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
