"use client";

import { useState } from "react";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { WIN_TOTALS } from "@/data/winTotals";
import { isSuspiciousPick } from "@/data/powerRankings";
import { SeasonGameCard, SeasonByeCard } from "@/components/SeasonGameCard";
import { darkenColor } from "@/components/TeamHalfPill";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { useSeasonPicks } from "@/hooks/useSeasonPicks";
import { renderPredictorShareImage } from "@/lib/predictorShareImage";

// Pre-season only: predict how every game on one team's schedule goes
// before there's a spread or record to go on. Cowboys-only for now -
// team selection comes later.
const TRACKED_TEAM = "DAL" as const;

export default function PredictorPage() {
  const team = TEAMS[TRACKED_TEAM];
  const schedule = getTeamSchedule(TRACKED_TEAM);
  const { picks, setPick, resetPicks, loaded } = useSeasonPicks(TRACKED_TEAM);
  const [sharing, setSharing] = useState(false);
  const winTotal = WIN_TOTALS[TRACKED_TEAM];

  // Desktop's two columns should read top-to-bottom then wrap (weeks 1-9,
  // then 10-18), not interleave left/right like CSS grid's default
  // row-major auto-placement would.
  const scheduleHalf = Math.ceil(schedule.length / 2);
  const scheduleCol1 = schedule.slice(0, scheduleHalf);
  const scheduleCol2 = schedule.slice(scheduleHalf);

  const wins = Object.values(picks).filter((winner) => winner === TRACKED_TEAM).length;
  const losses = Object.values(picks).filter((winner) => winner !== TRACKED_TEAM).length;
  const gamesPicked = wins + losses;
  const diff = winTotal !== undefined && gamesPicked > 0 ? Math.round((wins - winTotal) * 2) / 2 : null;

  // Picks that defy the power rankings - each one earns the side-eye dog
  // on its card, and the total gets its own KPI pill below.
  const suspiciousCount = schedule.filter((row) => {
    if ("bye" in row) return false;
    const winner = picks[row.week];
    if (!winner) return false;
    const loser = winner === row.away ? row.home : row.away;
    return isSuspiciousPick(winner, loser, winner === row.home);
  }).length;

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderPredictorShareImage({ team: TRACKED_TEAM, schedule, picks, winTotal });
      const filename = `${team.name.toLowerCase()}-schedule-predictor.png`;
      const file = new File([blob], filename, { type: "image/png" });

      function download() {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], title: "Schedule Predictor", text: `My predicted ${team.name} schedule` });
        } catch (shareErr) {
          if (!(shareErr instanceof Error && shareErr.name === "AbortError")) download();
        }
      } else {
        download();
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setSharing(false);
    }
  }

  // EXPERIMENT: textured page background tinted to the tracked team's own
  // color, darkened since it's sitting behind everything else. Only the
  // team data model has one color per team right now, so "the darkest
  // team color" is just team.color - if a second (lighter/accent) color
  // ever gets added, swap in whichever of the two is darker here.
  const bgColor = darkenColor(team.color, 0.55, 1);

  return (
    <div className="relative isolate flex-1 min-h-full">
      <div className="absolute inset-0 -z-10" style={{ background: bgColor }} />
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ backgroundImage: "url(/noise.png)", backgroundSize: "160px 160px", opacity: 0.08, mixBlendMode: "overlay" }}
      />
      <main className="flex-1 px-4 pb-10 pt-8 max-w-4xl w-full mx-auto">
      <div className="mb-8 flex items-center justify-center gap-5">
        {/* Nudged up slightly - flexbox centers the boxes, but the title's
            display font carries extra space below its cap height, so true
            box-centering reads as the logo sitting a touch low. */}
        <img src={team.logo} alt="" className="h-20 sm:h-24 w-auto shrink-0 relative -top-1.5" crossOrigin="anonymous" />
        {/* w-min below lg: when the title wraps (as it always does on
            mobile), a plain flex item still keeps the full leftover row
            width, so the lockup centers on that oversized box and reads
            as shoved left. min-content sizing shrink-wraps the box to the
            wrapped lines so logo+text center as one unit. */}
        <div className="text-left w-min lg:w-auto">
          <div className="text-xs text-white/45 tracking-[0.25em] mb-1 whitespace-nowrap">SCHEDULE PREDICTOR</div>
          <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            {team.city.toUpperCase()} {team.name.toUpperCase()}
          </h1>
        </div>
      </div>

      {loaded && (
        <>
          <div className="flex flex-col gap-4 max-w-md mx-auto lg:hidden">
            {schedule.map((row) => (
              <SeasonRow key={row.week} row={row} trackedTeam={TRACKED_TEAM} picks={picks} setPick={setPick} />
            ))}
          </div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
            {[scheduleCol1, scheduleCol2].map((col, i) => (
              <div key={i} className="flex flex-col gap-4">
                {col.map((row) => (
                  <SeasonRow key={row.week} row={row} trackedTeam={TRACKED_TEAM} picks={picks} setPick={setPick} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center mt-10">
            <div className="flex gap-3 justify-center flex-wrap items-center">
              <div
                className="rounded-full border-2 border-white text-center pl-4 pr-6 py-3 flex items-center gap-2.5"
                style={{ background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
              >
                <img src="/suspicious-dog.png" alt="" className="h-10 w-auto select-none" />
                <div className="text-left">
                  <div className="text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                    {suspiciousCount}
                  </div>
                  <div className="text-[10px] text-white/55 mt-1 tracking-wide">SUSPICIOUS PICKS</div>
                </div>
              </div>

              <div
                className="rounded-full border-2 border-emerald-400 text-center pl-4 pr-7 py-3 flex items-center gap-3"
                style={{ background: "#1b2947", boxShadow: "0 0 0 4px rgba(74,222,128,0.12), 0 6px 16px -6px rgba(0,0,0,0.5)" }}
              >
                <img src={team.logo} alt="" className="h-11 w-auto" crossOrigin="anonymous" />
                <div className="text-left">
                  <div className="text-3xl leading-none" style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}>
                    {wins}-{losses}
                  </div>
                  <div className="text-[10px] text-white/55 mt-1 tracking-wide">MY PREDICTION</div>
                </div>
              </div>

              {winTotal !== undefined && (
                <div
                  className="rounded-full border-2 border-white text-center px-6 py-3.5"
                  style={{ background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
                >
                  <div className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
                    {winTotal}
                  </div>
                  <div className="text-[10px] text-white/55 mt-0.5 tracking-wide">VEGAS PREDICTION</div>
                </div>
              )}
            </div>

            {diff !== null && (
              <p className="text-sm font-bold mt-3" style={{ color: diff > 0 ? "#4ade80" : diff < 0 ? "#ef4444" : "#ffffff" }}>
                {diff > 0 ? "+" : ""}
                {diff} {diff > 0 ? "OVER" : diff < 0 ? "UNDER" : "PUSH"} Vegas&rsquo; line
              </p>
            )}

            <button
              aria-label="Share your predicted schedule"
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-2 rounded-full px-7 py-3.5 text-lg mt-6 shadow-[0_4px_20px_rgba(74,222,128,0.35)] active:scale-95 transition-transform duration-150 disabled:opacity-60"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #4ade80, #22c55e)",
                color: "#0e1b33",
              }}
            >
              {sharing ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-[#0e1b33]/40 border-t-[#0e1b33] animate-spin" />
                  SHARING&hellip;
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="M7 8l5-5 5 5" />
                    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                  </svg>
                  SHARE MY PREDICTIONS 🏈
                </>
              )}
            </button>

            <button
              aria-label="Reset your predictions"
              onClick={() => {
                if (window.confirm("Reset all your schedule predictions?")) resetPicks();
              }}
              className="text-xs text-white/40 hover:text-white/70 rounded-full px-4 py-1.5 border border-white/15 hover:border-white/30 transition-colors mt-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              RESET
            </button>
          </div>
        </>
      )}
      </main>
    </div>
  );
}

function SeasonRow({
  row,
  trackedTeam,
  picks,
  setPick,
}: {
  row: ReturnType<typeof getTeamSchedule>[number];
  trackedTeam: TeamAbbr;
  picks: Record<number, TeamAbbr>;
  setPick: (week: number, winner: TeamAbbr) => void;
}) {
  return "bye" in row ? (
    <SeasonByeCard team={trackedTeam} week={row.week} />
  ) : (
    <SeasonGameCard
      away={row.away}
      home={row.home}
      trackedTeam={trackedTeam}
      week={row.week}
      picked={picks[row.week]}
      onPick={(winner) => setPick(row.week, winner)}
    />
  );
}
