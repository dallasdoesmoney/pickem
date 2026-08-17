"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { fetchLeaderboard, fetchMyLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { fetchWeeks, fetchGameResults, WeekRow } from "@/lib/supabase/admin";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";
import { getLevelInfo } from "@/lib/levels";
import { LevelBadge } from "@/components/LevelBadge";
import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { TEAMS } from "@/data/teams";

// A fixed, curated preview instead of an alphabetical slice - these are
// just recognizable teams to make the strip inviting to click into.
const PREVIEW_TEAMS = [TEAMS.DAL, TEAMS.SF, TEAMS.PIT, TEAMS.NE];

// The app's standard solid card color (same as StatPills/WeeklyRecordPill)
// - the hub's cards used to sit on translucent bg-white/5, which read as
// less substantial than the rest of the app's UI.
const CARD_BG = "#1b2947";

function Avatar({ url, label, size, ring }: { url: string | null | undefined; label: string; size: number; ring?: string }) {
  const dim = { height: size, width: size, fontSize: size * 0.36 };
  const ringStyle: React.CSSProperties = ring ? { boxShadow: `0 0 0 2px ${ring}, 0 0 8px -2px ${ring}` } : {};
  return url ? (
    <img src={url} alt="" style={{ ...dim, ...ringStyle }} className="rounded-full object-cover shrink-0" />
  ) : (
    <span
      style={{ ...dim, ...ringStyle }}
      className={`rounded-full bg-white/10 flex items-center justify-center shrink-0 ${ring ? "" : "border border-white/20"}`}
    >
      {label.charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function StatSegment({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 px-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm leading-none">{icon}</span>
        <span className="text-lg leading-none whitespace-nowrap" style={{ fontFamily: "var(--font-display)", color }}>
          {value}
        </span>
      </div>
      <span className="text-[8px] text-white/50 tracking-wide whitespace-nowrap">{label}</span>
    </div>
  );
}

// Mirrors the real /leaderboard page's row - same avatar ring color, same
// LevelBadge, same "(you)" suffix - so this preview looks like the exact
// thing you land on after clicking "View Full Leaderboard."
function LeaderboardRowCard({ row, position, isMe }: { row: LeaderboardRow; position: number; isMe: boolean }) {
  const label = row.display_name || row.username;
  const rankColor = getLevelInfo(row.total_points).rankColor;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
        isMe ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-[#101f3d]"
      }`}
    >
      <span className="w-5 text-center text-xs text-white/40" style={{ fontFamily: "var(--font-display)" }}>
        {position}
      </span>
      <Avatar url={row.avatar_url} label={label} size={30} ring={rankColor} />
      <span className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-sm truncate">
          {label}
          {isMe && <span className="text-white/40"> (you)</span>}
        </span>
        <LevelBadge totalPoints={row.total_points} />
      </span>
      <span className="text-sm text-white/70 tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {row.correct}-{row.graded - row.correct}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();

  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [myRow, setMyRow] = useState<LeaderboardRow | null | undefined>(undefined);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weeklyRecord, setWeeklyRecord] = useState<{ correct: number; graded: number } | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setMyRow(undefined);
      return;
    }
    fetchMyLeaderboardEntry(user.id)
      .then(setMyRow)
      .catch(() => setMyRow(null));
  }, [user]);

  const activeWeek = useMemo(() => {
    const openWeeks = weeks.filter((w) => w.is_open).map((w) => w.week);
    return openWeeks.length > 0 ? Math.max(...openWeeks) : CURRENT_WEEK;
  }, [weeks]);

  useEffect(() => {
    if (!user) {
      setWeeklyRecord(null);
      return;
    }
    Promise.all([fetchWeeklyPicks(user.id, activeWeek), fetchGameResults(activeWeek)])
      .then(([{ picks }, results]) => {
        const games = GAMES_BY_WEEK[activeWeek] ?? [];
        let correct = 0;
        let graded = 0;
        for (const game of games) {
          const result = results[game.id];
          const pick = picks[game.id];
          if (!result || !pick) continue;
          graded++;
          if (pick === result) correct++;
        }
        setWeeklyRecord({ correct, graded });
      })
      .catch(() => setWeeklyRecord(null));
  }, [user, activeWeek]);

  // Signed-in: room for your own row is reserved below the top 2 if you're
  // not already in it. Signed-out: one extra row of real names instead,
  // since the leaderboard itself is the sign-up pitch here.
  const topCount = user ? 2 : 3;
  const topRows = rows ? rows.slice(0, topCount) : [];
  const myIndex = user && rows ? rows.findIndex((r) => r.user_id === user.id) : -1;
  const showMyRowSeparately = !!user && !!myRow && myIndex >= topCount;

  async function handleSignInCta() {
    setSigningIn(true);
    await requestSignIn();
    setSigningIn(false);
  }

  const label = profile?.display_name || profile?.username || "";
  const seasonRecordValue = user ? (myRow ? `${myRow.correct}-${myRow.graded - myRow.correct}` : "–") : "0-0";
  const weeklyRecordValue = user ? (weeklyRecord ? `${weeklyRecord.correct}-${weeklyRecord.graded - weeklyRecord.correct}` : "–") : "0-0";
  const rankValue = user && myIndex >= 0 ? `#${myIndex + 1}` : "–";

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-lg w-full mx-auto flex flex-col gap-6">
      <div className="text-center">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW</div>
        <h1 className="text-[clamp(2rem,8vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK&rsquo;EM
        </h1>
      </div>

      <div className="rounded-3xl border border-white/10 overflow-hidden" style={{ background: CARD_BG }}>
        <div className="p-5 flex flex-col gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Avatar url={profile?.avatar_url} label={label} size={52} />
              <div className="min-w-0">
                <div className="text-base font-medium truncate">{label}</div>
                {myRow ? <LevelBadge totalPoints={myRow.total_points} /> : <span className="text-xs text-white/40">Loading&hellip;</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="h-[52px] w-[52px] rounded-full bg-white/5 border border-dashed border-white/25 flex items-center justify-center text-lg text-white/40 shrink-0">
                ?
              </span>
              <div className="min-w-0">
                <div className="text-base font-medium text-white/70">Your Profile</div>
                <button
                  type="button"
                  onClick={handleSignInCta}
                  disabled={signingIn}
                  className="text-xs text-amber-300/90 hover:text-amber-300 transition-colors mt-0.5 disabled:opacity-60"
                >
                  {signingIn ? "Signing in…" : "Sign up to save it →"}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-stretch rounded-full border border-white/15 bg-[#141f3a] px-2 py-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]">
            <StatSegment icon="🏆" value={seasonRecordValue} label="SEASON RECORD" color="#c084fc" />
            <div className="w-px self-stretch bg-white/10 mx-2" />
            <StatSegment icon="🏈" value={weeklyRecordValue} label={`WEEK ${activeWeek}`} color="#4ade80" />
            <div className="w-px self-stretch bg-white/10 mx-2" />
            <StatSegment icon="🌟" value={rankValue} label="GLOBAL RANK" color="#f59e0b" />
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs tracking-[0.15em] text-white/50" style={{ fontFamily: "var(--font-display)" }}>
                SEASON LEADERBOARD
              </h2>
              <span className="text-[10px] text-white/35 tracking-wide">ALL PLAYERS</span>
            </div>

            {!rows ? (
              <div className="flex justify-center py-4">
                <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-xs text-white/45 text-center py-4">No one&rsquo;s on the board yet &mdash; be the first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topRows.map((row, i) => (
                  <LeaderboardRowCard key={row.user_id} row={row} position={i + 1} isMe={row.user_id === user?.id} />
                ))}
                {showMyRowSeparately && myRow && <LeaderboardRowCard row={myRow} position={myIndex + 1} isMe />}
                {!user && (
                  <button
                    type="button"
                    onClick={handleSignInCta}
                    disabled={signingIn}
                    className="flex items-center gap-2.5 rounded-xl border border-dashed border-amber-300/30 px-3 py-2.5 text-left text-amber-300/90 hover:text-amber-300 hover:border-amber-300/50 transition-colors disabled:opacity-60"
                  >
                    <span className="w-5 text-center text-base leading-none">+</span>
                    <span className="text-sm">{signingIn ? "Signing in…" : "Sign up to claim your spot"}</span>
                  </button>
                )}
              </div>
            )}

            <Link href="/leaderboard" className="block text-center text-xs text-sky-300/80 hover:text-sky-300 transition-colors mt-3">
              View Full Leaderboard &rarr;
            </Link>
          </div>
        </div>

        <Link
          href="/weekly"
          className="block text-center py-3.5 font-semibold text-sm bg-emerald-400 text-[#06301a] hover:bg-emerald-300 transition-colors"
        >
          Make Week {activeWeek} Picks &rarr;
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 p-5" style={{ background: CARD_BG }}>
        <h2 className="text-xs tracking-[0.15em] text-white/50 mb-4" style={{ fontFamily: "var(--font-display)" }}>
          TEAM PICK&rsquo;EM
        </h2>
        <div className="flex items-center justify-center gap-4 mb-4">
          {PREVIEW_TEAMS.map((team) => (
            <Link
              key={team.abbr}
              href={`/predictor/${team.abbr.toLowerCase()}`}
              className="shrink-0 flex flex-col items-center gap-1.5"
              title={`${team.city} ${team.name}`}
            >
              <span
                className="h-[72px] w-[72px] rounded-full flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors"
                style={{ background: team.color }}
              >
                <img
                  src={team.logo}
                  alt={team.name}
                  crossOrigin="anonymous"
                  className="h-11 w-11 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                />
              </span>
            </Link>
          ))}
        </div>
        <Link
          href="/predictor"
          className="block text-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors py-3 text-xs text-white/70"
          style={{ fontFamily: "var(--font-display)" }}
        >
          View All 32 Teams &rarr;
        </Link>
      </div>

      {signInModal}
    </main>
  );
}
