"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { PUZZLE_PLAYERS, PUZZLE_PLAYERS_BY_ID, PuzzlePlayer } from "@/data/puzzlePlayers";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { PlayerFace } from "@/components/PlayerFace";
import { fetchDailyPuzzle, submitDailyGuess, PuzzleState, PuzzleGuess, Verdict, NumCell } from "@/lib/supabase/dailyPuzzle";
import { errorMessage } from "@/lib/errorMessage";

// The sticker language, in one place. Four rules and nothing else: cream
// ground, black outline, hard offset shadow, no transparency anywhere.
// Every daily game we add should be able to import these and look like it
// belongs without anyone redesigning it.
const CREAM = "#fff3d6";
const INK = "#16181c";
const EDGE = `3px solid ${INK}`;
const DROP = `8px 8px 0 ${INK}`;
const DROP_SM = `2px 3px 0 ${INK}`;

// Columns, in board order. `base` marks the three that come from the team
// a player is on, so they are known for everybody. The rest depend on
// roster fields ESPN does not publish for everyone; a column nothing knows
// a value for is hidden rather than drawn as a row of "?", which tells you
// nothing and costs width.
const COLUMNS = [
  { key: "team", label: "TEAM", base: true },
  { key: "division", label: "DIV", base: true },
  { key: "position", label: "POS", base: true },
  { key: "age", label: "AGE", base: false },
  { key: "height", label: "HT", base: false },
  // WEIGHT is off the board for now. The server still grades it - see
  // puzzle_num('weight', ...) in the migrations - and the value still
  // arrives on every guess, so putting it back is this one line and no
  // SQL. Nothing else has to change.
  { key: "jersey", label: "#", base: false },
  { key: "college", label: "COLLEGE", base: false },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function cellOf(guess: PuzzleGuess, key: ColumnKey) {
  return guess[key] as { value: string | number | null; status: Verdict; direction?: NumCell["direction"] };
}

// Height reads as feet and inches or it does not read at all.
function formatCell(key: ColumnKey, value: string | number | null): string {
  if (value === null || value === undefined) return "?";
  if (key === "height" && typeof value === "number") return `${Math.floor(value / 12)}'${value % 12}"`;
  return String(value);
}

// Gold and a deeper green rather than the highlighter versions. The
// first pass used tailwind's green-500 against a near-neon yellow, which
// on a cream ground read as two warning lights.
//
// Black ink on every one of them, including the misses. A greyed-out
// value in a grey chip says "ignore me" twice, and the value is the part
// you are reading the board for - you need to know it was MIA even when
// MIA is wrong. The colour carries the verdict; the text carries the
// fact. Measured against black: 7.03:1 on the green, 10.9 on the gold,
// 13.5 on the grey - all clear of AA.
const TONE: Record<Verdict, { bg: string; ink: string }> = {
  hit: { bg: "#35b96b", ink: INK },
  close: { bg: "#f5c518", ink: INK },
  miss: { bg: "#e8e0cd", ink: INK },
  unknown: { bg: "#efe9d8", ink: INK },
};

// What a yellow in each column actually means, which is worth saying out
// loud now that more than the numbers can produce one. Drives the legend.
//
// POS is deliberately absent: it has no close any more. Grouping corners
// with safeties barely narrowed a pool where a quarter of the league is a
// defensive back, and a yellow that does not narrow anything teaches
// people to ignore yellow.
const CLOSE_MEANS: Partial<Record<ColumnKey, string>> = {
  division: "same conference",
  college: "same college conference",
  age: "within 3 years",
  height: "within 2 inches",
  jersey: "within 3",
};

// The one column that can be painted in something other than green. A
// correct TEAM cell takes that team's own colour: Ravens purple and Chiefs
// red are different facts, where two greens are the same fact twice. Every
// other column keeps the plain green, so "right" still means one thing.
function cellStyle(key: ColumnKey, cell: { value: string | number | null; status: Verdict }) {
  if (key === "team" && cell.status === "hit" && typeof cell.value === "string") {
    const brand = TEAMS[cell.value as TeamAbbr]?.color;
    if (brand) return teamTile(brand);
  }
  const tone = TONE[cell.status];
  return { bg: tone.bg, ink: tone.ink };
}

export function DailyPuzzle() {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDailyPuzzle()
      .then(setState)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const guessedIds = useMemo(() => new Set(state?.guesses.map((g) => g.espnId) ?? []), [state]);

  const visibleColumns = useMemo(() => {
    const guesses = state?.guesses ?? [];
    return COLUMNS.filter((c) => c.base || guesses.some((g) => cellOf(g, c.key).status !== "unknown"));
  }, [state]);

  // Fixed player column, hint columns share the remainder. Nothing here
  // has a minimum width, which is the whole reason the board can no
  // longer push a scrollbar out the side of its card.
  const columnTrack = `var(--puzzle-player-col) repeat(${visibleColumns.length}, minmax(0, 1fr))`;

  // Someone typing "jam" wants Jameson before Benjamin. Starts-with wins,
  // then contains, and the tie inside each is alphabetical because the
  // list is already sorted that way.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: PuzzlePlayer[] = [];
    const contains: PuzzlePlayer[] = [];
    for (const p of PUZZLE_PLAYERS) {
      const name = p.name.toLowerCase();
      if (name.startsWith(q)) starts.push(p);
      else if (name.includes(q)) contains.push(p);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query]);

  useEffect(() => {
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function guess(player: PuzzlePlayer) {
    if (busy || guessedIds.has(player.espnId)) return;
    setError(null);
    setBusy(true);
    try {
      const next = await submitDailyGuess(player.espnId);
      setState(next);
      setQuery("");
      posthog.capture("daily_puzzle_guess", { used: next.guessesUsed, solved: next.solved });
      inputRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Arrow keys and enter, because a name you have already typed most of
  // should not need the mouse to finish.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[active];
      if (pick && !guessedIds.has(pick.espnId)) guess(pick);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  // The share grid is why games like this travel, and it deliberately
  // carries NO name, team or position - only squares, the date and the
  // score. A result you cannot post without spoiling the day for whoever
  // reads it does not get posted.
  function shareText(s: PuzzleState): string {
    const grid = s.guesses
      .map((g) =>
        visibleColumns
          .map((c) => {
            const st = cellOf(g, c.key).status;
            return st === "hit" ? "🟩" : st === "close" ? "🟨" : "⬜";
          })
          .join("")
      )
      .join("\n");
    const score = s.solved ? `${s.guessesUsed}/${s.maxGuesses}` : `X/${s.maxGuesses}`;
    return `Sideline Brew — Who Am I?\n${s.puzzleOn}  ${score}\n\n${grid}\n\nsidelinebrew.com/daily`;
  }

  async function share() {
    if (!state) return;
    const text = shareText(state);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        posthog.capture("daily_puzzle_shared", { method: "native_share" });
        return;
      } catch {
        // Cancelled, or the sheet failed - fall through to the clipboard
        // rather than leaving the button looking broken.
      }
    }
    await navigator.clipboard.writeText(text);
    posthog.capture("daily_puzzle_shared", { method: "clipboard" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error && !state) {
    return <p className="text-center text-sm text-red-400 py-10">{error}</p>;
  }
  if (!state) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const left = state.maxGuesses - state.guessesUsed;
  const answer = state.answer ? PUZZLE_PLAYERS_BY_ID.get(state.answer.espnId) : undefined;

  return (
    <div className="flex flex-col gap-5" style={{ fontFamily: "var(--font-game)" }}>
      {state.finished && state.answer && <Reveal state={state} answer={answer} onShare={share} copied={copied} />}

      {/* The board goes as wide as the screen allows; the input does not.
          A search field stretched to 1150px is a lot of runway for a
          name, and it drifts away from the list it drops down over. */}
      {!state.finished && (
        <div
          className="mx-auto flex w-full max-w-2xl flex-col p-4 lg:p-5"
          style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP }}
        >
          {/* No title here - the page already says WHO AM I? above the
              card, and repeating it inside cost a line of height for a
              word already on screen. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider lg:text-[13px]" style={{ color: "#a89f8b" }}>
              Guess the player
            </span>
            <span className="text-sm font-semibold lg:text-base" style={{ color: "#e0483a" }}>
              {left} of {state.maxGuesses} left
            </span>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // A new search is a new list, so the highlight goes back
                // to the top rather than pointing at whatever happens to
                // be in that slot now.
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a player's name…"
              autoComplete="off"
              disabled={busy}
              aria-label="Guess a player"
              aria-autocomplete="list"
              className="w-full px-3.5 py-3 text-[.95rem] font-medium outline-none transition-shadow duration-150 focus:shadow-[5px_5px_0_#16181c] disabled:opacity-60 lg:px-4 lg:py-3.5 lg:text-base"
              style={{
                background: "#fff",
                border: EDGE,
                borderRadius: 12,
                boxShadow: `3px 3px 0 ${INK}`,
                color: INK,
              }}
            />
            {query.trim().length > 0 && (
              <div
                ref={menuRef}
                role="listbox"
                className="puzzle-menu absolute z-20 mt-2 max-h-[19rem] w-full overflow-y-auto overflow-x-hidden"
                style={{ background: "#fff", border: EDGE, borderRadius: 12, boxShadow: DROP }}
              >
                {matches.length === 0 && (
                  <p className="px-3.5 py-3 text-sm font-medium" style={{ color: "#a89f8b" }}>
                    No player by that name.
                  </p>
                )}
                {matches.map((p, i) => {
                  const already = guessedIds.has(p.espnId);
                  return (
                    <button
                      key={p.espnId}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      data-active={i === active && !already}
                      disabled={already}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => guess(p)}
                      className={`puzzle-option flex w-full items-center gap-2.5 py-2 pr-3 text-left ${
                        already ? "opacity-40" : ""
                      }`}
                      style={{ paddingLeft: 10 }}
                    >
                      <PlayerFace espnId={p.espnId} name={p.name} team={p.team} size={28} ring={2} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: INK }}>
                        {p.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: "#8a8171" }}>
                        {already ? "GUESSED" : `${p.team} · ${p.position}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

          {state.guesses.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "#8a8171" }}>
              Eight guesses. Every one tells you what it has in common with the mystery player — green is an exact match,
              yellow is close, and an arrow points the way.
            </p>
          )}
        </div>
      )}

      {state.guesses.length > 0 && (
        <div
          className="puzzle-board p-3.5 md:p-[18px] lg:p-6"
          style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP }}
        >
          {/* One header row on desktop, where the columns line up under it.
              On a phone the board stacks into a card per guess and every
              chip carries its own label instead - same information, no
              row of headings marooned above a grid it no longer describes. */}
          <div
            className="mb-2 hidden gap-2 text-[10px] font-semibold tracking-wider md:grid lg:mb-2.5 lg:text-[11px]"
            style={{ gridTemplateColumns: columnTrack, color: "#a89f8b" }}
          >
            <div className="pr-2">PLAYER</div>
            {visibleColumns.map((c) => (
              <div key={c.key} className="text-center">
                {c.label}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:gap-2">
            {state.guesses.map((g) => (
              <div
                key={g.espnId}
                className="puzzle-row flex flex-col gap-2 md:grid md:items-stretch md:gap-2"
                style={{ gridTemplateColumns: columnTrack }}
              >
                <div className="flex min-w-0 items-center gap-2.5 md:pr-2">
                  <PlayerFace
                    espnId={g.espnId}
                    name={g.name}
                    team={(PUZZLE_PLAYERS_BY_ID.get(g.espnId)?.team ?? "KC") as TeamAbbr}
                    size={36}
                  />
                  <span
                    className="min-w-0 truncate text-sm font-semibold md:text-[13px] lg:text-[15px]"
                    style={{ color: INK }}
                    title={g.name}
                  >
                    {g.name}
                  </span>
                </div>

                {/* md:contents dissolves this wrapper on desktop so the
                    chips become cells of the row's own grid and line up
                    with the header. On a phone it stays a 4-up grid. */}
                <div className="grid grid-cols-4 gap-2 md:contents">
                  {visibleColumns.map((c, i) => (
                    <Chip key={c.key} column={c} cell={cellOf(g, c.key)} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Legend columns={visibleColumns} />
        </div>
      )}
    </div>
  );
}

// One hint. Carries its own label below the md breakpoint, because that
// is where the header row stops existing.
function Chip({
  column,
  cell,
  index,
}: {
  column: (typeof COLUMNS)[number];
  cell: { value: string | number | null; status: Verdict; direction?: NumCell["direction"] };
  index: number;
}) {
  const { bg, ink } = cellStyle(column.key, cell);
  const text = formatCell(column.key, cell.value);
  // "Northwestern" in a 76px chip needs the smaller size or it is three
  // letters and an ellipsis. The threshold is 8 rather than 9 because
  // "AFC North" is exactly nine characters and was the thing truncating.
  const long = text.length > 8;
  // College is the one column that wraps. "Mississippi State" is two
  // words and a chip is not wide enough for either of them shrunk to fit,
  // so it takes two lines and the row grows - which costs nothing,
  // because the row was going to be the height of its tallest chip
  // anyway. Nothing else wraps: every other value is short, or a number,
  // or an abbreviation that means nothing broken in half.
  const wraps = column.key === "college";

  return (
    <div
      className="puzzle-chip flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 md:py-3 lg:py-3.5"
      title={`${column.label}: ${text}`}
      style={{
        background: bg,
        color: ink,
        border: EDGE,
        borderRadius: 10,
        boxShadow: DROP_SM,
        animationDelay: `${index * 45}ms`,
      }}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wider md:hidden" style={{ opacity: 0.6 }}>
        {column.label}
      </span>
      <span className="flex w-full items-center justify-center gap-0.5 px-1">
        <span
          className={`font-medium tabular-nums ${
            wraps
              ? "break-words text-center leading-[1.15] text-[10px] md:text-[11px] lg:text-[13px]"
              : `truncate ${long ? "text-[9px] md:text-[11px] lg:text-[12px]" : "text-[11px] md:text-[13px] lg:text-[15px]"}`
          }`}
        >
          {text}
        </span>
        {cell.direction === "up" && <span aria-label="higher">↑</span>}
        {cell.direction === "down" && <span aria-label="lower">↓</span>}
      </span>
    </div>
  );
}

// Yellow means something different in every column it can appear in, and
// a colour whose meaning you have to guess at is not a hint. Built from
// the columns actually on the board, so it never explains a column that
// is not there.
function Legend({ columns }: { columns: readonly (typeof COLUMNS)[number][] }) {
  const explained = columns.filter((c) => CLOSE_MEANS[c.key]);

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3 lg:mt-5 lg:pt-4" style={{ borderColor: "#e4d9bd" }}>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-semibold lg:gap-x-5 lg:text-xs"
        style={{ color: "#8a8171" }}
      >
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.hit.bg} /> EXACT
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.close.bg} /> CLOSE
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.miss.bg} /> NO MATCH
        </span>
      </div>
      <p className="text-[10px] leading-relaxed lg:text-xs" style={{ color: "#a89f8b" }}>
        Close means{" "}
        {explained.map((c, i) => (
          <span key={c.key}>
            {i > 0 && (i === explained.length - 1 ? ", and " : ", ")}
            <span style={{ color: "#8a8171", fontWeight: 700 }}>{c.label}</span> {CLOSE_MEANS[c.key]}
          </span>
        ))}
        .
      </p>
    </div>
  );
}

function Swatch({ bg }: { bg: string }) {
  return (
    <span
      aria-hidden
      className="inline-block"
      style={{ width: 12, height: 12, background: bg, border: `2px solid ${INK}`, borderRadius: 4 }}
    />
  );
}

// The end of the round, which is the only part of this anyone photographs.
// The card takes the team's colour, the crest sits behind the face, and the
// name lands in the same display face as the rest of the site.
function Reveal({
  state,
  answer,
  onShare,
  copied,
}: {
  state: PuzzleState;
  answer: PuzzlePlayer | undefined;
  onShare: () => void;
  copied: boolean;
}) {
  const team = (answer?.team ?? state.answer?.team) as TeamAbbr | undefined;
  const brand = team ? TEAMS[team]?.color : undefined;
  const { bg, ink } = teamTile(brand ?? "#334155");
  const meta = [team ? `${TEAMS[team].name}` : null, state.answer?.position, answer?.jersey ? `No. ${answer.jersey}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="puzzle-reveal mx-auto w-full max-w-2xl"
      style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP, overflow: "hidden" }}
    >
      <div
        className="relative flex flex-col items-center gap-2 overflow-hidden px-4 pt-6 pb-5"
        style={{ background: bg, color: ink, borderBottom: EDGE }}
      >
        {team && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid select-none place-items-center"
            style={{ fontFamily: "var(--font-display)", fontSize: "7rem", lineHeight: 1, opacity: 0.13 }}
          >
            {team}
          </span>
        )}
        {state.answer && team && (
          <span className="relative z-10">
            <PlayerFace espnId={state.answer.espnId} name={state.answer.name} team={team} size={84} ring={4} />
          </span>
        )}
        <span
          className="relative z-10 text-center leading-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}
        >
          {state.answer?.name}
        </span>
        <span className="relative z-10 text-[.72rem] font-semibold uppercase tracking-wider">{meta}</span>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: INK }}>
            {state.solved ? `Solved in ${state.guessesUsed}` : "Out of guesses"}
          </span>
          {state.solved && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ".78rem",
                background: "#22c55e",
                color: "#04240f",
                border: EDGE,
                borderRadius: 999,
                padding: "4px 12px",
                boxShadow: `2px 2px 0 ${INK}`,
              }}
            >
              +{state.pointsAwarded} PTS
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: "#8a8171" }}>
          {state.solved ? "New player tomorrow at midnight ET." : "New player tomorrow — the streak survives."}
        </p>
        {/* Orange rather than yellow: yellow is a verdict on this board
            now, and a button wearing a verdict's colour reads as one. */}
        <button
          type="button"
          onClick={onShare}
          className="puzzle-press"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ".85rem",
            background: "#ff7a45",
            color: INK,
            border: EDGE,
            borderRadius: 12,
            padding: 11,
            boxShadow: `3px 4px 0 ${INK}`,
          }}
        >
          {copied ? "COPIED" : "SHARE RESULT"}
        </button>
        <p className="text-center text-[10px]" style={{ color: "#a89f8b" }}>
          Shares squares only — no name, no team.
        </p>
      </div>
    </div>
  );
}
