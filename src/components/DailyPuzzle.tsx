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
  { key: "weight", label: "WT", base: false },
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

const TONE: Record<Verdict, { bg: string; ink: string }> = {
  hit: { bg: "#22c55e", ink: "#04240f" },
  close: { bg: "#fb923c", ink: INK },
  miss: { bg: "#e8e0cd", ink: "#8a8171" },
  unknown: { bg: "#efe9d8", ink: "#b3ab98" },
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PUZZLE_PLAYERS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

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

      {!state.finished && (
        <div
          className="flex flex-col"
          style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP, padding: 16 }}
        >
          {/* No title here - the page already says WHO AM I? above the
              card, and repeating it inside cost a line of height for a
              word already on screen. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a89f8b" }}>
              Guess the player
            </span>
            <span className="text-sm font-bold" style={{ color: "#e0483a" }}>
              {left} of {state.maxGuesses} left
            </span>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a player's name…"
              autoComplete="off"
              disabled={busy}
              className="w-full font-semibold outline-none disabled:opacity-60"
              style={{
                background: "#fff",
                border: EDGE,
                borderRadius: 12,
                boxShadow: `3px 3px 0 ${INK}`,
                padding: "10px 12px",
                color: INK,
                fontSize: ".85rem",
              }}
            />
            {matches.length > 0 && (
              <div
                className="absolute z-20 mt-2 w-full overflow-hidden"
                style={{ background: "#fff", border: EDGE, borderRadius: 12, boxShadow: DROP }}
              >
                {matches.map((p) => {
                  const already = guessedIds.has(p.espnId);
                  return (
                    <button
                      key={p.espnId}
                      type="button"
                      disabled={already}
                      onClick={() => guess(p)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                        already ? "opacity-40" : "hover:bg-black/5"
                      }`}
                    >
                      <PlayerFace espnId={p.espnId} name={p.name} team={p.team} size={26} ring={2} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: INK }}>
                        {p.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold" style={{ color: "#8a8171" }}>
                        {p.team} · {p.position}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}

          {state.guesses.length === 0 && (
            <p className="mt-3 text-xs" style={{ color: "#8a8171" }}>
              Eight guesses. Every one tells you what it has in common with the mystery player — green is a match, orange is
              close, and an arrow points the way.
            </p>
          )}
        </div>
      )}

      {state.guesses.length > 0 && (
        <div
          style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP, padding: 14 }}
        >
          {/* Sideways once the extra columns arrive, with the player pinned
              left - a row of numbers you cannot match to a name is not a
              hint. */}
          <div className="overflow-x-auto">
            <div className="flex min-w-max flex-col gap-2">
              <div className="flex items-end gap-1.5 text-[9px] font-bold tracking-wider" style={{ color: "#a89f8b" }}>
                <div className="sticky left-0 z-10 w-[128px] shrink-0 pr-2" style={{ background: CREAM }}>
                  PLAYER
                </div>
                {visibleColumns.map((c) => (
                  <div key={c.key} className="w-[62px] shrink-0 text-center">
                    {c.label}
                  </div>
                ))}
              </div>

              {state.guesses.map((g) => (
                <div key={g.espnId} className="flex items-stretch gap-1.5">
                  <div
                    className="sticky left-0 z-10 flex w-[128px] shrink-0 items-center gap-2 pr-2"
                    style={{ background: CREAM }}
                  >
                    <PlayerFace espnId={g.espnId} name={g.name} team={(PUZZLE_PLAYERS_BY_ID.get(g.espnId)?.team ?? "KC") as TeamAbbr} size={28} />
                    <span className="min-w-0 truncate text-xs font-bold" style={{ color: INK }}>
                      {g.name}
                    </span>
                  </div>
                  {visibleColumns.map((c) => {
                    const cell = cellOf(g, c.key);
                    const { bg, ink } = cellStyle(c.key, cell);
                    return (
                      <div
                        key={c.key}
                        title={`${c.label}: ${formatCell(c.key, cell.value)}`}
                        className="flex w-[62px] shrink-0 items-center justify-center gap-0.5 text-[11px] font-bold tabular-nums"
                        style={{ background: bg, color: ink, border: EDGE, borderRadius: 10, boxShadow: DROP_SM, padding: ".55rem .1rem" }}
                      >
                        <span className="truncate">{formatCell(c.key, cell.value)}</span>
                        {cell.direction === "up" && <span aria-label="higher">↑</span>}
                        {cell.direction === "down" && <span aria-label="lower">↓</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
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
    <div style={{ background: CREAM, border: EDGE, borderRadius: 18, boxShadow: DROP, overflow: "hidden" }}>
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
        <span className="relative z-10 text-[.72rem] font-bold uppercase tracking-wider">{meta}</span>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: INK }}>
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
        <button
          type="button"
          onClick={onShare}
          className="active:scale-95 transition-transform duration-150"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ".85rem",
            background: "#ffc93c",
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
