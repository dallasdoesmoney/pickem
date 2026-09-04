"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";
import { fetchPredictorProgress } from "@/lib/supabase/achievements";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { fetchDailyPuzzle, readGuestGuesses, puzzleToday, PuzzleState, Verdict } from "@/lib/supabase/dailyPuzzle";
import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { playerHeadshot } from "@/lib/espnHeadshot";
import { PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { getTierTemplate } from "@/data/tierTemplates";
import { BoardZoom, previewFor } from "@/components/tierList/BoardThumb";
import { widestWordEm } from "@/components/tierList/bungee";
import { useAuth } from "@/hooks/useAuth";
import { CounterStyles, PlayersToday, showsCount, usePlayersToday } from "@/components/daily/PlayersToday";

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
const ART = "flex flex-1 items-center bg-[#050a15] p-2.5";

// How dark the name's ground gets, and how far up the card it reaches.
// Below about 60 the names on the pale previews - the Saints pill, the
// pink S band - start to go soft; stopping short of the top is what
// leaves some of the preview in the clear.
const DIM = 0.95;
const REACH = 90; // % of the card height

// The name, on the dark end of the art rather than in a strip below it.
//
// Under the art it was 15px and the quietest thing on a card whose
// loudest thing is a preview - and the previews are what a stranger
// cannot tell apart, since four dark panels of small coloured shapes
// read as four of the same card. On the art the name is the biggest
// thing on it, and the scrim keeps the preview legible underneath.
//
// The name sits in normal flow, NOT pinned over the art, so the card
// grows to hold whatever it needs and there is always clear space above
// the words. Pinned, the room had to be reserved as fixed padding, and
// no single number was right: the hero's one-liner wanted 64px and a
// two-line RECORD PREDICTOR wanted 77, so the hero name sat down on the
// white edge of a matchup pill while the tiles reserved dead space. The
// scrim is what still makes it read as one picture - it is absolute, so
// it crosses the seam between the art and this band.
function Caption({ name, color, meta, live }: { name: string; color: string; meta: React.ReactNode; live?: React.ReactNode }) {
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
      {/* relative so it paints over the scrim rather than under it. */}
      <div className="relative px-3 pt-2.5 pb-3">
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
        {/* The live counter REPLACES this line's static dot rather than
            sitting next to it - two dots on one line is the tell that
            something was bolted on. With no count to show (a quiet hour,
            a failed read) the original line is untouched. */}
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.09em] text-white/60">
          {live ?? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
          {live && <span className="text-white/30">&middot;</span>}
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

// ----------------------------------------------------------------- daily
//
// Same shape as the weekly hero and sitting above it: full width, art,
// one name, one meta line, the whole card a link.
//
// The preview is a real board: two wrong guesses and then the one that
// lands, all six green. It used to be an abstract stripe of colour -
// three rows of anonymous bars - which had the right palette and none of
// the meaning. A stranger looking at bars sees a colour test; looking at
// this they see football players, and the run of solid green along the
// bottom says what winning looks like before they have read a word.
//
// Fixed, not random: this must draw the same on the server and the client
// or it tears on hydration, and a preview that reshuffles every render is
// noise. It is also not today's actual puzzle, and must never be - the
// card would be spoiling the game it is advertising.
//
// The verdicts are DERIVED, not typed. Every value here is the player's
// real row out of src/data/rosters/all.ts and every colour is what the
// game itself would return for that guess, so the card cannot drift into
// claiming a comparison the board would grade the other way.
const DAILY_ANSWER = { team: "LAR", conf: "NFC", div: "NFC West", pos: "WR", age: 25, heightIn: 74, jersey: 12 };
const DAILY_GUESSES = [
  { espnId: "4239993", name: "Tee Higgins", team: "CIN" as TeamAbbr,
    conf: "AFC", div: "AFC North", pos: "WR", age: 27, heightIn: 76, jersey: 5 },
  { espnId: "4361370", name: "Chris Olave", team: "NO" as TeamAbbr,
    conf: "NFC", div: "NFC South", pos: "WR", age: 26, heightIn: 72, jersey: 12 },
  { espnId: "4426515", name: "Puka Nacua", team: "LAR" as TeamAbbr,
    conf: "NFC", div: "NFC West", pos: "WR", age: 25, heightIn: 74, jersey: 12 },
];

// The board's own thresholds, from CLOSE_MEANS in DailyPuzzle: a division
// is close inside the same conference, and a number is close inside its
// column's tolerance. Kept to one place so the card and the game cannot
// disagree about what gold means.
const near = (a: number, b: number, within: number): Verdict =>
  a === b ? "hit" : Math.abs(a - b) <= within ? "close" : "miss";

const feet = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

type DailyCell = { text: string; verdict: Verdict };

function dailyRow(g: (typeof DAILY_GUESSES)[number]): DailyCell[] {
  const a = DAILY_ANSWER;
  return [
    { text: g.team, verdict: g.team === a.team ? "hit" : "miss" },
    { text: g.div, verdict: g.div === a.div ? "hit" : g.conf === a.conf ? "close" : "miss" },
    { text: g.pos, verdict: g.pos === a.pos ? "hit" : "miss" },
    { text: String(g.age), verdict: near(g.age, a.age, 3) },
    { text: feet(g.heightIn), verdict: near(g.heightIn, a.heightIn, 2) },
    { text: String(g.jersey), verdict: near(g.jersey, a.jersey, 3) },
  ];
}

const DAILY_TONE: Record<Verdict, string> = {
  hit: "#3ecb78",
  close: "#ffce3a",
  miss: "#aab3c1",
  unknown: "#8d96a5",
};

// The board's plate at preview size. Not PlayerPlate itself: that one is
// built for a 62px guess row and hard-codes its type sizes to it, and
// every number here is smaller than the smallest number there.
function MiniPlate({ guess }: { guess: (typeof DAILY_GUESSES)[number] }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { bg, ink } = teamTile(TEAMS[guess.team]?.color ?? "#334155");
  const logo = TEAMS[guess.team]?.logo;
  const initials = guess.name.split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join("");

  return (
    <span
      className="relative flex h-full w-full min-w-0 items-center overflow-hidden rounded-[4px] pr-1.5 sm:rounded-md sm:pr-2"
      style={{ background: `linear-gradient(100deg, ${bg}, ${bg}cc)`, border: "2px solid #0a1120", boxShadow: "2px 3px 0 #05090f" }}
    >
      {logo && (
        <img
          src={logo}
          alt=""
          aria-hidden
          loading="lazy"
          crossOrigin="anonymous"
          className="pointer-events-none absolute left-[-6px] top-1/2 aspect-square h-[150%] max-w-none -translate-y-1/2 select-none object-contain opacity-[0.26]"
        />
      )}
      <span
        className="relative grid aspect-square h-full shrink-0 place-items-center overflow-hidden font-extrabold"
        style={{ color: ink, fontSize: "clamp(7px, 2.1cqw, 15px)" }}
      >
        {/* The headshots are cut out on transparency, so initials left
            underneath one show THROUGH him rather than behind him. */}
        {!loaded && <span>{initials}</span>}
        {!broken && (
          <img
            src={playerHeadshot(guess.espnId)}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full select-none object-cover object-top"
          />
        )}
      </span>
      <span
        className="relative ml-1.5 min-w-0 truncate font-semibold sm:ml-2"
        style={{
          color: ink,
          // Container-relative, so the name shrinks in step with the
          // plate that holds it. A fixed size plus a percentage column is
          // the combination that truncates on the narrowest phones: the
          // box gets smaller and the words do not.
          fontSize: "clamp(7px, 2.4cqw, 17px)",
          textShadow: ink === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.45)" : "none",
        }}
      >
        {guess.name}
      </span>
    </span>
  );
}

function DailyHero({ state }: { state: PuzzleState | null }) {
  const playing = usePlayersToday();
  // A count is all a result is allowed to say out here. "SOLVED IN 4"
  // gives away nothing about WHO, which is the one thing that would ruin
  // somebody else's day - the same rule the share grid follows.
  //
  // Every branch now names the game, because the card above it no longer
  // does: "DAILY GAMES" is the category, and this is the line that says
  // which one is behind it today.
  // The caption above now names the game, so this says what STATE it is
  // in rather than repeating the name directly under itself.
  //
  // And it drops its own "TODAY" when the live counter is up, because
  // the counter has already said it - "1,247 PLAYED TODAY - TODAY - 8
  // GUESSES" is the line you get if nobody checks.
  const live = showsCount(playing);
  const meta = !state
    ? live
      ? "8 GUESSES"
      : "TODAY \u00b7 8 GUESSES"
    : state.solved
      ? `SOLVED IN ${state.guessesUsed}`
      : state.finished
        ? live
          ? "OUT OF GUESSES"
          : "OUT OF GUESSES TODAY"
        : state.guessesUsed > 0
          ? `${state.guessesUsed} OF ${state.maxGuesses} USED`
          : live
            ? `${state.maxGuesses} GUESSES`
            : `TODAY \u00b7 ${state.maxGuesses} GUESSES`;

  return (
    <Link href="/nfl-nameplate" className={CARD}>
      {/* Full width. It used to be capped at 580 and centred, because the
          art was six featureless bars and letting them fill a 992px card
          made each one seven times wider than it was tall - a stack of
          ribbons. That cap bought nothing once the bars became chips with
          words in them, and cost two hundred pixels of empty gutter on
          either side of the biggest card on the page. What keeps the
          proportion honest now is that the ROW HEIGHT and the type grow
          with the card as well, so a chip stays a chip instead of
          stretching on its own.
          aria-hidden because the caption already announces the card, and
          the board is decoration here: read out, it is thirty-two
          fragments of a game nobody has started. */}
      <div className={ART} aria-hidden>
        <div className="flex w-full flex-col gap-1.5 px-1 py-1.5 sm:gap-2">
          {DAILY_GUESSES.map((guess) => (
            <div
              key={guess.espnId}
              // The plate takes a share of the row and the six hints
              // split what is left, exactly as the board does it.
              //
              // A SHARE, not a fixed 124px. Fixed, the plate keeps its
              // width as the card narrows and takes it out of the chips
              // instead - and "South" is the tightest word on the board,
              // so it ran out of chip at 360px while the plate beside it
              // sat there with room to spare. Clamped at the top so the
              // hero does not hand a 200px column to an eleven-letter
              // name, and at the bottom so the smallest phone still has
              // somewhere to put one. Between those it is one ratio at
              // every width, which is why the height, the gap and the
              // type are all sized in cqw too.
              className="grid"
              style={{
                gridTemplateColumns: "clamp(88px, 30%, 230px) repeat(6, minmax(0, 1fr))",
                height: "clamp(30px, 5.4cqw, 56px)",
                gap: "clamp(4px, 0.75cqw, 9px)",
              }}
            >
              <MiniPlate guess={guess} />
              {dailyRow(guess).map((cell, c) => (
                <span
                  key={c}
                  className="grid place-items-center rounded-[4px] px-0.5 text-center font-medium leading-[1.1] tabular-nums sm:rounded-md"
                  style={{
                    fontSize: "clamp(6px, 2.1cqw, 15px)",
                    background: DAILY_TONE[cell.verdict],
                    color: "#0a1020",
                    border: "2px solid #0a1120",
                    boxShadow: "2px 3px 0 #05090f",
                  }}
                >
                  {/* DIV is the one column whose value is two words, and
                      at this size it cannot have them side by side - so
                      it stacks, the same way the board's own DIV chip
                      does. */}
                  {cell.text.includes(" ") ? (
                    cell.text.split(" ").map((word) => <span key={word} className="block">{word}</span>)
                  ) : (
                    cell.text
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* NFL NAMEPLATE, not DAILY GAMES. This is the largest link on the
          most-visited page, and it was describing the category rather
          than naming the game - so the strongest page on the site never
          said the words anybody searches. */}
      <Caption name={"NFL NAMEPLATE"} color="#fb923c" meta={meta} live={live ? <PlayersToday count={playing} /> : undefined} />
    </Link>
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
  const [daily, setDaily] = useState<PuzzleState | null>(null);

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

  // Today's daily, for the card's meta line. Two sources, because a
  // signed-out player's run lives in their browser and a signed-in one
  // lives on the server - the card should say "3 OF 8 USED" either way
  // rather than pretending a guest has not played.
  useEffect(() => {
    if (user) {
      fetchDailyPuzzle()
        .then(setDaily)
        .catch(() => setDaily(null));
      return;
    }
    const on = puzzleToday();
    const held = readGuestGuesses(on);
    // Only what the card needs. Building a whole board here would mean
    // duplicating the game's own assembly for one line of text.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDaily(
      held.length
        ? {
            puzzleOn: on,
            maxGuesses: 8,
            guessesUsed: held.length,
            guesses: held,
            solved: held.some((g) => g.correct),
            finished: held.some((g) => g.correct) || held.length >= 8,
            pointsAwarded: 0,
            answer: null,
          }
        : null
    );
  }, [user]);

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
      <CounterStyles />
      <div className="text-center">
        <div className="mb-1 text-xs tracking-[0.25em] text-white/45">SIDELINE BREW</div>
        {/* Not "PICK'EM" any more. This page fronts four things and
            Pick'em is one of them, so titling the whole page after one
            of its own children read as though you had already arrived
            somewhere - the same reason the old Pick'em hub had to go.
            These name what you can actually do here, in the order the
            cards run: play today's game, pick this week, predict a
            season, rank the league. The leaderboard underneath is where
            they all land, which is why it isn't a fifth verb.
            PLAY leads because the daily card does, and because it is the
            only one of the four you can finish in a minute - which makes
            it the cheapest reason for a stranger to come back tomorrow. */}
        <h1 className="text-[clamp(1.7rem,7vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PLAY. PICK. PREDICT. RANK.
        </h1>
      </div>

      <DailyHero state={daily} />

      <WeeklyHero week={activeWeek} games={games} picks={picks} signedIn={!!user} />

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <PredictorCard progress={progress} />
        <TierListsCard />
        <LeaderboardCard rows={board} />
      </div>
    </main>
  );
}
