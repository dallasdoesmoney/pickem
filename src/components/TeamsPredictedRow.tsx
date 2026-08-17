"use client";

import { useState } from "react";
import Link from "next/link";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";

// Two mutually exclusive modes, chosen by whether href is passed. On a
// public profile there's nowhere useful to send the viewer (it's not
// their picks), so tapping the row expands a mosaic of every team's logo
// in place, checked off for the ones this player has predicted. On your
// own account page the real Team Pick'em page is one tap away, so the
// row just links there instead of showing a static readout of data you
// can already go act on.
export function TeamsPredictedRow({
  completedCount,
  completedAbbrs,
  href,
}: {
  completedCount: number | undefined;
  completedAbbrs?: TeamAbbr[];
  href?: string;
}) {
  const [open, setOpen] = useState(false);
  const value = completedCount === undefined ? `– / ${TEAMS_SORTED.length}` : `${completedCount} / ${TEAMS_SORTED.length}`;

  const row = (
    <>
      <span className="text-base w-5 text-center shrink-0">🏈</span>
      <span className="flex-1 min-w-0 text-xs text-white/55">Teams predicted</span>
      <span className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </span>
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 text-white/30 shrink-0 ${href ? "" : `transition-transform ${open ? "rotate-180" : ""}`}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={href ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6"} />
      </svg>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2.5 rounded-xl bg-[#16233f] px-3 py-2.5 hover:bg-[#1b2947] transition-colors">
        {row}
      </Link>
    );
  }

  const completed = new Set(completedAbbrs ?? []);

  return (
    <div className="rounded-xl bg-[#16233f] overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
        {row}
      </button>
      {open && (
        <div className="grid grid-cols-8 gap-1 px-2.5 pb-2.5">
          {TEAMS_SORTED.map((team) => {
            const done = completed.has(team.abbr);
            return (
              <div
                key={team.abbr}
                title={`${team.city} ${team.name}`}
                className="relative aspect-square rounded-md flex items-center justify-center"
                style={{ background: team.color, opacity: done ? 1 : 0.28 }}
              >
                <img src={team.logo} alt="" className="h-4 w-4 object-contain" />
                {done && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border border-[#16233f] flex items-center justify-center text-[6px] font-black text-emerald-950">
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
