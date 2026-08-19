"use client";

import { ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 360;

// Below this a search box is noise - you can see every row without it.
// Above it, scrolling to find one saved list by eye gets old fast.
export const SEARCH_THRESHOLD = 7;

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
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const searchable = typeof query === "string" && !!onQueryChange;

  return (
    <div className="relative flex-1">
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
              width: Math.min(PANEL_WIDTH, typeof window !== "undefined" ? window.innerWidth - 24 : PANEL_WIDTH),
            }}
            className="fixed z-[100] rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60 p-2"
          >
            {searchable && (
              <input
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={searchPlaceholder ?? "Search"}
                aria-label={searchPlaceholder ?? "Search"}
                className="w-full mb-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/40"
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
