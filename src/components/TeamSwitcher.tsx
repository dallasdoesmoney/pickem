"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { TEAMS, TeamAbbr, Team } from "@/data/teams";

// Sorted once at module scope, not per-render - the list never changes.
const SORTED_TEAMS: Team[] = Object.values(TEAMS).sort((a, b) =>
  `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`)
);

const PANEL_WIDTH = 300; // px - matches the sm: width below; mobile uses min() against viewport

export function TeamSwitcher({ currentTeam, className = "" }: { currentTeam: TeamAbbr; className?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Positioned via a portal straight onto <body> with `fixed` coordinates
  // computed from the trigger's own rect - a plain in-flow `absolute`
  // dropdown here got painted BEHIND the schedule cards further down the
  // page despite a higher z-index (some ancestor stacking-context
  // interaction that didn't resolve with z-index alone); escaping to the
  // body root sidesteps that entirely since nothing on the page can then
  // sit in front of it short of an even higher z-index sibling at the
  // same root level.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setCoords({ top: rect.bottom + 10, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // pointerdown (not click) so the outside-close and an item's own click
    // don't race on the same interaction.
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Closing on scroll/resize is simpler and safer than re-tracking the
    // trigger's position continuously for a menu this short-lived.
    function onScrollOrResize() {
      setOpen(false);
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
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Switch team"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-white/20 hover:border-white/40 hover:bg-white/5 active:scale-95 transition-colors shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-white/80 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
            style={{ top: coords.top, left: coords.left, width: Math.min(PANEL_WIDTH, typeof window !== "undefined" ? window.innerWidth - 24 : PANEL_WIDTH) }}
            className="fixed z-[100] max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60 p-2"
          >
            {SORTED_TEAMS.map((team) => {
              const isCurrent = team.abbr === currentTeam;
              return (
                <Link
                  key={team.abbr}
                  href={`/predictor/${team.abbr.toLowerCase()}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                    isCurrent ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <img src={team.logo} alt="" className="h-7 w-7 object-contain shrink-0" crossOrigin="anonymous" />
                  <span className="text-sm text-left truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {team.city} {team.name}
                  </span>
                  {isCurrent && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
