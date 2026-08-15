"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { TeamAbbr, TEAMS_SORTED } from "@/data/teams";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 300; // px - matches the sm: width below; mobile uses min() against viewport

export function TeamSwitcher({
  currentTeam,
  open,
  onOpenChange,
  className = "",
}: {
  currentTeam: TeamAbbr;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Switch team"
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
            {TEAMS_SORTED.map((team) => {
              const isCurrent = team.abbr === currentTeam;
              return (
                <Link
                  key={team.abbr}
                  href={`/predictor/${team.abbr.toLowerCase()}`}
                  role="menuitem"
                  onClick={() => onOpenChange(false)}
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
