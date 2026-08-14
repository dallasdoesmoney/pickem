"use client";

// Temporary design-exploration page - not linked from the app, just a
// place to look at the pre-season "predict every game" layout using the
// Cowboys' real 2026 schedule before wiring up team selection for real.
// Delete once a direction is chosen.

import { useState } from "react";
import { TeamAbbr } from "@/data/teams";
import { SeasonGameCard, SeasonByeCard } from "@/components/SeasonGameCard";

type Row = { week: number; away: TeamAbbr; home: TeamAbbr } | { week: number; bye: true };

// Dallas's 2026 schedule, pulled straight from games.ts.
const DAL_SCHEDULE: Row[] = [
  { week: 1, away: "DAL", home: "NYG" },
  { week: 2, away: "WAS", home: "DAL" },
  { week: 3, away: "BAL", home: "DAL" },
  { week: 4, away: "DAL", home: "HOU" },
  { week: 5, away: "TB", home: "DAL" },
  { week: 6, away: "DAL", home: "GB" },
  { week: 7, away: "DAL", home: "PHI" },
  { week: 8, away: "ARI", home: "DAL" },
  { week: 9, away: "DAL", home: "IND" },
  { week: 10, away: "SF", home: "DAL" },
  { week: 11, away: "TEN", home: "DAL" },
  { week: 12, away: "PHI", home: "DAL" },
  { week: 13, away: "DAL", home: "SEA" },
  { week: 14, bye: true },
  { week: 15, away: "DAL", home: "LAR" },
  { week: 16, away: "JAX", home: "DAL" },
  { week: 17, away: "NYG", home: "DAL" },
  { week: 18, away: "DAL", home: "WAS" },
];

export default function MockupsPage() {
  const [picks, setPicks] = useState<Record<number, TeamAbbr>>({});

  function setPick(week: number, team: TeamAbbr) {
    setPicks((prev) => {
      if (prev[week] === team) {
        const next = { ...prev };
        delete next[week];
        return next;
      }
      return { ...prev, [week]: team };
    });
  }

  return (
    <div className="min-h-full bg-[#0e1b33] text-white px-6 py-10">
      <h1 className="text-4xl mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>
        PRE-SEASON: PREDICT THE COWBOYS
      </h1>
      <p className="text-center text-white/50 mb-10">
        Same card language as weekly picks - no spread/record footer, no day-of-week headers, bye week matches the row height.
      </p>

      <div className="flex flex-col gap-3 max-w-md mx-auto">
        {DAL_SCHEDULE.map((row) =>
          "bye" in row ? (
            <div key={row.week} className="flex items-center gap-3">
              <span className="w-9 shrink-0 text-right text-[11px] text-white/35 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                {row.week}
              </span>
              <SeasonByeCard team="DAL" />
            </div>
          ) : (
            <div key={row.week} className="flex items-center gap-3">
              <span className="w-9 shrink-0 text-right text-[11px] text-white/35 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                {row.week}
              </span>
              <SeasonGameCard away={row.away} home={row.home} trackedTeam="DAL" picked={picks[row.week]} onPick={(team) => setPick(row.week, team)} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
