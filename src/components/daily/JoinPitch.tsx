"use client";

import type { NameplateStats } from "@/lib/supabase/nameplateStats";
import type { PuzzleState } from "@/lib/supabase/dailyPuzzle";
import { NameplateStatsPanel } from "@/components/NameplateStats";
import { CARD_EDGE, EDGE, INK, MUTED, TEXT } from "@/lib/nameplateTheme";

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
// something with it: the stats panel an account would give them, blurred
// behind a lock. Chosen out of four - the panel filled in for real, a
// three-tile teaser, and a plain strip with no stats at all.
//
// Blurred rather than filled in, and that is the honest choice: a real
// panel off one board reads "win rate 100%, streak 1", which is true and
// still oversells. A locked one says what they are missing without
// claiming a number.

// How much of the blurred panel shows before it fades out. Enough for
// the four tiles and the very top of the distribution, which is what
// makes it read as a real panel with more below rather than as a grey
// box.
//
// Tuned against the fold, not by eye. At 118 the sign-in button ended
// 725px into a 730px screen - visible, but by five pixels, which is not
// a margin, it is luck. This leaves about thirty.
const LOCKED_H = 92;

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

// The block that goes under the result, inside the same dialog.
export function JoinPitch({ state, onJoin }: { state: PuzzleState; onJoin: () => void }) {
  // ONLY EVER THE SOLVED CASE. A guest who ran out never sees a reveal
  // for this to sit under - their board deliberately never learns the
  // answer - so they still get GuestFinish standing alone, which is the
  // right shape for them: being told to sign in IS their result.
  const stats = guestStats(state);

  return (
    <div className="w-full" style={{ borderTop: CARD_EDGE, paddingTop: 14 }}>
      <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
        KEEP YOUR RECORD
      </p>

      <div className="relative">
          {/* The real panel underneath, blurred and inert - so the shape
              is honest about what an account gives, and no number on it
              is being claimed. aria-hidden and pointer-events-none: it
              is a picture of a panel, not a panel.
              
              CROPPED, and the crop is doing two jobs. At full height it
              pushed the sign-in button 46px below the fold on a 390x730
              phone, which is the exact failure this whole change exists
              to fix, just moved one screen along. And a panel that fades
              out at the bottom says "there is more of this" better than
              a complete one does - the thing being sold is the part you
              cannot see. */}
          <div
            aria-hidden
            className="pointer-events-none select-none overflow-hidden"
            style={{
              filter: "blur(4.5px)",
              opacity: 0.5,
              maxHeight: LOCKED_H,
              // Fades rather than cuts. A hard edge reads as a rendering
              // bug; this reads as depth.
              maskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
            }}
          >
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

      {/* Accurate about what is being offered. An earlier draft said
          "this is your record so far" over a panel that is deliberately
          blurred, which claims they have a record AND hides it - and
          they do not have one, that is the whole pitch. Signing in is
          what starts it, and today's board is what goes in it first:
          the handover replays a guest's guesses through the real
          function, so the result really does survive. */}
      <p className="mt-2.5 text-center text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
        Win rate, streaks and your guess distribution, from your first board on. Sign in and today&rsquo;s
        result is the one it starts with.
      </p>
      <div className="mt-2.5">
        <JoinButton onJoin={onJoin} label="SAVE MY RESULT" />
      </div>
      <p className="mt-1.5 text-center text-[11px]" style={{ color: MUTED }}>
        Free, and it takes a few seconds.
      </p>
    </div>
  );
}
