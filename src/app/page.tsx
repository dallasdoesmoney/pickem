"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboard, fetchMyLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { fetchWeeks, fetchGameResults, WeekRow } from "@/lib/supabase/admin";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";
import { getLevelInfo } from "@/lib/levels";
import { LevelBadge } from "@/components/LevelBadge";
import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { TEAMS_SORTED } from "@/data/teams";

// Three skewed rows of real teams for the marquee - not all 32 (this is a
// preview, not the picker), just enough to read as "packed full."
const MARQUEE_TEAMS = TEAMS_SORTED.slice(0, 24);
const MARQUEE_ROWS = [MARQUEE_TEAMS.slice(0, 8), MARQUEE_TEAMS.slice(8, 16), MARQUEE_TEAMS.slice(16, 24)];

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function WeeklyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function TeamIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M8 14l2.5 2.5L16 11" />
    </svg>
  );
}

function Avatar({ url, label, size }: { url: string | null | undefined; label: string; size: number }) {
  const dim = { height: size, width: size, fontSize: size * 0.4 };
  return url ? (
    <img src={url} alt="" style={dim} className="rounded-full object-cover shrink-0" />
  ) : (
    <span style={dim} className="rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
      {label.charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function StatSegment({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 text-center relative px-1 min-w-0">
      <div className="text-[13px] leading-tight whitespace-nowrap" style={{ fontFamily: "var(--font-display)", color }}>
        {value}
      </div>
      <div className="text-[6.5px] text-white/40 tracking-wide whitespace-nowrap">{label}</div>
    </div>
  );
}

function MiniLeaderboardRow({ row, position, isMe }: { row: LeaderboardRow; position: number; isMe: boolean }) {
  const label = row.display_name || row.username;
  return (
    <div className={`flex items-center gap-[7px] py-[3.5px] text-[10px] ${isMe ? "text-emerald-400" : ""}`}>
      <span className="w-3 text-white/35" style={{ fontFamily: "var(--font-display)" }}>
        {position}
      </span>
      <Avatar url={row.avatar_url} label={label} size={17} />
      <span className="flex-1 min-w-0 flex items-center gap-1">
        <span className="truncate">{isMe ? "You" : label}</span>
        <LevelBadge totalPoints={row.total_points} size="xs" />
      </span>
      <span className={isMe ? "text-emerald-400" : "text-white/55"} style={{ fontFamily: "var(--font-display)" }}>
        {row.correct}-{row.graded - row.correct}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { user, profile } = useAuth();

  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [myRow, setMyRow] = useState<LeaderboardRow | null | undefined>(undefined);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weeklyRecord, setWeeklyRecord] = useState<{ correct: number; graded: number } | null>(null);

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

  // Signed in: top 3 plus your own row pinned below if you're not already
  // in it. Signed out: one extra row of real names instead, since there's
  // no personal row to show.
  const topCount = user ? 3 : 4;
  const topRows = rows ? rows.slice(0, topCount) : [];
  const myIndex = user && rows ? rows.findIndex((r) => r.user_id === user.id) : -1;
  const showMyRowSeparately = !!user && !!myRow && myIndex >= topCount;

  const label = profile?.display_name || profile?.username || "";
  const seasonRecordValue = user ? (myRow ? `${myRow.correct}-${myRow.graded - myRow.correct}` : "–") : "0-0";
  const weeklyRecordValue = user ? (weeklyRecord ? `${weeklyRecord.correct}-${weeklyRecord.graded - weeklyRecord.correct}` : "–") : "0-0";
  const rankValue = user && myIndex >= 0 ? `#${myIndex + 1}` : "–";
  const rankInfo = myRow ? getLevelInfo(myRow.total_points) : null;

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-lg w-full mx-auto flex flex-col gap-6">
      <div className="text-center">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW</div>
        <h1 className="text-[clamp(2rem,8vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK&rsquo;EM
        </h1>
      </div>

      <Link
        href="/weekly"
        className="group relative flex flex-col gap-3 rounded-[22px] border border-white/10 bg-[#1b2947] hover:bg-[#212f52] transition-colors p-4"
      >
        <ChevronIcon className="absolute top-[18px] right-4 h-[18px] w-[18px] text-white/35 group-hover:text-white/55 transition-colors" />
        <div className="flex items-center gap-2.5 pr-6">
          <span className="h-[38px] w-[38px] shrink-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
            <WeeklyIcon className="h-[19px] w-[19px]" style={{ color: "#4ade80" }} />
          </span>
          <div>
            <div className="text-[17px]" style={{ fontFamily: "var(--font-display)" }}>
              Weekly Pick&rsquo;em
            </div>
            <div className="text-[10.5px] text-white/55 mt-0.5">Make your Week {activeWeek} picks</div>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-2.5">
            <Avatar url={profile?.avatar_url} label={label} size={34} />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{label}</div>
              {rankInfo ? (
                <div className="text-[9.5px] text-amber-400 truncate">
                  {rankInfo.rankEmoji} {rankInfo.rankName} &middot; Lvl {rankInfo.level}
                </div>
              ) : (
                <div className="text-[9.5px] text-white/40">Loading&hellip;</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="h-[34px] w-[34px] shrink-0 rounded-full border border-dashed border-white/25 bg-white/5 flex items-center justify-center text-[11px] text-white/40">
              ?
            </span>
            <div className="text-xs font-bold text-white/70">Your Profile</div>
          </div>
        )}

        <div className="flex rounded-full border border-white/10 bg-[#16233f] p-[7px]">
          <StatSegment value={seasonRecordValue} label="SEASON" color="#c084fc" />
          <div className="w-px self-stretch bg-white/10" />
          <StatSegment value={weeklyRecordValue} label={`WEEK ${activeWeek}`} color="#4ade80" />
          <div className="w-px self-stretch bg-white/10" />
          <StatSegment value={rankValue} label="RANK" color="#f59e0b" />
        </div>

        <div>
          <div className="text-[8.5px] tracking-[0.12em] text-white/35 mb-0.5">SEASON LEADERBOARD PREVIEW</div>
          {!rows ? (
            <div className="flex justify-center py-3">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : (
            <>
              {topRows.map((row, i) => (
                <MiniLeaderboardRow key={row.user_id} row={row} position={i + 1} isMe={row.user_id === user?.id} />
              ))}
              {showMyRowSeparately && myRow && <MiniLeaderboardRow row={myRow} position={myIndex + 1} isMe />}
            </>
          )}
        </div>
      </Link>

      <Link
        href="/predictor"
        className="group relative flex flex-col gap-3 rounded-[22px] border border-white/10 bg-[#1b2947] hover:bg-[#212f52] transition-colors p-4"
      >
        <ChevronIcon className="absolute top-[18px] right-4 h-[18px] w-[18px] text-white/35 group-hover:text-white/55 transition-colors" />
        <div className="flex items-center gap-2.5 pr-6">
          <span className="h-[38px] w-[38px] shrink-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(56,189,248,0.15)" }}>
            <TeamIcon className="h-[19px] w-[19px]" style={{ color: "#38bdf8" }} />
          </span>
          <div>
            <div className="text-[17px]" style={{ fontFamily: "var(--font-display)" }}>
              Team Pick&rsquo;em
            </div>
            <div className="text-[10.5px] text-white/55 mt-0.5">Predict a team&rsquo;s 2026 season</div>
          </div>
        </div>

        <div className="relative h-[140px] overflow-hidden rounded-xl bg-[#16233f]">
          {MARQUEE_ROWS.map((teams, i) => (
            <div key={i} className="absolute -left-5 -right-5 flex gap-2" style={{ top: 8 + i * 48, transform: "skewY(-6deg)" }}>
              {teams.map((team) => (
                <span
                  key={team.abbr}
                  className="h-10 w-10 shrink-0 rounded-[10px] flex items-center justify-center overflow-hidden"
                  style={{ background: team.color }}
                >
                  <img src={team.logo} alt="" crossOrigin="anonymous" className="h-6 w-6 object-contain" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="text-center text-[10px] text-white/55 tracking-wide">
          <span className="text-white font-semibold">32 teams</span> &middot; pick one, predict the season
        </div>
      </Link>
    </main>
  );
}
