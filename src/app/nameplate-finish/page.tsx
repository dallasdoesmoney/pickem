"use client";

import { useState } from "react";
import { Reveal, GuestFinish } from "@/components/DailyPuzzle";
import { JoinPitch, PITCHES, guestStats, type PitchKey } from "@/components/daily/JoinPitch";
import { PUZZLE_PLAYERS } from "@/data/puzzlePlayers";
import type { PuzzleState } from "@/lib/supabase/dailyPuzzle";

// WHAT A SIGNED-OUT PLAYER SEES WHEN THEY WIN.
//
// Today it is TWO dialogs: the reveal, and then - only once they close
// it - the sign-up. Which assumes people close things. The moment
// somebody is most pleased with themselves is the moment the reveal is
// up, and the ask is not there yet; by the time it arrives they have had
// what they came for.
//
// Below: what it looks like now, then four ways to fold the ask into the
// result itself. Every one of these renders the REAL Reveal component
// from the game, not a lookalike, so the heights and the crowding are
// the ones a phone will actually get.
//
// Scratch page. It goes when one is picked.

const ANSWER = PUZZLE_PLAYERS.find((p) => p.name === "Ja'Marr Chase") ?? PUZZLE_PLAYERS[0];

// A solved board, four guesses in - the shape of the thing this dialog
// is drawn over.
function board(solved: boolean, used: number): PuzzleState {
  return {
    puzzleOn: "2026-09-04",
    puzzleNumber: 128,
    maxGuesses: 8,
    guessesUsed: used,
    guesses: [],
    solved,
    finished: true,
    pointsAwarded: solved ? 300 - 25 * (used - 1) : 0,
    answer: ANSWER
      ? { espnId: ANSWER.espnId, name: ANSWER.name, team: ANSWER.team, position: ANSWER.position }
      : null,
  };
}

const GRID = "🟩⬜⬜⬜⬜⬜\n🟩🟩⬜🟨⬜⬜\n🟩🟩🟩⬜🟨⬜\n🟩🟩🟩🟩🟩🟩";

function Frame({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
        {label.toUpperCase()}
      </h2>
      {note && <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{note}</p>}
      {/* A phone-width column, because that is where the height problem
          lives - a dialog that fits a desktop and pushes the share button
          under the fold on a 390px screen has failed at the only size
          that matters. */}
      <div className="mx-auto w-full max-w-[400px]">{children}</div>
    </section>
  );
}

export default function NameplateFinishPage() {
  const [used, setUsed] = useState(4);
  const [solved, setSolved] = useState(true);
  const state = board(solved, used);
  const noop = () => {};

  const chip = "rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] transition-colors";
  const on = { background: "rgba(0,227,95,0.14)", borderColor: "rgba(0,227,95,0.5)", color: "#dfffe9" };
  const off = { background: "transparent", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)" };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-8">
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        THE WIN SCREEN
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        What a signed-out player sees when they solve it. These are the real dialog components from the game, at
        phone width, so the heights are the ones an actual phone gets.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setSolved(true)} className={chip} style={solved ? on : off}>SOLVED</button>
        <button onClick={() => setSolved(false)} className={chip} style={!solved ? on : off}>OUT OF GUESSES</button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        {[1, 3, 4, 6].map((n) => (
          <button key={n} onClick={() => setUsed(n)} className={chip} style={used === n ? on : off}>
            IN {n}
          </button>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-16">
        <Frame
          label="Now · two dialogs"
          note="The reveal, and then the ask - but only after they close the reveal. Somebody who screenshots their grid and leaves never sees the second one at all."
        >
          <div className="flex flex-col gap-3">
            <Reveal state={state} answer={ANSWER} onShare={noop} copied={false} grid={GRID} practiceRound={null} onPlayAgain={noop} stats={null} />
            <div className="py-1 text-center text-[10px] tracking-[0.14em] text-white/30">
              &darr; ONLY AFTER THEY CLOSE IT &darr;
            </div>
            <GuestFinish solved={solved} onJoin={noop} />
          </div>
        </Frame>

        {PITCHES.map((p) => (
          <Frame key={p.key} label={p.name} note={p.note}>
            <Reveal
              state={state}
              answer={ANSWER}
              onShare={noop}
              copied={false}
              grid={GRID}
              practiceRound={null}
              onPlayAgain={noop}
              stats={null}
              footer={<JoinPitch kind={p.key as PitchKey} state={state} onJoin={noop} />}
            />
          </Frame>
        ))}

        <Frame
          label="For comparison · signed in"
          note="What the same dialog looks like for somebody who already has an account. The four variants above should feel like a version of this rather than a different screen."
        >
          <Reveal
            state={state}
            answer={ANSWER}
            onShare={noop}
            copied={false}
            grid={GRID}
            practiceRound={null}
            onPlayAgain={noop}
            stats={{ ...guestStats(state), played: 23, won: 21, winRate: 21 / 23, avgGuesses: 4.1, currentStreak: 6, maxStreak: 11, distribution: { "1": 0, "2": 1, "3": 4, "4": 9, "5": 5, "6": 2, "7": 0, "8": 0 } }}
          />
        </Frame>
      </div>
    </main>
  );
}
