"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { PUZZLE_PLAYERS, PuzzlePlayer, playerHeadshot } from "@/data/puzzlePlayers";
import { TEAMS } from "@/data/teams";
import { fetchDailyPuzzle, submitDailyGuess, PuzzleState, PuzzleGuess, Verdict, NumCell } from "@/lib/supabase/dailyPuzzle";
import { errorMessage } from "@/lib/errorMessage";

// Columns, in board order.
//
// `base` marks the three that come from the team a player is on, so they
// are known for everybody and are what the board looks like on day one.
// The rest depend on roster fields the sync did not originally capture,
// arrive as status 'unknown' until it is re-run, and are hidden until
// something knows a value - a board of grey "?" boxes is worse than a
// narrow board, and it also tells you nothing.
const COLUMNS = [
  { key: "team", label: "TEAM", base: true },
  { key: "division", label: "DIVISION", base: true },
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

const TONE: Record<Verdict, string> = {
  hit: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
  close: "border-amber-400/50 bg-amber-400/15 text-amber-200",
  miss: "border-white/10 bg-white/[0.04] text-white/45",
  unknown: "border-white/5 bg-white/[0.02] text-white/25",
};

// Height reads as feet and inches or it does not read at all.
function formatCell(key: ColumnKey, value: string | number | null): string {
  if (value === null || value === undefined) return "?";
  if (key === "height" && typeof value === "number") return `${Math.floor(value / 12)}'${value % 12}"`;
  if (key === "weight" && typeof value === "number") return `${value}`;
  return String(value);
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

  // Which columns anyone actually knows anything about. A column stays
  // hidden until some guess reports a real verdict for it.
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

  // The share grid is why games like this travel. One row per guess, one
  // square per visible column, and deliberately no player name in it -
  // a result you cannot post without spoiling it does not get posted.
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
    return `Sideline Brew — Daily Player\n${s.puzzleOn}  ${score}\n\n${grid}\n\nsidelinebrew.com/daily`;
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
    return <p className="text-sm text-red-400 text-center py-10">{error}</p>;
  }
  if (!state) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }

  const left = state.maxGuesses - state.guessesUsed;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          GUESS THE PLAYER
        </h1>
        <span className="text-xs text-white/45 tabular-nums shrink-0">
          {state.finished ? `${state.guessesUsed} used` : `${left} left`}
        </span>
      </div>

      {!state.finished && (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a player's name…"
            autoComplete="off"
            disabled={busy}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/35 disabled:opacity-60"
          />
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-[#101d38] shadow-2xl shadow-black/60">
              {matches.map((p) => {
                const already = guessedIds.has(p.espnId);
                return (
                  <button
                    key={p.espnId}
                    type="button"
                    disabled={already}
                    onClick={() => guess(p)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      already ? "opacity-35" : "hover:bg-white/5"
                    }`}
                  >
                    <img src={playerHeadshot(p.espnId)} alt="" className="h-7 w-7 rounded-full bg-white/10 object-cover" />
                    <span className="flex-1 min-w-0 truncate text-sm">{p.name}</span>
                    <span className="shrink-0 text-[10px] text-white/40">
                      {p.team} · {p.position}
                    </span>
                    {already && <span className="shrink-0 text-[10px] text-white/40">used</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {state.guesses.length === 0 && !state.finished && (
        <p className="text-xs text-white/40">
          Eight tries. Every guess tells you what it has in common with the mystery player — green is a match, amber is close,
          and an arrow points the way.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {state.guesses.map((g) => (
          <div
            key={g.espnId}
            className={`rounded-xl border px-3 py-2.5 ${
              g.correct ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-2">
              <img src={playerHeadshot(g.espnId)} alt="" className="h-8 w-8 rounded-full bg-white/10 object-cover shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm">{g.name}</span>
              {g.correct && <span className="shrink-0 text-xs text-emerald-400">✓</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleColumns.map((c) => {
                const cell = cellOf(g, c.key);
                return (
                  <span
                    key={c.key}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] tabular-nums ${TONE[cell.status]}`}
                  >
                    <span className="opacity-60">{c.label}</span>
                    {formatCell(c.key, cell.value)}
                    {cell.direction === "up" && <span aria-label="higher">↑</span>}
                    {cell.direction === "down" && <span aria-label="lower">↓</span>}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {state.finished && state.answer && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 flex flex-col items-center gap-2 text-center">
          <img
            src={playerHeadshot(state.answer.espnId)}
            alt=""
            className="h-16 w-16 rounded-full bg-white/10 object-cover"
            style={{ boxShadow: `0 0 0 2px ${TEAMS[state.answer.team as keyof typeof TEAMS]?.color ?? "#ffffff40"}` }}
          />
          <p className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
            {state.answer.name}
          </p>
          <p className="text-xs text-white/45">
            {state.answer.team} · {state.answer.position}
          </p>
          <p className="text-sm mt-1">
            {state.solved ? (
              <>
                Solved in {state.guessesUsed} — <span className="text-emerald-400">+{state.pointsAwarded} pts</span>
              </>
            ) : (
              <span className="text-white/50">Out of guesses. New player tomorrow.</span>
            )}
          </p>
          <button
            type="button"
            onClick={share}
            className="mt-2 rounded-full px-5 py-2 text-xs active:scale-95 transition-transform duration-150"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {copied ? "COPIED" : "SHARE RESULT"}
          </button>
        </div>
      )}
    </div>
  );
}
