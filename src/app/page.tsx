"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";
import { fetchPredictorProgress } from "@/lib/supabase/achievements";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { getTierTemplate } from "@/data/tierTemplates";
import { BoardThumb, previewFor } from "@/components/tierList/BoardThumb";
import { useAuth } from "@/hooks/useAuth";

// Every card fronts a destination with a live picture of what is behind
// it - the week's actual matchups, your actual predictor progress, the
// actual top of the leaderboard. A card that draws itself from real data
// is a reason to tap; a static icon is not. Each preview therefore has a
// signed-out shape too, since the home page is the first thing a stranger
// sees.

const CARD =
  "group flex flex-col rounded-2xl border border-white/15 bg-[#101d38] overflow-hidden transition-colors hover:border-white/40";
// flex-1 so the three preview cards in a row all put their caption on the
// same line: the previews are naturally different heights (a 5-row tier
// board is twice a progress bar), and without this the shorter cards
// stretch to match and leave their caption stranded mid-card.
const ART = "flex flex-1 items-center bg-[#050a15] p-2.5";

function Name({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[15px] leading-tight ${className}`} style={{ fontFamily: "var(--font-display)" }}>
      {children}
    </div>
  );
}

function Meta({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.09em] text-white/45">
      {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- weekly

// A matchup at thumbnail scale: the two team colors butted together with
// the abbreviations, and a white ring on whichever half you picked. Not
// TeamHalfPill - that one is a fixed 80px interactive control built for
// the picks page, and shrinking it to fit here would drag its logo,
// footer and outcome layers along for no benefit at 26px tall.
function MatchupThumb({ game, picked }: { game: Game; picked?: TeamAbbr }) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  return (
    <div className="mb-[5px] flex h-[26px] overflow-hidden rounded-md last:mb-0">
      {[
        { team: away, side: "left" as const },
        { team: home, side: "right" as const },
      ].map(({ team, side }) => (
        <span
          key={team.abbr}
          className={`flex h-full flex-1 items-center px-[7px] text-[9px] font-bold tracking-[0.06em] text-white ${
            side === "right" ? "justify-end" : ""
          }`}
          style={{
            background: team.color,
            boxShadow: picked === team.abbr ? "inset 0 0 0 2px rgba(255,255,255,0.85)" : undefined,
          }}
        >
          {team.abbr}
        </span>
      ))}
    </div>
  );
}

function WeeklyHero({
  week,
  games,
  picks,
  signedIn,
}: {
  week: number;
  games: Game[];
  picks: Record<string, TeamAbbr> | null;
  signedIn: boolean;
}) {
  const madeCount = picks ? games.filter((g) => picks[g.id]).length : 0;
  const left = games.length - madeCount;

  const line = !signedIn
    ? `Pick a winner in every Week ${week} game and climb the leaderboard.`
    : left === 0 && games.length > 0
      ? `All ${games.length} picks are in for Week ${week}. Change them any time before kickoff.`
      : `Pick a winner in every Week ${week} game and climb the leaderboard. ${left} ${left === 1 ? "game" : "games"} still open.`;

  return (
    <Link href="/weekly" className={`${CARD} lg:flex-row lg:items-stretch`}>
      <div className={`${ART} lg:w-[46%]`}>
        <div className="w-full">
          {games.slice(0, 4).map((game) => (
            <MatchupThumb key={game.id} game={game} picked={picks?.[game.id]} />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center px-5 py-5">
        <Meta color="#4ade80">{madeCount > 0 ? `${madeCount} OF ${games.length} PICKED` : "LIVE NOW"}</Meta>
        <Name className="mt-2 text-[22px] lg:text-[26px]">WEEKLY PICK&rsquo;EM</Name>
        <p className="mt-2 max-w-[46ch] text-[13px] leading-snug text-white/45">{line}</p>
        <div className="mt-4">
          {/* Not a button: the whole card is the link, and nesting a second
              interactive element inside it would be invalid and would give
              keyboard users two stops for one destination. */}
          <span
            className="inline-block rounded-full px-4 py-[9px] text-[11px] tracking-[0.1em] transition-transform duration-200 group-hover:scale-[1.03]"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {madeCount > 0 ? "REVIEW PICKS" : "MAKE PICKS"}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------- predictor

function PredictorCard({ progress }: { progress: Partial<Record<TeamAbbr, number>> | null }) {
  // The team you have put the most work into is the one worth showing
  // back to you; with nothing started, the card advertises the choice
  // instead by fanning out a handful of marks.
  const best = useMemo(() => {
    if (!progress) return null;
    const entries = Object.entries(progress) as [TeamAbbr, number][];
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [progress]);

  const team = best ? TEAMS[best[0]] : null;
  const filled = best?.[1] ?? 0;
  const required = best ? (REQUIRED_PREDICTOR_WEEKS[best[0]] ?? 0) : 0;

  return (
    <Link href="/predictor" className={CARD}>
      <div className={ART}>
        <div className="w-full">
        {team && required > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px]" style={{ background: team.color }}>
                <img src={team.logo} alt="" crossOrigin="anonymous" className="h-6 w-6 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[19px] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {filled}/{required}
                </div>
                <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-[#38bdf8]" style={{ width: `${Math.round((filled / required) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: required }, (_, i) => (
                <span
                  key={i}
                  className="h-3 flex-1 rounded-[2px]"
                  style={{ background: i < filled ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.09)" }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {Object.values(TEAMS)
              .slice(0, 18)
              .map((t) => (
                <span key={t.abbr} className="grid aspect-square place-items-center rounded-[5px]" style={{ background: t.color }}>
                  <img src={t.logo} alt="" loading="lazy" crossOrigin="anonymous" className="h-[70%] w-[70%] object-contain" />
                </span>
              ))}
          </div>
        )}
        </div>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <Name>RECORD PREDICTOR</Name>
        <Meta color="#38bdf8">{team && required > 0 ? `${team.abbr} · ${required - filled} WEEKS LEFT` : "32 TEAMS"}</Meta>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------ tier lists

function TierListsCard() {
  const template = getTierTemplate("nfl-teams");
  const preview = useMemo(() => (template ? previewFor(template) : null), [template]);
  if (!template || !preview) return null;
  return (
    <Link href="/tier-lists" className={CARD}>
      <div className={ART}>
        <div className="w-full">
          <BoardThumb state={preview} template={template} />
        </div>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <Name>TIER LISTS</Name>
        <Meta color="#f472b6">RANK ALL 32 TEAMS</Meta>
      </div>
    </Link>
  );
}

// ----------------------------------------------------------- leaderboard

function LeaderboardCard({ rows }: { rows: LeaderboardRow[] }) {
  const top = rows.slice(0, 4);
  const best = top[0]?.total_points || 1;
  return (
    <Link href="/leaderboard" className={CARD}>
      <div className={ART}>
        <div className="w-full">
        {top.length > 0 ? (
          top.map((row, i) => (
            <div
              key={row.user_id}
              className={`mb-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 last:mb-0 ${i === 0 ? "bg-[#facc15]/15" : "bg-white/5"}`}
            >
              <span className="w-3 shrink-0 text-[10px] text-white/55" style={{ fontFamily: "var(--font-display)" }}>
                {i + 1}
              </span>
              {row.avatar_url ? (
                <img src={row.avatar_url} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-white/25" />
              )}
              <span className="min-w-0 flex-1 truncate text-[10px] text-white/70">{row.display_name || row.username}</span>
              <span
                className="h-[5px] shrink-0 rounded-full bg-white/25"
                // Capped well under half the row: this card sits in a
                // two-up grid on a phone, and a bar sized to look right on
                // desktop squeezes the name beside it down to "Ma...".
                style={{ width: `${Math.max(12, Math.round((row.total_points / best) * 34))}%` }}
              />
            </div>
          ))
        ) : (
          // Placeholder bars rather than an empty box - the card still has
          // to describe the destination before anyone has scored a point.
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="mb-1 flex items-center gap-1.5 rounded-md bg-white/5 px-1.5 py-1 last:mb-0">
              <span className="w-3 shrink-0 text-[10px] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
                {i + 1}
              </span>
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-white/10" />
              <span className="h-[5px] rounded-full bg-white/10" style={{ width: `${64 - i * 12}%` }} />
            </div>
          ))
        )}
        </div>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <Name>LEADERBOARD</Name>
        <Meta color="#facc15">{rows.length > 0 ? `${rows.length} PLAYING` : "SEASON STANDINGS"}</Meta>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------------ page

export default function HomePage() {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [picks, setPicks] = useState<Record<string, TeamAbbr> | null>(null);
  const [progress, setProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch(() => {});
    fetchLeaderboard()
      .then(setBoard)
      .catch(() => {});
  }, []);

  const activeWeek = useMemo(() => {
    const openWeeks = weeks.filter((w) => w.is_open).map((w) => w.week);
    return openWeeks.length > 0 ? Math.max(...openWeeks) : CURRENT_WEEK;
  }, [weeks]);

  useEffect(() => {
    if (!user) {
      setPicks(null);
      setProgress(null);
      return;
    }
    fetchWeeklyPicks(user.id, activeWeek)
      .then((result) => setPicks(result.picks))
      .catch(() => setPicks(null));
    fetchPredictorProgress(user.id)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [user, activeWeek]);

  const games = GAMES_BY_WEEK[activeWeek] ?? [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3.5 px-4 pt-10 pb-16">
      <div className="text-center">
        <div className="mb-1 text-xs tracking-[0.25em] text-white/45">SIDELINE BREW</div>
        <h1 className="text-[clamp(2rem,8vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK&rsquo;EM
        </h1>
      </div>

      <WeeklyHero week={activeWeek} games={games} picks={picks} signedIn={!!user} />

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <PredictorCard progress={progress} />
        <TierListsCard />
        <LeaderboardCard rows={board} />
      </div>
    </main>
  );
}
