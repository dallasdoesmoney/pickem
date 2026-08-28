"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import Link from "next/link";
import { TEAMS, TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { WIN_TOTALS } from "@/data/winTotals";
import { isSuspiciousPick } from "@/data/powerRankings";
import { SeasonGameCard, SeasonByeCard, SEASON_PILL_WIDTH, COMPACT_SCALE } from "@/components/SeasonGameCard";
import { kpiFraction, kpiSizer } from "@/lib/kpiScale";
import { useBoardView } from "@/hooks/useBoardView";
import { StreamerSettings } from "@/components/StreamerSettings";
import { darkenColor } from "@/components/TeamHalfPill";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { useSeasonPicks } from "@/hooks/useSeasonPicks";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { SavePicksPrompt } from "@/components/SavePicksPrompt";
import { supabase } from "@/lib/supabase/client";
import { saveSeasonPicks, syncOpponentSeasonPicks } from "@/lib/supabase/picks";
import { syncPredictorAchievements } from "@/lib/supabase/achievements";
import { renderPredictorShareImage } from "@/lib/predictorShareImage";
import { buildReferralLink } from "@/lib/referralStorage";
import { tintedGround } from "@/lib/pageGround";

const PENDING_SAVE_KEY = "pickem:pending-save-intent";

export default function PredictorPageClient({ trackedTeam }: { trackedTeam: TeamAbbr }) {
  const team = TEAMS[trackedTeam];
  const schedule = getTeamSchedule(trackedTeam);

  // Same order as the team picker and switcher dropdown, so "next" here
  // matches what you'd expect from those - wraps around at both ends
  // rather than dead-ending on Washington/Arizona.
  const teamIndex = TEAMS_SORTED.findIndex((t) => t.abbr === trackedTeam);
  const prevTeam = TEAMS_SORTED[(teamIndex - 1 + TEAMS_SORTED.length) % TEAMS_SORTED.length];
  const nextTeam = TEAMS_SORTED[(teamIndex + 1) % TEAMS_SORTED.length];
  const view = useBoardView();
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  // Streamer mode: blank board for a guest, and nothing from it reaches
  // the account - see usePicks for why both the hook and the save calls
  // have to be guarded.
  const { picks, setPick, resetPicks, loaded } = useSeasonPicks(trackedTeam, view.streamerMode);
  const { confirm, dialog } = useConfirmDialog();
  const { user, profile } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const [sharing, setSharing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const winTotal = WIN_TOTALS[trackedTeam];

  // Column count, gap and scale are display settings now - see
  // useBoardView, which the weekly page shares. Eighteen weeks across
  // four columns is five rows instead of nine, at the same pill size.
  const gridColumnGap = view.gap;
  const contentWidth = view.contentWidth;
  const gridScale = view.scale;

  // The three KPI pills used to size off an `lg:` breakpoint while
  // everything else on the page sized off gridScale, and the two don't
  // line up: gridScale is already pinned at its 0.85 ceiling by ~647px,
  // so from 1023px down to 647px the schedule cards stayed identical
  // while the pills dropped from 190x88 to 92x56 in a single step. On a
  // 1000px window that reads as the page deciding you're on a phone when
  // nothing else about it has changed.
  //
  // So they interpolate instead - see kpiScale.ts for the rule, which
  // the weekly page's stat pills share because these were sized to match
  // that page's in the first place.
  const kpiT = kpiFraction(contentWidth);
  const kpiBase = kpiSizer(kpiT);
  // Zoom on top of the width-derived size, so the pills stay in
  // proportion with the board rather than towering over a zoomed-out one.
  const kpi = (phone: number, desktop: number) => Math.round(kpiBase(phone, desktop) * view.zoom);
  // One line of label only at full size, where the pill is tall and wide
  // enough to carry it - below that it stacks, as the breakpoint did.
  const kpiWideLabel = kpiT === 1;

  // Share button multipliers solved to reproduce the old fixed desktop size
  // at gridScale 0.85 and shrink proportionally below it, with tap-target
  // floors - identical treatment to the weekly page's share button.
  const shareBtnFontPx = Math.max(13, 21 * gridScale);
  const shareBtnPadY = Math.max(9, 16.5 * gridScale);
  const shareBtnPadX = Math.max(16, 33 * gridScale);
  const shareBtnIconPx = Math.max(14, 20 * gridScale);

  async function handleSaveAndSubmit() {
    // Unreachable while the button is swapped out below, but this is the
    // path a guest's predictions would take to the host's account, so it
    // is guarded rather than trusted.
    if (view.streamerMode) return;
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      let userId = user?.id;
      if (!userId) {
        const signedIn = await requestSignIn();
        if (!signedIn) {
          setSaving(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user.id;
      }
      // No userId here means the sign-in was a Google redirect - the
      // pending-save effect below picks it back up once the page reloads
      // with a session, so there's nothing more to do in this click.
      if (!userId) return;
      await saveSeasonPicks(userId, trackedTeam, picks);
      posthog.capture("season_predictions_saved", {
        team: trackedTeam,
        picks_count: Object.keys(picks).length,
      });
      syncOpponentSeasonPicks(userId, trackedTeam, picks, schedule).catch((err) => console.error("Opponent sync failed", err));
      syncPredictorAchievements().catch((err) => console.error("Achievement sync failed", err));
    } catch (err) {
      console.error("Save failed", err);
      setSaveError("Couldn't save your picks. Try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!user || !loaded || view.streamerMode) return;
    if (sessionStorage.getItem(PENDING_SAVE_KEY) !== "1") return;
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    saveSeasonPicks(user.id, trackedTeam, picks)
      .then(() => {
        syncOpponentSeasonPicks(user.id, trackedTeam, picks, schedule).catch((err) => console.error("Opponent sync failed", err));
        syncPredictorAchievements().catch((err) => console.error("Achievement sync failed", err));
      })
      .catch((err) => {
        console.error("Save failed", err);
        setSaveError("Couldn't save your picks. Try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded]);


  // Auto-save while signed in, same debounced/hydration-guard pattern as
  // the weekly picks page. skipNextAutoSaveRef resets whenever loaded goes
  // false, which useSeasonPicks already does at the start of every fetch
  // cycle - including switching teams via TeamSwitcher/prev-next, since
  // that hook keys its effect on `team`. Driven off `loaded`'s value
  // rather than component lifecycle, so it's correct whether or not
  // switching teams happens to remount this component.
  const skipNextAutoSaveRef = useRef(true);
  useEffect(() => {
    if (!loaded) {
      skipNextAutoSaveRef.current = true;
      return;
    }
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    if (!user || view.streamerMode) return;
    const timeout = setTimeout(() => {
      saveSeasonPicks(user.id, trackedTeam, picks)
        .then(() => {
          syncOpponentSeasonPicks(user.id, trackedTeam, picks, schedule).catch((err) => console.error("Opponent sync failed", err));
          syncPredictorAchievements().catch((err) => console.error("Achievement sync failed", err));
        })
        .catch((err) => {
          console.error("Auto-save failed", err);
          setSaveError("Couldn't save your picks. Try again.");
        });
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, loaded, user]);

  // Columns read top-to-bottom then wrap (weeks 1-9, then 10-18), not
  // interleaved left/right the way CSS grid's row-major auto-placement
  // would. Each column is its own flex stack for exactly that reason,
  // which is also why the split is done here rather than left to the
  // grid. Column count is a display setting now - see useBoardView.
  const scheduleColumns = useMemo(() => {
    const per = Math.ceil(schedule.length / view.cols);
    return Array.from({ length: view.cols }, (_, i) => schedule.slice(i * per, (i + 1) * per));
  }, [schedule, view.cols]);

  const wins = Object.values(picks).filter((winner) => winner === trackedTeam).length;
  const losses = Object.values(picks).filter((winner) => winner !== trackedTeam).length;
  const gamesPicked = wins + losses;
  const diff = winTotal !== undefined && gamesPicked > 0 ? Math.round((wins - winTotal) * 2) / 2 : null;

  // Nudge a signed-out visitor once they are clearly invested - halfway
  // through the season - rather than only pitching it passively. The
  // weekly board has had this for a while; the predictor had nothing, so
  // somebody could fill in all eighteen weeks without ever being told
  // the work lived in one browser.
  //
  // Keyed per TEAM in localStorage, not per visit: predicting the Ravens
  // and then the Chiefs is two boards, and being asked once for each is
  // reasonable where being asked on every page load is not.
  useEffect(() => {
    if (user || !loaded || view.streamerMode || schedule.length === 0) return;
    if (gamesPicked / schedule.length < 0.5) return;
    const key = `pickem:save-prompt-seen-${trackedTeam}`;
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    // Deliberate, and the rule's usual advice does not apply: this is not
    // derived state that could be computed during render. It is a
    // one-time side effect keyed on a localStorage marker - "has this
    // person been asked about this board before" - which render has no
    // business reading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSavePrompt(true);
  }, [user, loaded, gamesPicked, schedule.length, trackedTeam, view.streamerMode]);

  // Close this before opening the sign-in modal, not after - both are
  // fixed inset-0 overlays, and leaving one mounted under the other is
  // the "have to exit out twice" bug the weekly page already hit.
  function handleSavePromptSignUp() {
    setShowSavePrompt(false);
    if (view.streamerMode) return;
    void handleSaveAndSubmit();
  }


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
        posthog.capture("season_predictions_shared", {
          team: trackedTeam,
          share_method: "download",
        });
      }

      const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: "Record Predictor",
            text: `I think the ${team.name} will win ${wins} games!\n\n${buildReferralLink(profile?.username)}`,
          });
          posthog.capture("season_predictions_shared", {
            team: trackedTeam,
            share_method: "native_share",
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

  // Page background tinted to the tracked team, sitting at the same
  // darkness as every other page on the site - see tintedGround for why
  // that is a mix toward the ground rather than a fraction of the team
  // colour.
  const bgColor = tintedGround(team.color);

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
      <div className="relative mb-3 flex items-center justify-center gap-5">
        <span className="absolute right-0 top-0">
          <StreamerSettings view={view} open={viewMenuOpen} onOpenChange={setViewMenuOpen} />
        </span>
        {/* Nudged up slightly - flexbox centers the boxes, but the title's
            display font carries extra space below its cap height, so true
            box-centering reads as the logo sitting a touch low. */}
        {/* Smaller below sm so the title beside it clears the longest
            single word in the league ("PHILADELPHIA" / "JACKSONVILLE" run
            ~242px at this type size, against a box that was only 243px
            wide on a 375px phone - no room at all on anything narrower). */}
        <img
          src={team.logo}
          alt=""
          className="w-auto shrink-0 relative -top-1.5"
          style={{ height: (view.viewportWidth >= 1024 ? 96 : view.viewportWidth >= 640 ? 80 : 56) * view.zoom }}
          crossOrigin="anonymous"
        />
        {/* Sized to the room actually left beside the logo (a flex item
            shrinking from its max-content width), NOT min-content: at
            min-content the box collapses to the widest single word, which
            wrapped long names like "NEW ENGLAND PATRIOTS" onto a line
            each and made this header far taller than the weekly page's.
            min-w-0 because a flex item won't shrink below its min-content
            width (the longest word) by default, so without it the h1's
            break-words guard below can never actually take effect. */}
        <div className="text-left min-w-0">
          <div
            className="text-white/45 tracking-[0.25em] mb-1 whitespace-nowrap"
            style={{ fontSize: 12 * view.zoom }}
          >
            RECORD PREDICTOR
          </div>
          {/* A step below the weekly page's WEEK N title rather than
              matching it. This one has to fit a whole team name plus the
              switcher's chevron in the room left beside the logo, and at
              the weekly size the chevron was pushed off the visible line
              on the longer names - the only cue that the team is
              changeable, gone exactly where the page is most cramped. */}
          {/* break-words is the last-resort guard on the very narrowest
              phones: a word with nowhere left to go breaks instead of
              running off the side of the page. */}
          <h1
            className="leading-none tracking-wide break-words"
            style={{
              fontFamily: "var(--font-display)",
              // The clamp this replaces, with the zoom folded in.
              fontSize: `clamp(${1.4 * view.zoom}rem, ${5.6 * view.zoom}vw, ${2.25 * view.zoom}rem)`,
            }}
          >
            <TeamSwitcher currentTeam={trackedTeam} open={switcherOpen} onOpenChange={setSwitcherOpen}>
              {team.city.toUpperCase()} {team.name.toUpperCase()}
            </TeamSwitcher>
          </h1>
        </div>
      </div>

      {loaded && (
        <>
          {/* One grid at every width now, exactly like weekly/page.tsx -
              there's no separate full-size single-column mobile layout
              anymore, which is what made these cards read as huge next to
              the weekly page's. Explicit track width (not grid-cols-2's
              1fr 1fr): a 1fr column doesn't shrink just because the scaled
              card inside it does, it just leaves dead space that reads as
              a far bigger gap between columns than the real one. The two
              columns stay separate flex stacks so the schedule still reads
              top-to-bottom then wraps (weeks 1-9, then 10-18) rather than
              interleaving left/right the way grid auto-placement would. */}
          <div
            className="grid items-start justify-center"
            style={{ gridTemplateColumns: `repeat(${view.cols}, ${SEASON_PILL_WIDTH * gridScale}px)`, columnGap: gridColumnGap }}
          >
            {scheduleColumns.map((col, i) => (
              // The weekly page uses 32 here, but it is not spending 32 on
              // white space: each of its pills carries a day/time tab that
              // pokes 21.2 above the pill's top edge, so what a reader
              // actually sees between two cards there is ~11. These pills
              // have no tab, so the same 32 read as roughly three times
              // the weekly page's gap. Matching the visible result rather
              // than the number is what keeps the two pages in step.
              <div key={i} className="flex flex-col" style={{ gap: 11 * gridScale }}>
                {col.map((row) => (
                  <SeasonRow key={row.week} row={row} trackedTeam={trackedTeam} picks={picks} setPick={setPick} scale={gridScale} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center" style={{ marginTop: 20 * view.zoom }}>
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
            {/* Heights match the weekly page's stat pills at both ends
                (56px on a phone, 88px at full size) - these used to jump
                to a much taller 108px all the way down at sm, which is a
                big part of what made this page read as oversized next to
                weekly. Widths still differ from that page's by design:
                these lay their icon and label out side by side rather than
                stacked, so they need more horizontal room at the same
                height. */}
            <div className="flex justify-center items-center flex-wrap" style={{ gap: kpi(8, 20) }}>
              <div
                className="shrink-0 rounded-full border-2 border-white text-center flex items-center justify-center"
                style={{
                  width: kpi(92, 190),
                  height: kpi(56, 88),
                  gap: kpi(6, 12),
                  background: "transparent",
                  boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)",
                }}
              >
                <img src="/suspicious-dog.png" alt="" className="w-auto select-none shrink-0" style={{ height: kpi(28, 40) }} />
                <div className="text-left">
                  <div className="leading-none" style={{ fontFamily: "var(--font-display)", fontSize: kpi(16, 24) }}>
                    {suspiciousCount}
                  </div>
                  <div className="leading-tight text-white/55 tracking-wide" style={{ fontSize: kpi(7, 11), marginTop: kpi(2, 4) }}>
                    SUSPICIOUS
                    <br />
                    PICKS
                  </div>
                </div>
              </div>

              <div
                className="shrink-0 rounded-full border-2 border-white text-center flex items-center"
                style={{
                  height: kpi(56, 88),
                  gap: kpi(6, 12),
                  paddingLeft: kpi(14, 24),
                  paddingRight: kpi(18, 32),
                  background: team.color,
                  boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)",
                }}
              >
                <img src={team.logo} alt="" className="w-auto shrink-0" style={{ height: kpi(28, 44) }} crossOrigin="anonymous" />
                <div className="text-left">
                  <div className="leading-none text-white" style={{ fontFamily: "var(--font-display)", fontSize: kpi(18, 30) }}>
                    {wins}-{losses}
                  </div>
                  <div className="leading-tight text-white/55 tracking-wide" style={{ fontSize: kpi(7, 11), marginTop: kpi(2, 4) }}>
                    {kpiWideLabel ? (
                      <span className="whitespace-nowrap">MY PREDICTION</span>
                    ) : (
                      <span>
                        MY
                        <br />
                        PREDICTION
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {winTotal !== undefined && (
                <div
                  className="shrink-0 rounded-full border-2 border-white text-center flex items-center justify-center"
                  style={{
                    width: kpi(92, 190),
                    height: kpi(56, 88),
                    background: "transparent",
                    boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="text-center">
                    <div className="leading-none" style={{ fontFamily: "var(--font-display)", fontSize: kpi(16, 30) }}>
                      {winTotal}
                    </div>
                    <div className="leading-tight text-white/55 tracking-wide" style={{ fontSize: kpi(7, 11), marginTop: kpi(2, 4) }}>
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
              className="flex items-center gap-2 rounded-full active:scale-95 transition-transform duration-150 disabled:opacity-60"
              style={{
                marginTop: 20 * view.zoom,
                fontFamily: "var(--font-display)",
                background: team.color,
                color: "#ffffff",
                boxShadow: `0 4px 20px ${darkenColor(team.color, 1, 0.35)}`,
                fontSize: shareBtnFontPx,
                padding: `${shareBtnPadY}px ${shareBtnPadX}px`,
              }}
            >
              {sharing ? (
                <>
                  <span
                    className="rounded-full border-2 border-white/40 border-t-white animate-spin"
                    style={{ height: shareBtnIconPx, width: shareBtnIconPx }}
                  />
                  SHARING&hellip;
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" style={{ height: shareBtnIconPx, width: shareBtnIconPx }} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="M7 8l5-5 5 5" />
                    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                  </svg>
                  SHARE MY PREDICTIONS 🏈
                </>
              )}
            </button>

            {/* Save and Reset sit side by side in one row at a shared
                height, same as the weekly page - stacking them made three
                separate button rows below the pills. */}
            {view.streamerMode ? (
              /* Just the clear button - see the weekly page for why the
                 "nothing is saved" badge came back out. */
              <div className="flex items-center justify-center" style={{ marginTop: 12 * view.zoom }}>
                <button
                  type="button"
                  onClick={() => {
                    resetPicks();
                    posthog.capture("streamer_board_cleared", { team: trackedTeam });
                  }}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[12.5px] text-white shadow-[0_6px_16px_-6px_rgba(239,68,68,0.6)] transition-transform active:scale-95"
                  style={{ fontFamily: "var(--font-display)", background: "#ef4444" }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                  CLEAR FOR NEXT GUEST
                </button>
              </div>
            ) : (
            <div className="flex flex-col items-center" style={{ marginTop: 12 * view.zoom }}>
              <div className="flex items-center justify-center gap-3">
                <button
                  aria-label="Save and submit your predictions"
                  onClick={handleSaveAndSubmit}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 h-9 rounded-full px-6 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-60"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: "linear-gradient(135deg, #34d399, #059669)",
                    color: "#ffffff",
                  }}
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      SAVING&hellip;
                    </>
                  ) : user ? (
                    // Signed in means auto-save has this covered - the button
                    // reads SAVED at rest instead of reverting to "Save &
                    // Submit" a few seconds later, which read as "did that not
                    // save?"
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      SAVED
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                        <path d="M17 21v-8H7v8" />
                        <path d="M7 3v5h8" />
                      </svg>
                      SAVE &amp; SUBMIT PICKS
                    </>
                  )}
                </button>

                <button
                  aria-label="Reset your predictions"
                  onClick={async () => {
                    if (await confirm("Reset all your schedule predictions?", "RESET")) {
                      resetPicks();
                      posthog.capture("season_predictions_reset", { team: trackedTeam });
                    }
                  }}
                  className="flex items-center justify-center h-9 text-xs text-white/40 hover:text-white/70 rounded-full px-4 border border-white/15 hover:border-white/30 transition-colors"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  RESET
                </button>
              </div>
              {saveError && <p className="text-xs text-red-400 mt-2">{saveError}</p>}
            </div>
            )}

            <div className="flex items-center justify-between w-full max-w-xs gap-3" style={{ marginTop: 24 * view.zoom }}>
              <Link
                href={`/predictor/${prevTeam.abbr.toLowerCase()}`}
                aria-label={`Previous team: ${prevTeam.city} ${prevTeam.name}`}
                className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3.5 py-1.5 text-xs border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                <img src={prevTeam.logo} alt="" className="h-4 w-4 object-contain shrink-0" crossOrigin="anonymous" />
                {prevTeam.abbr}
              </Link>
              <Link
                href={`/predictor/${nextTeam.abbr.toLowerCase()}`}
                aria-label={`Next team: ${nextTeam.city} ${nextTeam.name}`}
                className="flex items-center gap-1.5 rounded-full pl-3.5 pr-2.5 py-1.5 text-xs border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {nextTeam.abbr}
                <img src={nextTeam.logo} alt="" className="h-4 w-4 object-contain shrink-0" crossOrigin="anonymous" />
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </>
      )}
      </main>
      {dialog}
      {signInModal}
      {showSavePrompt && (
        <SavePicksPrompt
          context={`the ${team.name}\u2019 season`}
          onSignUp={handleSavePromptSignUp}
          onDismiss={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  );
}

function SeasonRow({
  row,
  trackedTeam,
  picks,
  setPick,
  scale = 1,
}: {
  row: ReturnType<typeof getTeamSchedule>[number];
  trackedTeam: TeamAbbr;
  picks: Record<number, TeamAbbr>;
  setPick: (week: number, winner: TeamAbbr) => void;
  // Responsive card scale solved by the page's grid - see gridScale.
  scale?: number;
}) {
  return "bye" in row ? (
    <SeasonByeCard team={trackedTeam} week={row.week} scale={scale} />
  ) : (
    <SeasonGameCard
      away={row.away}
      home={row.home}
      trackedTeam={trackedTeam}
      week={row.week}
      picked={picks[row.week]}
      onPick={(winner) => setPick(row.week, winner)}
      scale={scale}
    />
  );
}
