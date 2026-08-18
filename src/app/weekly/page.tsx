"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { GameCard, COMPACT_SCALE, PILL_WIDTH } from "@/components/GameCard";
import { LOCK_COLOR } from "@/components/TeamHalfPill";
import { usePicks } from "@/hooks/usePicks";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { supabase } from "@/lib/supabase/client";
import { saveWeeklyPicks } from "@/lib/supabase/picks";
import { syncWeeklyPickemAchievements, syncLockBonus } from "@/lib/supabase/achievements";
import { fetchWeeks, fetchGameResults, WeekRow } from "@/lib/supabase/admin";
import { fetchLeaderboard, fetchMyLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { errorMessage } from "@/lib/errorMessage";
import { WeekSwitcher } from "@/components/WeekSwitcher";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { PickStats, DesktopCell, buildDesktopRows, computePickStats, computePickTags } from "@/lib/pickLayout";
import { renderShareImage } from "@/lib/shareImage";
import { TeamAbbr, TEAMS } from "@/data/teams";
import { buildReferralLink } from "@/lib/referralStorage";

const PENDING_SAVE_KEY = "pickem:pending-save-intent";

// A closed week is enforced at the database level (see
// weekly_picks_insert_own's RLS policy), so a save attempt after the
// admin closes a week mid-click surfaces as a row-level-security error -
// worth a specific message instead of a generic one.
function describeSaveError(err: unknown): string {
  const message = errorMessage(err);
  if (message.toLowerCase().includes("row-level security")) return "This week is closed for picking.";
  return "Couldn't save your picks. Try again.";
}

function PillTexture() {
  return (
    <div
      className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
      style={{ backgroundImage: "url(/noise.png)", backgroundSize: "64px 64px", opacity: 0.1, mixBlendMode: "overlay" }}
    />
  );
}

const PILL_STYLE = { background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" };

function StatPills({ stats, lockedTeam }: { stats: PickStats; lockedTeam: (typeof TEAMS)[TeamAbbr] | null }) {
  return (
    <div className="flex gap-2 lg:gap-5 justify-center flex-wrap">
      <div
        className="relative shrink-0 rounded-full border-2 border-white text-center flex flex-col items-center justify-center w-[88px] h-[56px] lg:w-[172px] lg:h-[88px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <img
          src="/underdog-bulldog.png"
          alt=""
          className="absolute -top-2 -left-1 lg:-top-3 lg:-left-1.5 h-8 lg:h-16 w-auto rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10"
        />
        <div className="relative z-10 text-base lg:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          {stats.underdogCount}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">UNDERDOGS</div>
      </div>
      {/* Center slot - the most prominent pill (widest, emerald border),
          previously Boldest Pick. Lock of the Week took over this spot
          since it's the more important tag; Boldest Pick moved to the
          slot Chalk used to occupy below. */}
      <div
        className="relative shrink-0 rounded-full border-2 text-center flex flex-col items-center justify-center w-[144px] h-[56px] lg:w-[250px] lg:h-[88px]"
        style={{ ...PILL_STYLE, borderColor: LOCK_COLOR, background: lockedTeam ? lockedTeam.color : PILL_STYLE.background }}
      >
        <PillTexture />
        <img
          src="/lock-of-week.png"
          alt=""
          className="absolute -top-2 -left-1 lg:-top-3 lg:-left-1.5 h-8 lg:h-16 w-auto rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10"
        />
        <div
          className="relative z-10 text-base lg:text-2xl flex items-center justify-center gap-1 lg:gap-1.5"
          style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}
        >
          {lockedTeam ? <img src={lockedTeam.logo} alt="" crossOrigin="anonymous" className="h-8 lg:h-[64px] w-auto" /> : "-"}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">LOCK OF THE WEEK</div>
      </div>
      <div
        className="relative shrink-0 rounded-full border-2 border-white text-center flex flex-col items-center justify-center w-[88px] h-[56px] lg:w-[172px] lg:h-[88px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <img
          src="/boldest-pick-alarm.png"
          alt=""
          className="absolute -top-2.5 -left-1 lg:-top-4 lg:-left-1.5 h-7 lg:h-14 w-auto rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10"
        />
        <div
          className="relative z-10 text-sm lg:text-xl flex items-center justify-center gap-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {stats.boldestTeam ? (
            <>
              <img src={stats.boldestTeam.logo} alt="" crossOrigin="anonymous" className="h-6 lg:h-10 w-auto" />+{stats.boldestSpread}
            </>
          ) : (
            "-"
          )}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">BOLDEST PICK</div>
      </div>
    </div>
  );
}

// Plain visual glyph now - no click handling of its own. A placeholder
// "?" when signed out rather than hiding entirely, so this whole readout
// doubles as a sign-up pitch instead of only appearing once you already
// have an account. Lives inside WeeklyRecordPill's own bordered pill (see
// below) rather than sitting next to it as a separate circle.
function ProfileAvatar({ url, initial, signedIn }: { url?: string | null; initial: string; signedIn: boolean }) {
  const dims = "h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full flex items-center justify-center text-sm sm:text-base";
  if (!signedIn) {
    return <span className={`${dims} bg-white/5 border border-dashed border-white/25 text-white/40`}>?</span>;
  }
  return url ? (
    <img src={url} alt="" className={`${dims} object-cover border-2 border-white/20`} />
  ) : (
    <span className={`${dims} bg-white/10 border-2 border-white/20`}>{initial}</span>
  );
}

// Sits between the page title and the first matchup - three colored
// segments (not just plain text) so it reads as a small dashboard
// readout, matching the app's existing emoji-icon convention
// (achievements, stat pills) for the per-segment flourish. Same three
// KPIs (and avatar) as the pick'em hub's own stat pill, so the two read
// as one consistent "your account" readout wherever it shows up. Avatar
// lives inside this same pill (not a separate circle next to it) - when
// signed out, the whole pill is one button into sign-in, not just the
// avatar corner of it.
function WeeklyRecordPill({
  seasonCorrect,
  seasonGraded,
  weeklyCorrect,
  weeklyGraded,
  week,
  rank,
  avatarUrl,
  initial,
  signedIn,
  onActivate,
  onOpenStandings,
}: {
  seasonCorrect: number;
  seasonGraded: number;
  weeklyCorrect: number;
  weeklyGraded: number;
  week: number;
  rank: number | null;
  avatarUrl?: string | null;
  initial: string;
  signedIn: boolean;
  onActivate?: () => void;
  onOpenStandings?: () => void;
}) {
  const segments = [
    { icon: "🏆", value: `${seasonCorrect}-${seasonGraded - seasonCorrect}`, label: "SEASON RECORD", color: "#c084fc" },
    { icon: "🏈", value: `${weeklyCorrect}-${weeklyGraded - weeklyCorrect}`, label: `WEEK ${week}`, color: "#4ade80" },
    { icon: "🌟", value: rank ? `#${rank}` : "–", label: "GLOBAL RANK", color: "#f59e0b" },
  ];

  const inner = (
    <>
      <ProfileAvatar url={avatarUrl} initial={initial} signedIn={signedIn} />
      <div className="w-px self-stretch bg-white/10 mx-1.5 sm:mx-2.5" />
      {segments.map((seg, i) => (
        <div key={seg.label} className="flex items-center">
          {i > 0 && <div className="w-px self-stretch bg-white/10 mx-4 sm:mx-6" />}
          <div className="flex flex-col items-center gap-0.5 px-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm leading-none">{seg.icon}</span>
              <span className="text-base sm:text-lg leading-none whitespace-nowrap" style={{ fontFamily: "var(--font-display)", color: seg.color }}>
                {seg.value}
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] text-white/50 tracking-wide whitespace-nowrap">{seg.label}</span>
          </div>
        </div>
      ))}
    </>
  );

  const pillClass = "flex items-stretch rounded-full border border-white/15 bg-[#1b2947] px-2.5 py-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]";

  return (
    <div className="flex justify-center mb-5 lg:mb-7">
      {signedIn ? (
        <button
          type="button"
          onClick={onOpenStandings}
          aria-label="View standings"
          className={`${pillClass} hover:border-white/30 transition-colors cursor-pointer`}
        >
          {inner}
        </button>
      ) : (
        <button
          type="button"
          onClick={onActivate}
          aria-label="Sign in to track your record"
          className={`${pillClass} hover:border-white/30 transition-colors cursor-pointer`}
        >
          {inner}
        </button>
      )}
    </div>
  );
}

// Shown instead of StatPills once results are in - the point of this
// screen is now "how'd I do," so it's a single, bigger, shareable record
// pill (mirrors the team predictor's "My Prediction" pill) rather than
// three small pre-game stats that no longer matter as much.
function ResultsPill({ correct, total, avatarUrl }: { correct: number; total: number; avatarUrl?: string | null }) {
  const wrong = total - correct;
  return (
    <div className="flex justify-center">
      <div
        className="relative shrink-0 rounded-full border-2 border-emerald-400 text-center flex items-center gap-3 sm:gap-4 pl-3 pr-7 sm:pl-5 sm:pr-10 h-[64px] sm:h-[100px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <span className="absolute -top-3 -left-2 z-10 rotate-[-14deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-9 w-9 sm:h-[52px] sm:w-[52px] rounded-full object-cover border-2 border-white" />
          ) : (
            <span className="h-9 w-9 sm:h-[52px] sm:w-[52px] rounded-full bg-[#1b2947] border-2 border-white flex items-center justify-center text-lg sm:text-2xl">
              🏈
            </span>
          )}
        </span>
        <div className="relative z-10 text-left ml-4 sm:ml-6">
          <div className="text-2xl sm:text-4xl leading-none text-white" style={{ fontFamily: "var(--font-display)" }}>
            {correct}-{wrong}
          </div>
          <div className="text-[9px] sm:text-[11px] text-white/55 mt-0.5 sm:mt-1.5 tracking-wide">MY RECORD</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  // CURRENT_WEEK is the fallback shown until the admin-controlled weeks
  // load (or if nothing's ever been opened) - keeps the homepage
  // rendering immediately instead of blocking on a network round-trip.
  // activeWeek is which week is currently being VIEWED - defaults to the
  // open week once known, but the switcher can point it at any week that's
  // open or has published results.
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [activeWeek, setActiveWeek] = useState(CURRENT_WEEK);
  // Toggles the whole page between making picks and the season
  // leaderboard, so getting the full season picture doesn't require
  // leaving this page - the leaderboard content itself is the exact same
  // shared component the standalone /leaderboard page renders.
  const [pageTab, setPageTab] = useState<"picks" | "leaderboard">("picks");
  const [weekSwitcherOpen, setWeekSwitcherOpen] = useState(false);
  const [results, setResults] = useState<Record<string, TeamAbbr>>({});
  // Drives the two-column grid's card scale (see gridScale below) - the
  // grid now runs at every viewport width, not just desktop, so it needs
  // to know the real available width to fit two cards side by side down
  // to the smallest phone. Starts at a conservative phone-sized guess
  // rather than null so there's no flash of desktop-sized (overflowing)
  // cards before the first real measurement lands.
  const [viewportWidth, setViewportWidth] = useState(390);
  useEffect(() => {
    function measure() {
      setViewportWidth(window.innerWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    fetchWeeks()
      .then((rows) => {
        setWeeks(rows);
        const openWeeks = rows.filter((w) => w.is_open).map((w) => w.week);
        if (openWeeks.length > 0) setActiveWeek(Math.max(...openWeeks));
      })
      .catch(() => {});
  }, []);

  const currentWeekRow = weeks.find((w) => w.week === activeWeek);
  // Before weeks finish loading, default to editable so the page behaves
  // exactly as it always has rather than briefly locking every control.
  const isEditable = weeks.length === 0 || currentWeekRow?.is_open === true;
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (currentWeekRow?.results_published) {
      fetchGameResults(activeWeek)
        .then(setResults)
        .catch(() => setResults({}));
      if (authUser) syncLockBonus().catch((err) => console.error("Lock bonus sync failed", err));
    } else {
      setResults({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWeek, currentWeekRow?.results_published, authUser]);

  const games = GAMES_BY_WEEK[activeWeek];
  const { picks, setPick, resetPicks, loaded, lockedGameId, toggleLock } = usePicks(activeWeek);
  const { confirm, dialog } = useConfirmDialog();
  const { user, profile } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  // Season-wide record (across every published week), for the record
  // pill's first segment - same query the profile page and leaderboard
  // already use, just scoped to whoever's signed in here.
  const [myRecord, setMyRecord] = useState<LeaderboardRow | null>(null);
  useEffect(() => {
    if (!user) {
      setMyRecord(null);
      return;
    }
    fetchMyLeaderboardEntry(user.id)
      .then(setMyRecord)
      .catch(() => setMyRecord(null));
  }, [user]);
  // Full board, fetched regardless of auth - there's no rank column in
  // the DB (see leaderboard.ts), so your position has to be found by
  // index in the same sorted array the leaderboard page itself renders.
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[] | null>(null);
  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaderboardRows)
      .catch(() => setLeaderboardRows([]));
  }, []);
  const myRank = user && leaderboardRows ? leaderboardRows.findIndex((r) => r.user_id === user.id) : -1;
  const pickedCount = Object.keys(picks).length;
  const gradedCount = games.filter((g) => results[g.id]).length;
  const correctCount = games.filter((g) => results[g.id] && picks[g.id] === results[g.id]).length;
  const hasResults = gradedCount > 0;
  const stats = computePickStats(games, picks);
  const lockedTeam = lockedGameId && picks[lockedGameId] ? TEAMS[picks[lockedGameId]] : null;
  const tags = computePickTags(games, picks);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Nudges a signed-out visitor to sign up once they're clearly invested -
  // halfway through picking a week's games - rather than only pitching it
  // passively via the KPI pill. Keyed per-week in localStorage so it fires
  // once per week, not on every page load once you're past the threshold.
  useEffect(() => {
    if (user || !loaded || games.length === 0) return;
    if (pickedCount / games.length < 0.5) return;
    const key = `pickem:save-prompt-seen-w${activeWeek}`;
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    setShowSavePrompt(true);
  }, [user, loaded, pickedCount, games.length, activeWeek]);

  async function handleSavePromptSignUp() {
    // Close this popup before opening the real sign-in modal, not after -
    // both are fixed/inset-0 overlays, so leaving this one mounted while
    // the sign-in modal is also open stacked two overlays on top of each
    // other (the reported "have to exit out" bug).
    setShowSavePrompt(false);
    const signedIn = await requestSignIn("signup");
    if (!signedIn) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    // No userId here means the sign-in was a Google redirect - the
    // pending-save effect below picks it back up once the page reloads
    // with a session.
    if (!userId) return;
    saveWeeklyPicks(userId, activeWeek, picks, lockedGameId)
      .then(() => {
        syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err));
      })
      .catch((err) => {
        console.error("Save failed", err);
        setSaveError(describeSaveError(err));
      });
  }

  // Shared by the Save and Share buttons - both are real, deliberate
  // actions on an incomplete slate (unlike auto-save, which just runs
  // silently in the background and shouldn't ever interrupt someone
  // mid-pick with a dialog). Once the week's closed, "incomplete" no
  // longer means anything - the picks are whatever they ended up being.
  async function confirmIfIncomplete(confirmLabel: string) {
    if (!isEditable || pickedCount >= games.length) return true;
    const remaining = games.length - pickedCount;
    return confirm(`You still have ${remaining} pick${remaining === 1 ? "" : "s"} left this week. Continue anyway?`, confirmLabel);
  }

  async function handleSaveAndSubmit() {
    if (saving) return;
    if (!(await confirmIfIncomplete("SAVE ANYWAY"))) return;
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
      await saveWeeklyPicks(userId, activeWeek, picks, lockedGameId);
      posthog.capture("weekly_picks_saved", {
        week: activeWeek,
        picks_count: Object.keys(picks).length,
        has_lock_pick: lockedGameId !== null,
      });
      syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err));
    } catch (err) {
      console.error("Save failed", err);
      setSaveError(describeSaveError(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!user || !loaded) return;
    if (sessionStorage.getItem(PENDING_SAVE_KEY) !== "1") return;
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    saveWeeklyPicks(user.id, activeWeek, picks, lockedGameId)
      .then(() => {
        syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err));
      })
      .catch((err) => {
        console.error("Save failed", err);
        setSaveError(describeSaveError(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded]);

  // Auto-save while signed in - debounced so a run of quick clicks
  // through several games collapses into one write, not one per click.
  // skipNextAutoSaveRef swallows the run where `picks` first changes after
  // loading finishes (that's the DB/localStorage hydrating the hook, not a
  // real edit) - without it, every page visit would re-save unchanged
  // picks. Resets to true whenever loaded goes false, so switching weeks
  // re-arms the same guard for the next week's hydration.
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
    if (!user) return;
    const timeout = setTimeout(() => {
      saveWeeklyPicks(user.id, activeWeek, picks, lockedGameId)
        .then(() => {
          syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err));
        })
        .catch((err) => {
          console.error("Auto-save failed", err);
          setSaveError(describeSaveError(err));
        });
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, lockedGameId, loaded, user, activeWeek]);

  async function handleShare() {
    if (sharing) return;
    if (!(await confirmIfIncomplete("SHARE ANYWAY"))) return;
    setSharing(true);
    try {
      const blob = await renderShareImage({ games, picks, week: activeWeek, results, avatarUrl: profile?.avatar_url, lockedGameId });
      const filename = hasResults ? `pickem-week-${activeWeek}-results.png` : `pickem-week-${activeWeek}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      function download() {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        posthog.capture("weekly_picks_shared", {
          week: activeWeek,
          includes_results: hasResults,
          share_method: "download",
        });
      }

      // Desktop Chrome (especially macOS) frequently advertises file
      // sharing support and then aborts immediately with no working share
      // target - confirmed on-device. Coarse pointer (touch) is a much
      // more reliable signal for "has a real native share sheet" than
      // canShare() alone, which the API spec never ties to that.
      const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });

      if (canShareFiles) {
        try {
          const summary = hasResults ? `My Week ${activeWeek} record: ${correctCount}-${gradedCount - correctCount}` : `My Week ${activeWeek} picks`;
          await navigator.share({
            files: [file],
            title: "NFL Pick'em",
            text: `${summary}\n\n${buildReferralLink(profile?.username)}`,
          });
          posthog.capture("weekly_picks_shared", {
            week: activeWeek,
            includes_results: hasResults,
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

  const desktopRows = buildDesktopRows(games);

  // The grid's own track width/gap, computed from whatever room is
  // actually available - mirrors what the old fixed COMPACT_SCALE did for
  // desktop only, just solved for instead of hardcoded, so two columns
  // fit on any screen instead of collapsing to a single mobile column.
  const gridPageX = 16; // matches main's px-4
  const gridColumnGap = viewportWidth < 640 ? 10 : 32;
  const gridScale = useMemo(() => {
    const contentWidth = Math.min(viewportWidth, 896) - gridPageX * 2;
    const columnWidth = (contentWidth - gridColumnGap) / 2;
    const raw = columnWidth / PILL_WIDTH;
    return Math.min(COMPACT_SCALE, Math.max(0.42, raw));
  }, [viewportWidth, gridColumnGap]);

  // Share button used to be a fixed desktop size regardless of viewport,
  // which read as oversized once the matchup pills themselves started
  // scaling down for mobile (see gridScale above). These multipliers are
  // solved so the button reproduces its original fixed size exactly at
  // gridScale 0.85 (desktop) and shrinks proportionally below that, with a
  // floor so it never gets too small to comfortably tap.
  const shareBtnFontPx = Math.max(13, 21 * gridScale);
  const shareBtnPadY = Math.max(9, 16.5 * gridScale);
  const shareBtnPadX = Math.max(16, 33 * gridScale);
  const shareBtnIconPx = Math.max(14, 20 * gridScale);

  // A small centered tab tucked behind each pill instead of a day-group
  // divider row - it's rendered BEFORE the GameCard in DOM order and
  // neither element sets an explicit z-index, so the pill's own opaque
  // fill (painted after, per normal stacking rules for same-stacking-
  // context elements) naturally covers the tab's lower half, leaving just
  // enough peeking out above to read the day and kickoff time. No row is
  // ever spent on a label now, on any day - the win here over the
  // per-day-divider approach is that single-game days (Thursday, Sunday
  // Night, Monday) no longer strand a wasted empty cell next to them.
  // Tab dimensions were tuned by eye at gridScale 0.85 (9px text, -18px
  // top, etc.) - these are that same tuning expressed as "at scale 1", so
  // multiplying by the actual gridScale reproduces the original desktop
  // look exactly at 0.85 and scales proportionally at any other width.
  // Font size gets a floor rather than scaling all the way down with the
  // card - a time label that shrinks below ~7.5px stops being legible
  // long before the pill itself does.
  const renderGridGame = (cell: DesktopCell | null, key: string) => {
    if (!cell) return <div key={key} />;
    const { game, timeLabel } = cell;
    const tabPadX = 11.8 * gridScale;
    // The visible (poked-up-above-the-pill) height stays exactly what it
    // was tuned to be - that's the tab's actual "size." Font size has a
    // floor (see above) that padding didn't previously account for, so at
    // small gridScale the text ended up taller than the shrinking padding
    // assumed, pushing it down toward the pill's border instead of
    // sitting centered in that visible strip. Centering the text within
    // tabVisibleHeight (not the whole padded box) fixes that at every
    // scale; the extra tuck-behind-the-pill padding is a fixed amount,
    // independent of scale, since it's just hidden depth, not size.
    const tabVisibleHeight = 21.2 * gridScale;
    const tabFontPx = Math.max(7.5, 10.6 * gridScale);
    const tabTextHeight = tabFontPx * 1.15;
    const tabPadSlack = Math.max(1, tabVisibleHeight - tabTextHeight);
    return (
      <div key={key} className="relative">
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-t-md border border-b-0 border-white/15 bg-[#1b2947] tracking-wide text-white/55 whitespace-nowrap"
          style={{
            fontFamily: "var(--font-display)",
            top: -tabVisibleHeight,
            fontSize: tabFontPx,
            paddingLeft: tabPadX,
            paddingRight: tabPadX,
            paddingTop: tabPadSlack * 0.15,
            paddingBottom: tabPadSlack * 0.85 + 10,
          }}
        >
          {timeLabel}
        </div>
        <GameCard
          game={game}
          picked={picks[game.id]}
          onPick={(team) => setPick(game.id, team)}
          tag={tags[game.id]}
          result={results[game.id]}
          locked={!isEditable}
          isLockPick={lockedGameId === game.id}
          hasLock={lockedGameId !== null}
          onToggleLock={() => toggleLock(game.id)}
          scale={gridScale}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-5 pb-2 max-w-4xl w-full mx-auto relative">
        <div className="flex flex-col items-center">
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-full border border-white/15 bg-[#1b2947] p-1">
              {(["picks", "leaderboard"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPageTab(tab)}
                  className={`rounded-full px-5 py-1.5 text-sm capitalize transition-colors ${
                    pageTab === tab ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {pageTab === "picks" ? (
            <div className="text-center">
              <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW &middot; PICK&rsquo;EM</div>
              <span
                className="inline-flex items-center gap-2 text-[clamp(1.75rem,7vw,2.75rem)] leading-none tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                WEEK {activeWeek}
                <WeekSwitcher
                  weeks={weeks}
                  currentWeek={activeWeek}
                  onSelectWeek={setActiveWeek}
                  open={weekSwitcherOpen}
                  onOpenChange={setWeekSwitcherOpen}
                  className="self-center"
                />
              </span>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-xs text-white/45 tracking-[0.25em] mb-1">PICK&rsquo;EM</div>
              <h1 className="text-[clamp(1.75rem,7vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                STANDINGS
              </h1>
              <p className="text-white/50 text-sm mt-2">Ranked by total correct picks across every published week.</p>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-10 max-w-4xl w-full mx-auto">
        {pageTab === "leaderboard" && (
          <div className="max-w-2xl mx-auto w-full">
            <LeaderboardBoard />
          </div>
        )}
        {pageTab === "picks" && loaded && (
          <>
            <WeeklyRecordPill
              seasonCorrect={myRecord?.correct ?? 0}
              seasonGraded={myRecord?.graded ?? 0}
              weeklyCorrect={correctCount}
              weeklyGraded={gradedCount}
              week={activeWeek}
              rank={user && myRank >= 0 ? myRank + 1 : null}
              avatarUrl={profile?.avatar_url}
              initial={(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
              signedIn={!!user}
              onActivate={!user ? () => requestSignIn() : undefined}
              onOpenStandings={() => setPageTab("leaderboard")}
            />
            {/* Explicit track width (not grid-cols-2's 1fr 1fr) - a 1fr
                column doesn't shrink just because the card inside it does,
                it just leaves dead space, which would visually read as a
                far bigger gap between columns than the real gridColumnGap.
                Track width matches GameCard's own scaled width exactly so
                the column hugs the card at any screen size, mobile
                included - this same grid now runs everywhere, there's no
                separate single-column mobile layout anymore. */}
            <div
              className="grid items-stretch justify-center"
              style={{ gridTemplateColumns: `repeat(2, ${PILL_WIDTH * gridScale}px)`, columnGap: gridColumnGap, rowGap: 32 * gridScale }}
            >
              {desktopRows.flatMap((row) => [renderGridGame(row.left, `${row.key}-l`), renderGridGame(row.right, `${row.key}-r`)])}
            </div>

            <div className="mt-5">
              {hasResults ? <ResultsPill correct={correctCount} total={gradedCount} avatarUrl={profile?.avatar_url} /> : <StatPills stats={stats} lockedTeam={lockedTeam} />}
            </div>

            <div className="flex justify-center mt-5">
              <button
                aria-label={hasResults ? "Share your results" : "Share your picks"}
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-2 rounded-full shadow-[0_4px_20px_rgba(74,222,128,0.35)] active:scale-95 transition-transform duration-150 disabled:opacity-60"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  color: "#0e1b33",
                  fontSize: shareBtnFontPx,
                  padding: `${shareBtnPadY}px ${shareBtnPadX}px`,
                }}
              >
                {sharing ? (
                  <>
                    <span
                      className="rounded-full border-2 border-[#0e1b33]/40 border-t-[#0e1b33] animate-spin"
                      style={{ height: shareBtnIconPx, width: shareBtnIconPx }}
                    />
                    SHARING&hellip;
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      style={{ height: shareBtnIconPx, width: shareBtnIconPx }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                    </svg>
                    {hasResults ? "SHARE MY RESULTS 🏈" : "SHARE MY PICKS 🏈"}
                  </>
                )}
              </button>
            </div>

            {isEditable ? (
              <div className="flex flex-col items-center mt-3">
                <div className="flex items-center justify-center gap-3">
                  <button
                    aria-label="Save and submit your picks"
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
                      // Signed in means auto-save has this covered - the
                      // button reads SAVED at rest (not just briefly after a
                      // save) instead of reverting to "Save & Submit" a few
                      // seconds later, which read as "did that not save?"
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
                    aria-label="Reset your picks"
                    onClick={async () => {
                      if (await confirm("Reset all your picks for this week?", "RESET")) {
                        resetPicks();
                        posthog.capture("weekly_picks_reset", { week: activeWeek });
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
            ) : (
              <p className="text-center text-xs text-white/40 mt-5" style={{ fontFamily: "var(--font-display)" }}>
                {hasResults ? "RESULTS ARE IN FOR THIS WEEK" : "THIS WEEK IS CLOSED"}
              </p>
            )}
          </>
        )}
      </main>
      {dialog}
      {signInModal}
      {showSavePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSavePrompt(false)} />
          {/* Same chrome and "why sign up" tile grid as the sign-in modal's
              own referral pitch (useSignInModal.tsx) - this is the same
              sell, just triggered by picks progress instead of a referral
              link. */}
          <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowSavePrompt(false)}
              className="absolute top-4 right-4 h-7 w-7 rounded-full border border-white/15 text-white/50 hover:text-white flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>

            <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
              WANT TO SAVE THESE PICKS?
            </h2>
            <p className="text-white/50 text-sm mt-1 mb-4">You&rsquo;re halfway through Week {activeWeek} &mdash; sign up free to lock them in.</p>

            <div className="flex flex-col items-center gap-1.5 text-center mb-4">
              <span
                className="h-12 w-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
              >
                🏈
              </span>
              <span className="text-xs text-white/70">Create a free profile to keep them</span>

              <div className="grid grid-cols-3 gap-2 w-full mt-2.5">
                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                  <span className="text-base leading-none">💾</span>
                  <span className="text-[10px] font-semibold mt-0.5">SAVE PICKS</span>
                  <span className="text-[8.5px] text-white/40">Any device</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                  <span className="text-base leading-none">🏆</span>
                  <span className="text-[10px] font-semibold mt-0.5">TRACK RECORD</span>
                  <span className="text-[8.5px] text-white/40">Every week</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                  <span className="text-base leading-none">👥</span>
                  <span className="text-[10px] font-semibold mt-0.5">COMPARE</span>
                  <span className="text-[8.5px] text-white/40">With friends</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSavePromptSignUp}
              className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
            >
              SIGN UP FREE
            </button>
            <button
              type="button"
              onClick={() => setShowSavePrompt(false)}
              className="w-full text-center text-xs text-white/45 hover:text-white/70 mt-3 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
