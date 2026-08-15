"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Shared positioning/interaction logic for a button-triggered dropdown
// rendered via a portal onto document.body (see TeamSwitcher for why: an
// in-flow `absolute` dropdown painted BEHIND page content further down
// despite a higher z-index - some ancestor stacking-context interaction
// that didn't resolve with z-index alone). Computes `fixed` coordinates
// from the trigger's own rect, closes on outside click/Escape/page
// scroll, but ignores scroll events that originate from inside the
// panel itself (its own scrollable list shouldn't close it).
export function useAnchoredMenu<T extends HTMLElement>(open: boolean, onOpenChange: (open: boolean) => void, panelWidth: number) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(panelWidth, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setCoords({ top: rect.bottom + 10, left });
  }, [open, panelWidth]);

  useEffect(() => {
    if (!open) return;
    // pointerdown (not click) so the outside-close and an item's own click
    // don't race on the same interaction.
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) onOpenChange(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    function onScrollOrResize(e: Event) {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, onOpenChange]);

  return { buttonRef, panelRef, coords };
}
