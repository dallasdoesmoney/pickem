"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";
import { fetchPredictorProgress } from "@/lib/supabase/achievements";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";
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

const PILL_GAP = 6;

// The real pill from the picks page, at preview size. Stretched to full
// card width it stopped reading as a pill at all - the two halves became
// bands and the rounded ends disappeared - so it goes two-up on a phone
// and five-up once there is room.
function Matchup({ game, picked, scale }: { game: Game; picked?: TeamAbbr; scale: number }) {
  return (
    <div className="relative flex items-center" style={{ width: PILL_WIDTH * scale }}>
      {([
        [game.away, "left"],
        [game.home, "right"],
      ] as const).map(([abbr, side]) => (
        <TeamHalfPill
          key={side}
          team={TEAMS[abbr]}
          side={side}
          outcome={null}
          // Dimming the team you passed on says "you chose" without a
          // ring, a tick or a legend. Nothing is faded until a pick
          // exists, so an untouched week reads as all still open.
          isFaded={!!picked && picked !== abbr}
          onClick={() => {}}
          disabled
          scale={scale}
          footer={<span style={{ fontSize: 14 * scale, fontFamily: "var(--font-display)", color: "#fff" }}>{abbr}</span>}
        />
      ))}
    </div>
  );
}

// TeamHalfPill is a fixed-width component, so a plain grid leaves
// whatever the column is wider than the pill as dead space - which on a
// wide card is most of it. Measuring the panel and solving the scale from
// the column count makes the pills fill their columns exactly at any
// width instead.
function MatchupGrid({ games, picks }: { games: Game[]; picks: Record<string, TeamAbbr> | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);
  const [scale, setScale] = useState(0.47);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const nextCols = window.innerWidth >= 640 ? 5 : 2;
      const column = (el.clientWidth - PILL_GAP * (nextCols - 1)) / nextCols;
      setCols(nextCols);
      setScale(column / PILL_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Two rows either way, so the art panel is the same shape at both
  // breakpoints and neither one ends on a half-empty row.
  const shown = games.slice(0, cols * 2);

  return (
    <div ref={ref} className="grid w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: PILL_GAP }}>
      {shown.map((game) => (
        // Only four pills fit on a phone, so the ones that are dimmed
        // read as a broken image rather than as a record of your picks.
        // With that little on screen the matchups are the point; the
        // picked state is left to the wide card, where there is enough
        // of it for the pattern to be legible.
        <Matchup key={game.id} game={game} picked={cols === 2 ? undefined : picks?.[game.id]} scale={scale} />
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

  // Same shape as every other card on the page: name, then one meta line.
  // No subtitle and no button - the whole card is the link, exactly like
  // the three below it.
  const meta = !signedIn
    ? `WEEK ${week} · ${games.length} GAMES`
    : madeCount === 0
      ? `WEEK ${week} · ${games.length} GAMES OPEN`
      : left === 0
        ? `${games.length} OF ${games.length} PICKED`
        : `${madeCount} OF ${games.length} PICKED`;

  return (
    <Link href="/weekly" className={CARD}>
      <div className={ART}>
        <MatchupGrid games={games} picks={picks} />
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <Name>WEEKLY PICK&rsquo;EM</Name>
        <Meta color="#4ade80">{meta}</Meta>
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
