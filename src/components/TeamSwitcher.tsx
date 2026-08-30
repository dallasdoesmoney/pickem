"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TeamAbbr, TEAMS_SORTED } from "@/data/teams";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 300; // px - matches the sm: width below; mobile uses min() against viewport

// The whole team name is the trigger, inside a bordered chip with the
// chevron tucked in at the end.
//
// It used to be a bare inline name with a separate circular chevron
// button floating after it, and that read as decoration rather than as a
// control - on the longer names the chevron also wrapped to a line of
// its own or off the edge entirely, so the one hint that this opened
// anything could disappear. Wrapping name and chevron together in a
// single box fixes both at once: the border says "control", and the
// chevron can no longer be separated from the thing it belongs to
// because it is inside the same box.
//
// inline-flex, so the chip is an atomic box that shrinks to the room
// beside the logo and wraps its text internally. That was the original
// reason the name could NOT be a button - as an atomic box it claimed
// the full line and stranded the chevron beside it - which stops
// applying the moment the chevron moves inside.
export function TeamSwitcher({
  currentTeam,
  open,
  onOpenChange,
  children,
  className = "",
}: {
  currentTeam: TeamAbbr;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Reset between openings - a stale filter from last time would look
  // like most of the league had gone missing. Done during render, so the
  // panel never commits a frame showing last time's filter.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  // A callback ref rather than an effect on `open`: the panel doesn't
  // mount until useAnchoredMenu has measured the trigger, so on the
  // render where `open` flips there is no input yet and an effect firing
  // then focuses nothing. This runs when the field itself appears.
  //
  // Focus is for a mouse, not a phone: autofocus on touch throws the soft
  // keyboard over the very list the user is trying to scroll, and
  // scrolling is the faster gesture there anyway.
  const focusOnMount = (el: HTMLInputElement | null) => {
    if (el && window.matchMedia("(pointer: fine)").matches) el.focus();
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEAMS_SORTED;
    // Abbreviation included so "gb" and "sf" work - typing the shorthand
    // is the whole reason to reach for the keyboard here.
    return TEAMS_SORTED.filter((t) =>
      `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <span className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Change team"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-2 sm:gap-2.5 rounded-2xl border border-white/25 bg-white/[0.07] px-2.5 py-1 sm:px-3 sm:py-1.5 text-left hover:border-white/50 hover:bg-white/[0.12] active:scale-[0.98] transition-colors"
      >
        <span className="min-w-0 break-words">{children}</span>
        <svg
          viewBox="0 0 24 24"
          // Scales with the title rather than sitting at a fixed px size,
          // so it stays in proportion at every clamp step.
          className={`w-[0.7em] h-[0.7em] shrink-0 text-white/85 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
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
            className="fixed z-[100] flex max-h-[60vh] flex-col rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60"
          >
            {/* Outside the scroller, not sticky inside it: a sticky child
                still scrolls under the panel's rounded corner on iOS. */}
            <div className="p-2 pb-1">
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-2.5 focus-within:border-white/35">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.6-3.6" />
                </svg>
                <input
                  ref={focusOnMount}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter takes the top match, so a search can be
                    // finished without moving to the mouse.
                    if (e.key !== "Enter" || matches.length === 0) return;
                    e.preventDefault();
                    onOpenChange(false);
                    router.push(`/predictor/${matches[0].abbr.toLowerCase()}`);
                  }}
                  placeholder="Search teams"
                  aria-label="Search teams"
                  className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 pt-1">
              {matches.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-white/40">No teams match “{query.trim()}”</p>
              ) : (
                matches.map((team) => {
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
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
