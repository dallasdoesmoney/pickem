"use client";

import { TEAMS } from "@/data/teams";
import { SeasonGameCard, SeasonByeCard } from "@/components/SeasonGameCard";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { useSeasonPicks } from "@/hooks/useSeasonPicks";

// Pre-season only: predict how every game on one team's schedule goes
// before there's a spread or record to go on. Cowboys-only for now -
// team selection comes later.
const TRACKED_TEAM = "DAL" as const;

export default function PredictorPage() {
  const team = TEAMS[TRACKED_TEAM];
  const schedule = getTeamSchedule(TRACKED_TEAM);
  const { picks, setPick, loaded } = useSeasonPicks(TRACKED_TEAM);

  return (
    <main className="flex-1 px-4 pb-10 pt-8 max-w-4xl w-full mx-auto">
      <div className="text-center mb-8">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">PRE-SEASON</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          SCHEDULE PREDICTOR
        </h1>
        <div className="flex items-center justify-center gap-2 mt-3">
          <img src={team.logo} alt="" className="h-6 w-auto" crossOrigin="anonymous" />
          <p className="text-sm text-white/50">{team.name}&rsquo; full 2026 schedule</p>
        </div>
      </div>

      {loaded && (
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {schedule.map((row) =>
            "bye" in row ? (
              <div key={row.week} className="flex items-center gap-2 lg:gap-3">
                <span className="w-5 lg:w-9 shrink-0 text-right text-[11px] text-white/35 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                  {row.week}
                </span>
                <SeasonByeCard team={TRACKED_TEAM} />
              </div>
            ) : (
              <div key={row.week} className="flex items-center gap-2 lg:gap-3">
                <span className="w-5 lg:w-9 shrink-0 text-right text-[11px] text-white/35 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                  {row.week}
                </span>
                <SeasonGameCard
                  away={row.away}
                  home={row.home}
                  trackedTeam={TRACKED_TEAM}
                  picked={picks[row.week]}
                  onPick={(winner) => setPick(row.week, winner)}
                />
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}
