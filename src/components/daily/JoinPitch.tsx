"use client";

import type { NameplateStats } from "@/lib/supabase/nameplateStats";
import type { PuzzleState } from "@/lib/supabase/dailyPuzzle";
import { NameplateStatsPanel } from "@/components/NameplateStats";
import { CARD_EDGE, EDGE, FIELD, INK, MUTED, TEXT } from "@/lib/nameplateTheme";

// THE ASK, MOVED INSIDE THE RESULT.
//
// Today a signed-out solve is two dialogs: the reveal, and then - only
// once you close it - the sign-up. Which assumes people close things.
// The one moment somebody is most pleased with themselves is the moment
// the reveal is on screen, and the ask is not there; by the time it
// arrives they have already got what they came for and half of them have
// gone.
//
// So the ask goes UNDER the result, in the same dialog, and it brings
// something with it: what the record would look like if they had an
// account. The pitch stops being "sign up" and becomes "here is your
// streak, it disappears when you close this tab".

export type PitchKey = "record" | "locked" | "teaser" | "strip";

export const PITCHES: { key: PitchKey; name: string; note: string }[] = [
  {
    key: "record",
    name: "1 · Their actual record",
    note: "The full stats panel, filled in from the board they just played - one win, one streak, a real average. Every number is true; it is just a record with one game in it. The strongest of the four, because \"keep this\" beats \"sign up\" and they can see the thing they would be keeping.",
  },
  {
    key: "locked",
    name: "2 · Locked panel",
    note: "The same panel, blurred, with a lock over it. Says what they are missing without claiming any numbers - the honest choice if a 100% win rate off one game feels like it is overselling. Costs the persuasion of a real number.",
  },
  {
    key: "teaser",
    name: "3 · Three tiles",
    note: "Streak, win rate, points - the three that matter, at half the height of the full panel. Fits on a phone without pushing the share button under the fold, which the full panel risks on a small screen.",
  },
  {
    key: "strip",
    name: "4 · Just the strip",
    note: "No stats at all - the reveal exactly as it is now, plus one green bar at the bottom. The smallest possible change and the one least likely to break the dialog's height; it just makes the ask arrive at the right moment instead of one click later.",
  },
];

// WHAT A GUEST'S RECORD ACTUALLY IS, from the board in front of them.
//
// Every number here is TRUE - they did play one board and they did solve
// it in four - it is simply a record with one game in it. Nothing is
// invented, which matters: the whole pitch is that this is theirs and
// they are about to lose it.
export function guestStats(state: PuzzleState): NameplateStats {
  const solved = state.solved;
  const used = state.guessesUsed;
  const distribution: Record<string, number> = {};
  for (let i = 1; i <= state.maxGuesses; i++) distribution[String(i)] = 0;
  if (solved) distribution[String(used)] = 1;
  return {
    played: 1,
    won: solved ? 1 : 0,
    winRate: solved ? 1 : 0,
    avgGuesses: solved ? used : null,
    currentStreak: solved ? 1 : 0,
    maxStreak: solved ? 1 : 0,
    solvedToday: solved,
    maxGuesses: state.maxGuesses,
    distribution,
  };
}

function JoinButton({ onJoin, label }: { onJoin: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onJoin}
      className="puzzle-press w-full px-5 py-3 text-[.92rem]"
      style={{
        fontFamily: "var(--font-display)",
        background: "linear-gradient(135deg, #4ade80, #22c55e)",
        color: "#04240f",
        border: EDGE,
        borderRadius: 12,
        boxShadow: `3px 4px 0 ${INK}`,
      }}
    >
      {label}
    </button>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl px-2 py-2.5" style={{ background: FIELD, border: CARD_EDGE }}>
      <span className="text-[1.05rem] leading-none" style={{ fontFamily: "var(--font-display)", color: TEXT }}>
        {value}
      </span>
      <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="text-[8.5px]" style={{ color: MUTED }}>{sub ?? ""}</span>
    </div>
  );
}

// The block that goes under the result, inside the same dialog.
export function JoinPitch({
  kind,
  state,
  onJoin,
}: {
  kind: PitchKey;
  state: PuzzleState;
  onJoin: () => void;
}) {
  const stats = guestStats(state);
  const solved = state.solved;
  // Somebody who ran out has no result to keep, so the pitch is the
  // opposite one: an account is how tomorrow's gets kept.
  const headline = solved ? "THIS IS YOUR RECORD SO FAR" : "OUT OF GUESSES";
  const body = solved
    ? "It lives in this browser and nowhere else. Sign in to keep it, start a streak, and put the points on the board."
    : "Sign in and tomorrow's result is kept, the streak starts, and the points go on the board.";

  return (
    <div className="w-full" style={{ borderTop: CARD_EDGE, paddingTop: 14 }}>
      <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
        {kind === "strip" ? " " : headline}
      </p>

      {kind === "record" && solved && <NameplateStatsPanel stats={stats} highlight={state.guessesUsed} />}

      {kind === "locked" && (
        <div className="relative">
          {/* The real panel underneath, blurred and inert - so the shape
              is honest about what an account gives, and no number on it
              is being claimed. aria-hidden and pointer-events-none: it
              is a picture of a panel, not a panel. */}
          <div aria-hidden className="pointer-events-none select-none" style={{ filter: "blur(4.5px)", opacity: 0.5 }}>
            <NameplateStatsPanel stats={stats} highlight={state.guessesUsed} />
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <span
              className="rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: "rgba(3,7,15,0.86)", border: CARD_EDGE, color: TEXT }}
            >
              Sign in to start tracking
            </span>
          </div>
        </div>
      )}

      {kind === "teaser" && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Tile label="Streak" value={solved ? "1" : "0"} sub={solved ? "in a row" : undefined} />
          <Tile label="Win rate" value={solved ? "100%" : "0%"} sub="1 board" />
          <Tile label="Points" value={solved ? `+${state.pointsAwarded || 300 - 25 * (state.guessesUsed - 1)}` : "0"} sub="today" />
        </div>
      )}

      <p className="mt-2.5 text-center text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
        {body}
      </p>
      <div className="mt-2.5">
        <JoinButton onJoin={onJoin} label={solved ? "SAVE MY RESULT" : "START TRACKING"} />
      </div>
      <p className="mt-1.5 text-center text-[11px]" style={{ color: MUTED }}>
        Free, and it takes a few seconds.
      </p>
    </div>
  );
}
