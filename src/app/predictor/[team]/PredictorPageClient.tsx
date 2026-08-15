"use client";

import { useState } from "react";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { WIN_TOTALS } from "@/data/winTotals";
import { isSuspiciousPick } from "@/data/powerRankings";
import { SeasonGameCard, SeasonByeCard } from "@/components/SeasonGameCard";
import { darkenColor } from "@/components/TeamHalfPill";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { useSeasonPicks } from "@/hooks/useSeasonPicks";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { renderPredictorShareImage } from "@/lib/predictorShareImage";

export default function PredictorPageClient({ trackedTeam }: { trackedTeam: TeamAbbr }) {
  const team = TEAMS[trackedTeam];
  const schedule = getTeamSchedule(trackedTeam);
  const { picks, setPick, resetPicks, loaded } = useSeasonPicks(trackedTeam);
  const { confirm, dialog } = useConfirmDialog();
  const [sharing, setSharing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const winTotal = WIN_TOTALS[trackedTeam];

  // Desktop's two columns should read top-to-bottom then wrap (weeks 1-9,
  // then 10-18), not interleave left/right like CSS grid's default
  // row-major auto-placement would.
  const scheduleHalf = Math.ceil(schedule.length / 2);
  const scheduleCol1 = schedule.slice(0, scheduleHalf);
  const scheduleCol2 = schedule.slice(scheduleHalf);

  const wins = Object.values(picks).filter((winner) => winner === trackedTeam).length;
  const losses = Object.values(picks).filter((winner) => winner !== trackedTeam).length;
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
      const blob = await renderPredictorShareImage({ team: trackedTeam, schedule, picks, winTotal });
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
          await navigator.share({
            files: [file],
            title: "Record Predictor",
            text: `I think the ${team.name} will win ${wins} games!\n\nSidelinebrew.com`,
          });
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

  // Textured page background tinted to the tracked team's own color,
  // darkened since it's sitting behind everything else. Only the team
  // data model has one color per team right now, so "the darkest team
  // color" is just team.color - if a second (lighter/accent) color ever
  // gets added, swap in whichever of the two is darker here.
  // BG_DARKEN_FACTOR is compound: 0.55 was the original darkening pass,
  // then another 30% darker on top (x0.7) per feedback.
  const BG_DARKEN_FACTOR = 0.55 * 0.7;
  const bgColor = darkenColor(team.color, BG_DARKEN_FACTOR, 1);

  return (
    // No isolate here - it trapped the giant logo's -z-10 inside this
    // wrapper's own local stacking context, so instead of correctly
    // painting behind the sidebar (which has no z-index of its own), the
    // whole wrapper - logo included - painted as one unit on top of it,
    // making the sidebar look transparent. Without isolate, -z-10 compares
    // globally and properly loses to the sidebar's opaque background.
    <div key={trackedTeam} className="relative flex-1 min-h-full">
      <div className="absolute inset-0 -z-10" style={{ background: bgColor }} />
      {/* One giant logo pinned to the left - fixed (not absolute) so it
          stays put as the page scrolls instead of sliding away with the
          schedule grid, reading as a persistent brand mark rather than
          part of the scrolling content. Same oversized 85vh height at
          every width - it should stay big on mobile, not shrink to fit.
          Left position differs by breakpoint: at lg the sidebar (80-240px
          depending on collapsed state) already covers everything left of
          the content pane, so the logo sits just past it (20px) rather
          than bleeding off the true edge, which would only hide more of
          it for nothing. Below lg there's no sidebar, so it's fine - the
          goal there is the opposite: pushed well off the left edge so
          it's unambiguously "bleeding in from off-screen" rather than
          looking like a big shape roughly centered in the viewport. */}
      <img
        src={team.logo}
        alt=""
        crossOrigin="anonymous"
        // max-w-none overrides Tailwind's preflight `img { max-width:
        // 100% }` - without it, a fixed element's containing block is the
        // viewport, so on mobile the browser was capping this image's
        // rendered WIDTH at the viewport's width while height stayed at
        // 85vh, vertically stretching it out of its aspect ratio instead
        // of letting it render at its natural (much wider) size and just
        // clip against the screen edge.
        className="fixed -z-10 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.17] h-[85vh] w-auto max-w-none left-[-15vh] lg:left-[20px]"
      />
      <main className="flex-1 px-4 pb-10 pt-8 max-w-4xl w-full mx-auto">
      <div className="mb-8 flex items-center justify-center gap-5">
        {/* Nudged up slightly - flexbox centers the boxes, but the title's
            display font carries extra space below its cap height, so true
            box-centering reads as the logo sitting a touch low. */}
        <img src={team.logo} alt="" className="h-24 sm:h-28 w-auto shrink-0 relative -top-1.5" crossOrigin="anonymous" />
        {/* w-min below lg: when the title wraps (as it always does on
            mobile), a plain flex item still keeps the full leftover row
            width, so the lockup centers on that oversized box and reads
            as shoved left. min-content sizing shrink-wraps the box to the
            wrapped lines so logo+text center as one unit. */}
        <div className="text-left w-min lg:w-auto">
          <div className="text-xs text-white/45 tracking-[0.25em] mb-1 whitespace-nowrap">RECORD PREDICTOR</div>
          {/* The switcher lives INSIDE the h1's own text flow (not as a
              flex sibling in a separate row) so it wraps along with the
              title text on mobile instead of overflowing past whichever
              wrapped line happens to be narrower than the full row. The
              team name itself also opens it - clicking the small chevron
              specifically isn't an obvious enough target - by toggling the
              same lifted-up open state the chevron button controls. */}
          <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            <button type="button" onClick={() => setSwitcherOpen((v) => !v)} className="hover:opacity-80 transition-opacity cursor-pointer">
              {team.city.toUpperCase()} {team.name.toUpperCase()}
            </button>{" "}
            <TeamSwitcher
              currentTeam={trackedTeam}
              open={switcherOpen}
              onOpenChange={setSwitcherOpen}
              className="inline-flex align-middle -translate-y-1"
            />
          </h1>
        </div>
      </div>

      {loaded && (
        <>
          <div className="flex flex-col gap-4 max-w-md mx-auto lg:hidden">
            {schedule.map((row) => (
              <SeasonRow key={row.week} row={row} trackedTeam={trackedTeam} picks={picks} setPick={setPick} />
            ))}
          </div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
            {[scheduleCol1, scheduleCol2].map((col, i) => (
              <div key={i} className="flex flex-col gap-4">
                {col.map((row) => (
                  <SeasonRow key={row.week} row={row} trackedTeam={trackedTeam} picks={picks} setPick={setPick} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center mt-10">
            {/* Suspicious Picks and Vegas Prediction share one explicit
                width at each breakpoint (instead of sizing to their own
                content) so they land as equal-size bookends - which is
                also what keeps My Prediction, the one pill in between,
                sitting at the row's true center instead of drifting
                toward whichever side has the wider neighbor. Both always
                stack their label on two lines: at the width needed for
                them to match each other, "SUSPICIOUS PICKS" or "VEGAS
                PREDICTION" on one line wouldn't fit. */}
            {/* All three pills share one explicit height per breakpoint
                (in addition to Suspicious/Vegas already sharing a width) -
                their natural content heights differed by up to 18px since
                each has a different icon/text/padding combination, which
                read as visibly uneven despite the widths already matching. */}
            <div className="flex gap-2 sm:gap-3 justify-center items-center">
              <div
                className="w-[108px] h-[54px] sm:w-[190px] sm:h-[108px] shrink-0 rounded-full border-2 border-white text-center flex items-center justify-center gap-1.5 sm:gap-3"
                style={{ background: "transparent", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
              >
                <img src="/suspicious-dog.png" alt="" className="h-7 sm:h-12 w-auto select-none shrink-0" />
                <div className="text-left">
                  <div className="text-base sm:text-3xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                    {suspiciousCount}
                  </div>
                  <div className="text-[7px] sm:text-[11px] leading-tight text-white/55 mt-0.5 sm:mt-1.5 tracking-wide">
                    SUSPICIOUS
                    <br />
                    PICKS
                  </div>
                </div>
              </div>

              <div
                className="h-[54px] sm:h-[108px] shrink-0 rounded-full border-2 border-white text-center pl-3.5 pr-4.5 sm:pl-7 sm:pr-10 flex items-center gap-1.5 sm:gap-3.5"
                style={{ background: team.color, boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
              >
                <img src={team.logo} alt="" className="h-7 sm:h-[52px] w-auto shrink-0" crossOrigin="anonymous" />
                <div className="text-left">
                  <div className="text-lg sm:text-4xl leading-none text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {wins}-{losses}
                  </div>
                  <div className="text-[7px] sm:text-[11px] leading-tight text-white/55 mt-0.5 sm:mt-1.5 tracking-wide">
                    <span className="sm:hidden">
                      MY
                      <br />
                      PREDICTION
                    </span>
                    <span className="hidden sm:inline whitespace-nowrap">MY PREDICTION</span>
                  </div>
                </div>
              </div>

              {winTotal !== undefined && (
                <div
                  className="w-[108px] h-[54px] sm:w-[190px] sm:h-[108px] shrink-0 rounded-full border-2 border-white text-center flex items-center justify-center"
                  style={{ background: "transparent", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
                >
                  <div className="text-center">
                    <div className="text-base sm:text-4xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                      {winTotal}
                    </div>
                    <div className="text-[7px] sm:text-[11px] leading-tight text-white/55 mt-0.5 sm:mt-1.5 tracking-wide">
                      VEGAS
                      <br />
                      PREDICTION
                    </div>
                  </div>
                </div>
              )}
            </div>

            {diff !== null && (
              <p
                className="text-sm sm:text-lg mt-3 sm:mt-4"
                style={{ fontFamily: "var(--font-display)", color: diff > 0 ? "#4ade80" : diff < 0 ? "#ef4444" : "#ffffff" }}
              >
                {diff > 0 ? "+" : ""}
                {diff} {diff > 0 ? "OVER" : diff < 0 ? "UNDER" : "PUSH"} Vegas&rsquo; line
              </p>
            )}

            <button
              aria-label="Share your predicted schedule"
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-2 rounded-full px-7 py-3.5 text-lg mt-6 active:scale-95 transition-transform duration-150 disabled:opacity-60"
              style={{
                fontFamily: "var(--font-display)",
                background: team.color,
                color: "#ffffff",
                boxShadow: `0 4px 20px ${darkenColor(team.color, 1, 0.35)}`,
              }}
            >
              {sharing ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
              onClick={async () => {
                if (await confirm("Reset all your schedule predictions?")) resetPicks();
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
      {dialog}
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
