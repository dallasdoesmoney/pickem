"use client";

import { useState } from "react";
import { GAMES_BY_WEEK, CURRENT_WEEK, type Game } from "@/data/games";
import { TEAMS, type TeamAbbr } from "@/data/teams";
import { GameCard } from "@/components/GameCard";
import {
  IDEAS,
  boardModeFor,
  NudgePill,
  LoudPill,
  ModePill,
  PickerPill,
  BannerPill,
  LockBanner,
  ChoosingBar,
  type IdeaKey,
  type IdeaState,
} from "@/components/weekly/LockIdeas";

// FIVE WAYS TO MAKE THE LOCK FINDABLE, all clickable.
//
// Not pictures. Each block below is a real six-game board with real
// cards, and the lock in it actually sets - because the question is not
// "which looks nicer", it is "would you find this", and you can only
// answer that by trying to use it.
//
// Every board starts the way a session replay does: four picks made, no
// lock, which is exactly the state most people leave the page in.
//
// Scratch page. It goes when one of the five wins.

// Six games rather than sixteen: the same argument repeats down a full
// slate and a page with ninety cards on it is unreadable.
const GAMES: Game[] = (GAMES_BY_WEEK[CURRENT_WEEK] ?? []).slice(0, 6);
const START_PICKS: Record<string, TeamAbbr> = Object.fromEntries(
  GAMES.slice(0, 4).map((g, i) => [g.id, i % 2 === 0 ? g.home : g.away]),
);

function Board({
  idea,
  picks,
  setPicks,
  lockedGameId,
  setLockedGameId,
  choosing,
}: {
  idea: IdeaKey;
  picks: Record<string, TeamAbbr>;
  setPicks: (f: (p: Record<string, TeamAbbr>) => Record<string, TeamAbbr>) => void;
  lockedGameId: string | null;
  setLockedGameId: (id: string | null) => void;
  choosing: boolean;
}) {
  const mode = boardModeFor(idea, choosing, lockedGameId !== null);
  return (
    <div className="grid justify-center gap-x-6 gap-y-3 [grid-template-columns:repeat(2,minmax(0,1fr))]">
      {GAMES.map((game) => {
        const picked = picks[game.id];
        // In lock mode, a game you have not picked is not a candidate,
        // so it steps back rather than sitting there looking tappable.
        const dim = mode.choosing && !picked;
        return (
          <div
            key={game.id}
            style={{ opacity: dim ? 0.28 : 1, filter: dim ? "grayscale(1)" : undefined, transition: "opacity 200ms, filter 200ms" }}
          >
            <GameCard
              game={game}
              picked={picked}
              onPick={(team) =>
                setPicks((p) => {
                  if (p[game.id] === team) {
                    const next = { ...p };
                    delete next[game.id];
                    return next;
                  }
                  return { ...p, [game.id]: team };
                })
              }
              isLockPick={lockedGameId === game.id}
              hasLock={lockedGameId !== null}
              onToggleLock={() => setLockedGameId(lockedGameId === game.id ? null : game.id)}
              lockPrompt={mode.lockPrompt}
              scale={0.72}
              compact
            />
          </div>
        );
      })}
    </div>
  );
}

function Demo({ idea }: { idea: IdeaKey }) {
  const [picks, setPicks] = useState<Record<string, TeamAbbr>>(START_PICKS);
  const [lockedGameId, setLockedGameId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const picked = GAMES.filter((g) => picks[g.id]).map((g) => ({ gameId: g.id, team: TEAMS[picks[g.id]] }));
  const state: IdeaState = {
    picks,
    lockedGameId,
    setLock: (id) => {
      setLockedGameId(id);
      setChoosing(false);
    },
    picked,
  };

  // Choosing has to end the moment a lock lands, whichever variant set
  // it - otherwise the board stays dimmed behind a finished job.
  function chooseLock(id: string | null) {
    setLockedGameId(id);
    if (id !== null) setChoosing(false);
  }

  const showBanner = idea === "banner" && !dismissed && lockedGameId === null;

  return (
    <div className="flex flex-col gap-4">
      {showBanner && <LockBanner choosing={choosing} onChoose={() => setChoosing(!choosing)} onDismiss={() => setDismissed(true)} />}
      {(idea === "mode" || idea === "banner") && choosing && lockedGameId === null && <ChoosingBar count={picked.length} />}
      <Board
        idea={idea}
        picks={picks}
        setPicks={setPicks}
        lockedGameId={lockedGameId}
        setLockedGameId={chooseLock}
        choosing={choosing}
      />
      <div className="flex justify-center pt-3">
        {idea === "nudge" && <NudgePill state={state} />}
        {idea === "loud" && <LoudPill state={state} />}
        {idea === "mode" && <ModePill state={state} choosing={choosing} setChoosing={setChoosing} />}
        {idea === "picker" && <PickerPill state={state} />}
        {idea === "banner" && <BannerPill state={state} />}
      </div>
      <div className="flex items-center justify-center gap-3 text-[11px] text-white/35">
        <span>{lockedGameId ? `Locked: ${TEAMS[picks[lockedGameId]].name}` : "No lock set"}</span>
        <button
          type="button"
          onClick={() => {
            setPicks(START_PICKS);
            setLockedGameId(null);
            setChoosing(false);
            setDismissed(false);
          }}
          className="rounded-full border border-white/15 px-2.5 py-1 transition-colors hover:text-white/70"
        >
          RESET
        </button>
      </div>
    </div>
  );
}

export default function LockIdeasPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-8">
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        FINDING THE LOCK
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Five ways to make Lock of the Week findable. All five are live &mdash; click them. Each board starts
        where a session replay usually ends: four picks made, no lock.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/40">
        The bug underneath all of them: the padlock is only drawn on a game you have <em>already picked</em>,
        and even then at 45% opacity in greyscale, in the bottom corner, under a sticker. A fresh board has no
        padlock on it anywhere.
      </p>

      <div className="mt-10 flex flex-col gap-16">
        {IDEAS.map((idea) => (
          <section key={idea.key}>
            <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
              {idea.name.toUpperCase()}
            </h2>
            <p className="mb-6 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{idea.note}</p>
            <Demo idea={idea.key} />
          </section>
        ))}
      </div>
    </main>
  );
}
