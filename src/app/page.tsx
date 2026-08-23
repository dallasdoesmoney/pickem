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
import { BoardZoom, previewFor } from "@/components/tierList/BoardThumb";
import { widestWordEm } from "@/components/tierList/bungee";
import { useAuth } from "@/hooks/useAuth";

// Every card fronts a destination with a live picture of what is behind
// it - the week's actual matchups, your actual predictor progress, the
// actual top of the leaderboard. A card that draws itself from real data
// is a reason to tap; a static icon is not. Each preview therefore has a
// signed-out shape too, since the home page is the first thing a stranger
// sees.

// @container so a name can be sized against its own card: these run from
// a 137px tile on a small phone to a full-width hero.
const CARD =
  "group relative flex flex-col rounded-2xl @container border border-white/15 bg-[#101d38] overflow-hidden transition-colors hover:border-white/40";
// flex-1 so the three preview cards in a row all put their caption on the
// same line: the previews are naturally different heights (a 5-row tier
// board is twice a progress bar), and without this the shorter cards
// stretch to match and leave their caption stranded mid-card.
//
// The bottom padding is the room the name sits in. The scrim it sits on
// is see-through at the top, so without this the art would run under the
// words rather than stopping above them.
const ART = "flex flex-1 items-center bg-[#050a15] p-2.5 pb-[54px] sm:pb-[60px]";

// How dark the name's ground gets, and how far up the card it reaches.
// Below about 60 the names on the pale cards - the Saints pill, the pink
// S band - start to go soft; the preview above the reach line is
// untouched, which is the point of stopping short of the top.
const DIM = 0.85;
const REACH = 80; // % of the card height

// The name, over the art rather than in a strip below it.
//
// Under the art it was 15px and the quietest thing on a card whose
// loudest thing is a preview - and the previews are what a stranger
// cannot tell apart, since four dark panels of small coloured shapes
// read as four of the same card. Over the art the name is the biggest
// thing on it, and the scrim keeps the preview legible underneath.
function Caption({ name, color, meta }: { name: string; color: string; meta: React.ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: `${REACH}%`,
          background: `linear-gradient(to top, rgba(3,7,15,${(DIM + 0.18).toFixed(2)}) 0%, rgba(3,7,15,${(DIM * 0.62).toFixed(2)}) 42%, rgba(3,7,15,0) 100%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
        <div
          className="leading-[1.08]"
          style={{
            fontFamily: "var(--font-display)",
            // Tracks the card, but never bigger than the widest WORD can
            // be and still fit on one line - the same rule the tier list
            // cards use. LEADERBOARD is eleven letters that cannot break,
            // and at a flat 22px it ran off a 172px tile.
            //
            // The room is the card MINUS its 24px of padding, not a share
            // of it: px-3 is 17% of a 137px tile and 2% of the hero. The
            // extra pixel per character is glyph-advance rounding - under
            // about 15px each advance lands on a whole device pixel, and
            // eleven rounding the same way is how LEADERBOARD cleared the
            // maths and still overflowed by 4px.
            fontSize: `min(clamp(22px, 7cqw, 30px), calc((100cqw - ${26 + name.length}px) / ${widestWordEm(name).toFixed(3)}))`,
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {name}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.09em] text-white/60">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          {meta}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- weekly

const PILL_GAP = 6;

// The real pill from the picks page, at preview size. Stretched to full
// card width it stopped reading as a pill at all - the two halves became
// bands and the rounded ends disappeared - so it goes two-up on a phone
// and five-up once there is room.
function Matchup({ game, scale }: { game: Game; scale: number }) {
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
          // Never faded. The preview used to dim the team you passed on,
          // which meant your picks were on screen the moment the home
          // page loaded - readable by anyone standing behind you, and
          // shoulder-surfable in a group where the whole point is that
          // nobody knows your card yet. The preview is an advert for the
          // week's matchups, so it shows the matchups and nothing about
          // you: identical signed in or out.
          isFaded={false}
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
function MatchupGrid({ games }: { games: Game[] }) {
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
    // Inert, and it has to be. TeamHalfPill draws a real <button>, and a
    // disabled button doesn't just ignore its own clicks - it swallows
    // them, so nothing reached the Link wrapping this card. Every pixel
    // over a pill was dead while the gaps between them worked, which
    // reads as the site being broken rather than as a preview. Letting
    // pointer events fall straight through hands the whole card back to
    // the link.
    //
    // aria-hidden for the same reason from the other side: nested
    // interactive content inside a link is invalid, and thirty-two
    // unusable buttons is not what anyone wants read out. The card
    // already announces itself as "Weekly Pick'em, 3 of 16 picked".
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none grid w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: PILL_GAP }}
    >
      {shown.map((game) => (
        <Matchup key={game.id} game={game} scale={scale} />
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
  //
  // A count is the only thing your picks are allowed to say here. "3 OF
  // 16 PICKED" is the reason to tap the card and gives away nothing about
  // which three; the board above it is the same for everyone.
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
        <MatchupGrid games={games} />
      </div>
      <Caption name={"WEEKLY PICK’EM"} color="#4ade80" meta={meta} />
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
      <Caption
        name="RECORD PREDICTOR"
        color="#38bdf8"
        meta={team && required > 0 ? `${team.abbr} · ${required - filled} WEEKS LEFT` : "32 TEAMS"}
      />
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
          <BoardZoom state={preview} template={template} />
        </div>
      </div>
      <Caption name="TIER LISTS" color="#f472b6" meta="RANK ALL 32 TEAMS" />
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
      <Caption
        name="LEADERBOARD"
        color="#facc15"
        meta={rows.length > 0 ? `${rows.length} PLAYING` : "SEASON STANDINGS"}
      />
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
        {/* Not "PICK'EM" any more. This page fronts four things and
            Pick'em is one of them, so titling the whole page after one
            of its own children read as though you had already arrived
            somewhere - the same reason the old Pick'em hub had to go.
            These three name what you can actually do here, in the order
            the cards run: pick this week, predict a season, rank the
            league. The leaderboard underneath is where all three land,
            which is why it isn't a fourth verb. */}
        <h1 className="text-[clamp(2rem,8vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK. PREDICT. RANK.
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
