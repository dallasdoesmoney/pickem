"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

// Only used for the very first frame of the very first open, before the
// trigger has been measured. After that the panel is exactly as wide as
// the button that opened it.
const FALLBACK_WIDTH = 360;

// Sits directly under the trigger rather than floating away from it.
const PANEL_GAP = 4;

// A category or saved list's mark. Falls back to a glyph rather than a
// broken image: the icons are remote, and a category is perfectly usable
// without one.
export function MenuIcon({ src, size = 28 }: { src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className="shrink-0 rounded-full bg-white/10 flex items-center justify-center"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        🏈
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      crossOrigin="anonymous"
    />
  );
}

// Button-triggered dropdown built on the app's existing anchored-menu
// hook (same portal/outside-click/Escape behaviour as TeamSwitcher and
// AccountMenu), plus an optional filter box for long lists.
export function TierListMenu({
  label,
  badge,
  open,
  onOpenChange,
  query,
  onQueryChange,
  searchPlaceholder,
  children,
}: {
  label: string;
  badge?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Omit both to render no search box.
  query?: string;
  onQueryChange?: (q: string) => void;
  searchPlaceholder?: string;
  children: ReactNode;
}) {
  // The panel is measured from the trigger rather than fixed, so it lines
  // up with the button on both edges. A panel narrower than its own
  // button leaves the button poking out either side of it, which is what
  // made these read as floating cards that had come loose from the thing
  // that opened them.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(FALLBACK_WIDTH);
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    setPanelWidth(wrapRef.current.getBoundingClientRect().width);
  }, [open]);

  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(
    open,
    onOpenChange,
    panelWidth,
    PANEL_GAP,
  );
  const searchable = typeof query === "string" && !!onQueryChange;

  // Focus the filter on open so you can type straight away - but only
  // where typing is the likely intent. On a touch device this summons the
  // keyboard over the very list you just opened, and half the panel
  // disappears behind it before you've read a row. Same coarse-pointer
  // signal shareBlob uses to tell a real touch device from a desktop
  // browser that merely claims to support touch.
  // Keyed on `coords` as well as `open`: the panel isn't rendered on the
  // pass where `open` first flips, because it waits for the trigger to be
  // measured. Without coords in the deps the input doesn't exist yet when
  // this runs, and the effect never fires again to catch it.
  const searchRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!open || !coords || !searchable || !searchRef.current) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    searchRef.current.focus({ preventScroll: true });
  }, [open, coords, searchable]);

  return (
    <div ref={wrapRef} className="relative flex-1">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 transition-colors ${
          open ? "border-white/40 bg-white/5" : "border-white/15 hover:border-white/35"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">{label}</span>
          {typeof badge === "number" && (
            <span className="shrink-0 rounded-full bg-white/10 text-white/70 text-xs px-2 py-0.5">{badge}</span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              top: coords.top,
              left: coords.left,
              width: Math.min(panelWidth, typeof window !== "undefined" ? window.innerWidth - 24 : panelWidth),
            }}
            className="fixed z-[100] rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60 p-2"
          >
            {searchable && (
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={searchPlaceholder ?? "Search"}
                aria-label={searchPlaceholder ?? "Search"}
                // 16px, not the text-sm the app's other inputs use, and
                // not a taste call: iOS Safari zooms the page when you
                // focus an input smaller than 16px. The rest of the app
                // gets away with it because its inputs sit in full-screen
                // modals, but this panel is anchored to a trigger, so the
                // zoom shifts the viewport out from under it and the menu
                // appears to vanish.
                className="w-full mb-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/35 outline-none focus:border-white/40"
              />
            )}
            {/* The list scrolls, not the panel, so a search box stays put
                while you page through what it matched. */}
            <div className="max-h-[50vh] overflow-y-auto">{children}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
