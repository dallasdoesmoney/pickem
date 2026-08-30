"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TEAMS, TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { GAMES_BY_WEEK } from "@/data/games";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import {
  fetchPredictorProgress,
  syncPredictorAchievements,
  fetchWeeklyPickemProgress,
  syncWeeklyPickemAchievements,
  fetchLockBonusCount,
  fetchLockAttemptCount,
  fetchPointSourceCount,
  syncLockBonus,
  syncCorrectPicks,
  syncPredictorAccuracy,
} from "@/lib/supabase/achievements";
import { fetchCheckInStats, CheckInStats } from "@/lib/supabase/checkIn";
import { fetchReferralCount } from "@/lib/supabase/referrals";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/errorMessage";
import { AchievementCard } from "@/components/AchievementCard";
import { LevelLadder } from "@/components/LevelLadder";
import { InviteFriendsCard } from "@/components/InviteFriendsCard";
import { JoinDiscordCard } from "@/components/JoinDiscordCard";

const ALL_WEEKS = Object.keys(GAMES_BY_WEEK)
  .map(Number)
  .sort((a, b) => a - b);

type Tab = "levels" | "achievements";

// How often a challenge comes round. This is the axis people actually
// sort by when asking "what can I do right now" - not how much it pays,
// and not how far through it they are.
type Group = "daily" | "weekly" | "anytime";

const GROUPS: { key: Group; title: string; blurb: string }[] = [
  { key: "daily", title: "EVERY DAY", blurb: "resets at midnight ET" },
  { key: "weekly", title: "EVERY WEEK", blurb: "while the season runs" },
  { key: "anytime", title: "ANY TIME", blurb: "no deadline" },
];

// The "my own profile" version of the level ladder - unlike
// LevelListModal (used for viewing someone else's ladder), this one adds
// a toggle to switch to achievements without closing and reopening a
// different popup, since the two are directly related: achievements are
// where the points behind your level actually come from.
export function LevelsAchievementsModal({
  open,
  initialTab = "levels",
  totalPoints,
  onClose,
}: {
  open: boolean;
  initialTab?: Tab;
  totalPoints?: number;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [predictorProgress, setPredictorProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<Partial<Record<number, number>> | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [lockBonusCount, setLockBonusCount] = useState<number | null>(null);
  const [lockAttemptCount, setLockAttemptCount] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState<CheckInStats | null>(null);
  // Rewards for being right, shown inside the card for the thing you were
  // right about rather than as cards of their own.
  const [correctPicks, setCorrectPicks] = useState<number | null>(null);
  const [perfectWeeks, setPerfectWeeks] = useState<number | null>(null);
  const [predictorCorrect, setPredictorCorrect] = useState<number | null>(null);
  const [discordClaimed, setDiscordClaimed] = useState<boolean | null>(null);
  const [puzzlesSolved, setPuzzlesSolved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Which tab it opens on, settled during render. As an effect this
  // committed one frame on the previous tab before switching, so opening
  // Challenges from a link flashed Levels first.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(initialTab);
  }

  // Both tabs share one scroll container, and the Levels tab scrolls it:
  // LevelLadder centres your current rank on mount. Switching to
  // Challenges inherited that offset, and because the challenge list is
  // shorter it clamped to a small one - which looked like the list
  // opening slightly scrolled, with the EVERY DAY heading cut off above.
  //
  // Only on the way IN to Challenges. Resetting on every tab change would
  // fight the ladder: child effects run before the parent's, so a reset
  // here would land after LevelLadder's scrollIntoView and undo it.
  useEffect(() => {
    if (open && tab === "achievements") scrollRef.current?.scrollTo({ top: 0 });
  }, [open, tab]);

  // Everything below is fetched for one account, on one opening. Blanking
  // it DURING RENDER rather than from inside the effect is the difference
  // between a reopen showing empty tiles and a reopen showing the numbers
  // it had last time for a frame - which, if you signed into a different
  // account in between, were somebody else's.
  const loadFor = open && user ? user.id : null;
  const [loadedFor, setLoadedFor] = useState(loadFor);
  if (loadFor !== loadedFor) {
    setLoadedFor(loadFor);
    setPredictorProgress(null);
    setWeeklyProgress(null);
    setReferralCount(null);
    setLockBonusCount(null);
    setLockAttemptCount(null);
    setCheckIn(null);
    setCorrectPicks(null);
    setPerfectWeeks(null);
    setPredictorCorrect(null);
    setDiscordClaimed(null);
    setPuzzlesSolved(null);
    setError(null);
  }

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      syncPredictorAchievements().catch((err) => console.error("Achievement sync failed", err)),
      syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err)),
      syncLockBonus().catch((err) => console.error("Achievement sync failed", err)),
      syncCorrectPicks().catch((err) => console.error("Achievement sync failed", err)),
      syncPredictorAccuracy().catch((err) => console.error("Achievement sync failed", err)),
    ]).finally(() => {
      fetchPredictorProgress(user.id)
        .then(setPredictorProgress)
        .catch((err) => setError(errorMessage(err)));
      fetchWeeklyPickemProgress(user.id)
        .then(setWeeklyProgress)
        .catch((err) => setError(errorMessage(err)));
      fetchWeeks()
        .then(setWeeks)
        .catch(() => {});
      fetchReferralCount(user.id)
        .then(setReferralCount)
        .catch((err) => setError(errorMessage(err)));
      fetchLockBonusCount(user.id)
        .then(setLockBonusCount)
        .catch((err) => setError(errorMessage(err)));
      fetchLockAttemptCount(user.id)
        .then(setLockAttemptCount)
        .catch((err) => setError(errorMessage(err)));
      // No sync_ call to pair with this one: today's check-in was
      // already claimed by NotificationToasts on page load, so this only
      // ever reads. Reading it fresh rather than off the cached auth
      // profile matters for exactly that reason - the profile in context
      // was fetched before today's check-in wrote to it.
      fetchCheckInStats(user.id)
        .then(setCheckIn)
        .catch((err) => setError(errorMessage(err)));
      fetchPointSourceCount(user.id, "correct_pick")
        .then(setCorrectPicks)
        .catch((err) => setError(errorMessage(err)));
      fetchPointSourceCount(user.id, "perfect_week")
        .then(setPerfectWeeks)
        .catch((err) => setError(errorMessage(err)));
      fetchPointSourceCount(user.id, "predictor_correct")
        .then(setPredictorCorrect)
        .catch((err) => setError(errorMessage(err)));
      fetchPointSourceCount(user.id, "discord_join")
        .then((n) => setDiscordClaimed(n > 0))
        .catch((err) => setError(errorMessage(err)));
      fetchPointSourceCount(user.id, "daily_puzzle")
        .then(setPuzzlesSolved)
        .catch((err) => setError(errorMessage(err)));
    });
  }, [open, user]);

  if (!open) return null;

  const predictorDef = ACHIEVEMENTS.find((a) => a.key === "predictor_team_complete")!;
  const weeklyDef = ACHIEVEMENTS.find((a) => a.key === "weekly_pickem_complete")!;
  const referralDef = ACHIEVEMENTS.find((a) => a.key === "referral")!;
  const lockDef = ACHIEVEMENTS.find((a) => a.key === "lock_correct")!;
  const checkInDef = ACHIEVEMENTS.find((a) => a.key === "daily_check_in")!;
  const correctPickDef = ACHIEVEMENTS.find((a) => a.key === "correct_pick")!;
  const perfectWeekDef = ACHIEVEMENTS.find((a) => a.key === "perfect_week")!;
  const predictorCorrectDef = ACHIEVEMENTS.find((a) => a.key === "predictor_correct")!;
  const discordDef = ACHIEVEMENTS.find((a) => a.key === "discord_join")!;
  const puzzleDef = ACHIEVEMENTS.find((a) => a.key === "daily_puzzle")!;

  const completedTeams = predictorProgress
    ? TEAMS_SORTED.filter((t) => (predictorProgress[t.abbr] ?? 0) >= (REQUIRED_PREDICTOR_WEEKS[t.abbr] ?? Infinity))
    : [];

  const completedWeeks = weeklyProgress ? ALL_WEEKS.filter((w) => (weeklyProgress[w] ?? 0) >= GAMES_BY_WEEK[w].length) : [];
  const weeksById = new Map(weeks.map((w) => [w.week, w]));

  const achievementsLoaded =
    predictorProgress !== null &&
    weeklyProgress !== null &&
    referralCount !== null &&
    lockBonusCount !== null &&
    lockAttemptCount !== null &&
    checkIn !== null &&
    correctPicks !== null &&
    perfectWeeks !== null &&
    predictorCorrect !== null &&
    discordClaimed !== null &&
    puzzlesSolved !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            {tab === "levels" ? "ALL LEVELS" : "CHALLENGES"}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-4 shrink-0">
          <div className="inline-flex w-full rounded-full border border-white/10 bg-white/5 p-1">
            {(["levels", "achievements"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-1.5 text-sm transition-colors ${
                  tab === t ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t === "levels" ? "Levels" : "Challenges"}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-y-auto px-5 pb-5 flex flex-col gap-4">
          {tab === "levels" ? (
            <LevelLadder totalPoints={totalPoints} />
          ) : (
            <>
              {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}
              {!achievementsLoaded ? (
                <div className="flex justify-center py-10">
                  <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Grouped by how often you can do it, daily first.
                      Ungrouped, this was one run of six cards where the
                      thing you can do again in an hour sat next to the
                      thing that resolves in April, and the only way to
                      tell them apart was to read all six.

                      Within a group, fully completed cards (done >=
                      total) sink to the bottom, dimmed - the same
                      comparison AchievementCard itself uses to decide
                      dimming, so the two never disagree. Referral and
                      lock bonus are uncapped (never "complete" in this
                      sense) and always sort as if incomplete. */}
                  {(() => {
                    const items = [
                      {
                        // Top of the list: it is the only challenge here
                        // that is a game rather than a record of
                        // something, so it is the one worth landing on.
                        key: "daily-game",
                        group: "daily" as Group,
                        complete: false,
                        node: (
                          <AchievementCard
                            key="daily-game"
                            icon={puzzleDef.icon}
                            label={puzzleDef.label}
                            description={puzzleDef.description}
                            pointsEach={puzzleDef.pointsEach}
                            pointsLabel="PTS FOR A PERFECT SOLVE"
                            unitLabel={puzzleDef.unitLabel}
                            doneCount={puzzlesSolved!}
                          >
                            <div className="flex flex-col gap-2 mt-1">
                              <p className="text-xs text-white/50">
                                A new player every day, the same one for everyone. Eight guesses, and each one is worth less than
                                the last &mdash; 300 down to 125.
                              </p>
                              <Link
                                href="/daily"
                                onClick={onClose}
                                className="rounded-full px-4 py-2 text-xs text-center active:scale-95 transition-transform duration-150"
                                style={{
                                  fontFamily: "var(--font-display)",
                                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                                  color: "#0e1b33",
                                }}
                              >
                                PLAY TODAY&apos;S
                              </Link>
                            </div>
                          </AchievementCard>
                        ),
                      },
                      {
                        // Second because it is the only one that is
                        // already done by the time you read it - it
                        // exists to be noticed, not to be worked at.
                        key: "check-in",
                        group: "daily" as Group,
                        complete: false,
                        node: (
                          <AchievementCard
                            key="check-in"
                            icon={checkInDef.icon}
                            label={checkInDef.label}
                            description={checkInDef.description}
                            pointsEach={checkInDef.pointsEach}
                            pointsLabel="PTS PER DAY"
                            unitLabel={checkInDef.unitLabel}
                            doneCount={checkIn!.total}
                            note={
                              checkIn!.checkedInToday ? (
                                <span className="text-emerald-400">Checked in today</span>
                              ) : (
                                <span className="text-white/40">Checking you in…</span>
                              )
                            }
                          >
                            <div className="grid grid-cols-7 gap-1.5 mt-1">
                              {/* Oldest on the left, so the week reads
                                  the way a week reads. */}
                              {[...checkIn!.recentDays].reverse().map((day, i, all) => {
                                const isToday = i === all.length - 1;
                                return (
                                  <div
                                    key={day.date}
                                    title={day.date}
                                    className={`flex flex-col items-center gap-1 rounded-lg border py-1.5 ${
                                      day.checked
                                        ? "border-emerald-400 bg-emerald-400/10"
                                        : isToday
                                          ? "border-white/25 bg-white/5"
                                          : "border-white/10 bg-white/[0.02]"
                                    }`}
                                  >
                                    <span className={`text-[9px] ${day.checked ? "text-emerald-300" : "text-white/40"}`}>
                                      {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" })}
                                    </span>
                                    <span className={`text-[11px] leading-none ${day.checked ? "text-emerald-400" : "text-white/20"}`}>
                                      {day.checked ? "✓" : "·"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-white/50 mt-2">
                              {checkIn!.streak > 1
                                ? `${checkIn!.streak} days in a row.`
                                : "Come back tomorrow to start a streak."}
                              {checkIn!.longest > checkIn!.streak && (
                                <span className="text-white/35"> Best so far: {checkIn!.longest} days.</span>
                              )}
                            </p>
                          </AchievementCard>
                        ),
                      },
                      {
                        // Capped at one, so once it is claimed the
                        // existing sort dims it and drops it to the
                        // bottom - which is right: it is the only
                        // challenge here you can genuinely finish.
                        key: "discord",
                        group: "anytime" as Group,
                        complete: discordClaimed!,
                        node: (
                          <JoinDiscordCard
                            key="discord"
                            def={discordDef}
                            claimed={discordClaimed!}
                            onClaimed={() => setDiscordClaimed(true)}
                          />
                        ),
                      },
                      {
                        key: "referral",
                        group: "anytime" as Group,
                        complete: false,
                        node: <InviteFriendsCard key="referral" def={referralDef} username={profile?.username ?? null} referralCount={referralCount!} />,
                      },
                      {
                        key: "weekly",
                        group: "weekly" as Group,
                        complete: ALL_WEEKS.length > 0 && completedWeeks.length >= ALL_WEEKS.length,
                        node: (
                          <AchievementCard
                            key="weekly"
                            icon={weeklyDef.icon}
                            label={weeklyDef.label}
                            description={weeklyDef.description}
                            pointsEach={weeklyDef.pointsEach}
                            unitLabel={weeklyDef.unitLabel}
                            doneCount={completedWeeks.length}
                            totalCount={ALL_WEEKS.length}
                          >
                            {/* Filling the card in is only half of it -
                                these are what being RIGHT pays, and they
                                sit here rather than in cards of their own
                                because they are the same activity. */}
                            <div className="flex gap-2 mt-1 mb-2">
                              <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                                <div className="text-[10px] text-white/40">{correctPickDef.label}</div>
                                <div className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                                  {correctPicks!} <span className="text-emerald-400 text-xs">&times;{correctPickDef.pointsEach}</span>
                                </div>
                              </div>
                              <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                                <div className="text-[10px] text-white/40">{perfectWeekDef.label}</div>
                                <div className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                                  {perfectWeeks!}{" "}
                                  <span className="text-emerald-400 text-xs">&times;{perfectWeekDef.pointsEach.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {ALL_WEEKS.map((week) => {
                                const required = GAMES_BY_WEEK[week].length;
                                const picked = weeklyProgress![week] ?? 0;
                                const done = picked >= required;
                                const weekRow = weeksById.get(week);
                                const available = weekRow ? weekRow.is_open || weekRow.results_published : false;

                                const cell = (
                                  <>
                                    <span className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                                      WEEK {week}
                                    </span>
                                    <span className="text-[10px] text-white/40 mt-0.5">
                                      {done ? "Complete" : available ? `${picked}/${required}` : "Locked"}
                                    </span>
                                  </>
                                );

                                return available ? (
                                  <Link
                                    key={week}
                                    href="/weekly"
                                    onClick={onClose}
                                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 transition-colors ${
                                      done ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:border-white/25"
                                    }`}
                                  >
                                    {cell}
                                  </Link>
                                ) : (
                                  <span key={week} className="flex flex-col items-center gap-0.5 rounded-xl border border-white/5 bg-white/[0.02] px-1 py-2.5 opacity-40">
                                    {cell}
                                  </span>
                                );
                              })}
                            </div>
                          </AchievementCard>
                        ),
                      },
                      {
                        key: "lock",
                        group: "weekly" as Group,
                        complete: false,
                        node: (
                          <AchievementCard
                            key="lock"
                            icon={lockDef.icon}
                            label={lockDef.label}
                            description={lockDef.description}
                            pointsEach={lockDef.pointsEach}
                            pointsLabel="PTS PER CORRECT LOCK"
                            unitLabel={lockDef.unitLabel}
                            doneCount={lockBonusCount!}
                            totalCount={lockAttemptCount!}
                            neverComplete
                          >
                            <p className="text-xs text-white/50 mt-1">
                              Tap the lock icon on one of your Weekly Pick&rsquo;em picks to mark it as your Lock of the Week. Get it right and you&rsquo;ll earn a bonus once results are published.
                            </p>
                          </AchievementCard>
                        ),
                      },
                      {
                        key: "predictor",
                        group: "anytime" as Group,
                        complete: completedTeams.length >= TEAMS_SORTED.length,
                        node: (
                          <AchievementCard
                            key="predictor"
                            icon={predictorDef.icon}
                            label={predictorDef.label}
                            description={predictorDef.description}
                            pointsEach={predictorDef.pointsEach}
                            headlineValue={predictorDef.pointsEach * TEAMS_SORTED.length}
                            unitLabel={predictorDef.unitLabel}
                            doneCount={completedTeams.length}
                            totalCount={TEAMS_SORTED.length}
                          >
                            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 mt-1 mb-2">
                              <div className="text-[10px] text-white/40">{predictorCorrectDef.label}</div>
                              <div className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                                {predictorCorrect!} <span className="text-emerald-400 text-xs">&times;{predictorCorrectDef.pointsEach}</span>
                              </div>
                              <p className="text-[10px] text-white/35 mt-0.5">
                                Filling a team in pays {predictorDef.pointsEach}. Calling its games right pays{" "}
                                {predictorCorrectDef.pointsEach} apiece, as results are published each week.
                              </p>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-1">
                              {TEAMS_SORTED.map((team) => {
                                const done = completedTeams.some((t) => t.abbr === team.abbr);
                                const filled = predictorProgress![team.abbr] ?? 0;
                                const required = REQUIRED_PREDICTOR_WEEKS[team.abbr] ?? 0;
                                return (
                                  <Link
                                    key={team.abbr}
                                    href={`/predictor/${team.abbr}`}
                                    onClick={onClose}
                                    title={done ? `${team.city} ${team.name} — complete` : `${team.city} ${team.name} — ${filled}/${required}`}
                                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${
                                      done ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:border-white/25"
                                    }`}
                                  >
                                    <img src={TEAMS[team.abbr].logo} alt="" className={`h-6 w-6 object-contain ${done ? "" : "opacity-40"}`} />
                                    <span className={`text-[9px] ${done ? "text-emerald-300" : "text-white/40"}`}>{team.abbr}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </AchievementCard>
                        ),
                      },
                    ] as { key: string; group: Group; complete: boolean; node: React.ReactNode }[];
                    return GROUPS.map((g) => {
                      const inGroup = items
                        .filter((item) => item.group === g.key)
                        .sort((a, b) => Number(a.complete) - Number(b.complete));
                      if (!inGroup.length) return null;
                      return (
                        <div key={g.key} className="flex flex-col gap-3">
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-xs text-white/45" style={{ fontFamily: "var(--font-display)" }}>
                              {g.title}
                            </h3>
                            <span className="text-[10px] text-white/25">{g.blurb}</span>
                          </div>
                          {inGroup.map((item) => item.node)}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
