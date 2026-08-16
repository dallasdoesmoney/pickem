"use client";

import { createPortal } from "react-dom";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";
import { WeekRow } from "@/lib/supabase/admin";

const PANEL_WIDTH = 220;

// Same anchored-dropdown pattern as TeamSwitcher, but selects a week via
// callback instead of navigating a route - weekly pick'em is all on `/`
// with the week held in client state, not a per-week URL.
export function WeekSwitcher({
  weeks,
  currentWeek,
  onSelectWeek,
  open,
  onOpenChange,
  className = "",
}: {
  weeks: WeekRow[];
  currentWeek: number;
  onSelectWeek: (week: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const visibleWeeks = weeks.filter((w) => w.is_open || w.results_published);

  if (visibleWeeks.length <= 1) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Switch week"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
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
            {visibleWeeks.map((w) => {
              const isCurrent = w.week === currentWeek;
              return (
                <button
                  key={w.week}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectWeek(w.week);
                    onOpenChange(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isCurrent ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                    WEEK {w.week}
                  </span>
                  <span className="ml-auto text-[10px] text-white/40 tracking-wide">{w.is_open ? "OPEN" : "RESULTS"}</span>
                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
