"use client";

import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DECKS, cardsFor, customCards, CUSTOM_LEN, CUSTOM_MAX, type DeckKey, type Pair } from "@/lib/wavelength/spectrums";
import { startGame, reduce, COOP_ROUNDS, pairedRunLength, potMax, type Mode, type WavelengthState, type WavelengthAction } from "@/lib/wavelength/engine";
import { WavelengthBoard } from "@/components/wavelength/Board";
import { Dial } from "@/components/wavelength/Dial";
import { WaveStyles } from "@/components/wavelength/OverlayBoard";
import { OverlayLink } from "@/components/versus/OverlayLink";
import { useWaveRoomCode, useWaveBroadcast } from "@/components/wavelength/useWaveRoom";
import { JoinLink } from "@/components/wavelength/JoinLink";
import { PLAYER_COLORS } from "@/components/versus/style";

// THE CONTROL BOARD, played in the room. Both teams act on this one
// screen - which is how you play it sitting round a table, and is also
// what a host does on a stream while the viewers watch the OBS overlay.
//
// Same arrangement as the draft, deliberately: the rules are a pure
// reducer in src/lib/wavelength/engine.ts, the game lives here because it
// has two consumers - the board that draws it and the room that
// broadcasts it - and this page only reduces actions.
//
// Deliberately unlinked - see layout.tsx.

// WHICH DECK, IN THE URL, for the same reason the draft puts its mode
// there: a refresh is the normal way to start over, and without this it
// dumps you back on a picker to choose the deck you were already using.
const DECK_PARAM = "deck";
const NAMES_KEY = "pickem:wavelength-teams";
const MODE_KEY = "pickem:wavelength-mode";
const PAIRS_KEY = "pickem:wavelength-pairs";
const UNDO_DEPTH = 40;

// The team names as an EXTERNAL STORE rather than state restored in an
// effect. localStorage does not exist on the server, so a useState
// initialiser reading it hands React markup that disagrees with the HTML
// it is hydrating - and restoring it afterwards is a cascading render.
const DEFAULT_NAMES = ["Team 1", "Team 2"];
const listeners = new Set<() => void>();
// The snapshot has to be referentially stable between reads or
// useSyncExternalStore re-renders forever.
let namesCache: string[] | null = null;

function readNames(): string[] {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((n) => typeof n === "string")) {
      return parsed.map((n) => n.slice(0, 18));
    }
  } catch {
    // Private mode, blocked storage, somebody's corrupted value. The
    // defaults are perfectly usable; none of this is worth an error.
  }
  return DEFAULT_NAMES;
}

function subscribeNames(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function namesSnapshot(): string[] {
  if (namesCache === null) namesCache = readNames();
  return namesCache;
}

function serverNames(): string[] {
  return DEFAULT_NAMES;
}

function writeNames(next: string[]) {
  namesCache = next;
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(next));
  } catch {
    // Not worth failing a game over.
  }
  for (const cb of listeners) cb();
}

// WHICH GAME IT IS, remembered the same way and for the same reason as the
// names: a room that plays co-op plays co-op all night, and being asked
// again every single game is the wrong default.
const modeListeners = new Set<() => void>();
let modeCache: Mode | null = null;

function subscribeMode(cb: () => void): () => void {
  modeListeners.add(cb);
  return () => {
    modeListeners.delete(cb);
  };
}

function modeSnapshot(): Mode {
  if (modeCache === null) {
    try {
      modeCache = localStorage.getItem(MODE_KEY) === "coop" ? "coop" : "teams";
    } catch {
      modeCache = "teams";
    }
  }
  return modeCache;
}

function serverMode(): Mode {
  return "teams";
}

function writeMode(next: Mode) {
  modeCache = next;
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    // Not worth failing a game over.
  }
  for (const cb of modeListeners) cb();
}

// THE PAIRS SOMEBODY WROTE, kept the same way as the names and for the
// same reason: you write a set of prompts for a bit, and being asked to
// type them again next time is the difference between using this and not.
const pairListeners = new Set<() => void>();
let pairsCache: Pair[] | null = null;

function readPairs(): Pair[] {
  try {
    const raw = localStorage.getItem(PAIRS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((p) => p && typeof p.left === "string" && typeof p.right === "string")
        .slice(0, CUSTOM_MAX)
        .map((p) => ({ left: p.left.slice(0, CUSTOM_LEN), right: p.right.slice(0, CUSTOM_LEN) }));
    }
  } catch {
    // Blocked storage or somebody's corrupted value. An empty list is a
    // perfectly good starting point.
  }
  return [];
}

function subscribePairs(cb: () => void): () => void {
  pairListeners.add(cb);
  return () => {
    pairListeners.delete(cb);
  };
}

function pairsSnapshot(): Pair[] {
  if (pairsCache === null) pairsCache = readPairs();
  return pairsCache;
}

const NO_PAIRS: Pair[] = [];
function serverPairs(): Pair[] {
  return NO_PAIRS;
}

function writePairs(next: Pair[]) {
  pairsCache = next.slice(0, CUSTOM_MAX);
  try {
    localStorage.setItem(PAIRS_KEY, JSON.stringify(pairsCache));
  } catch {
    // Not worth failing a game over.
  }
  for (const cb of pairListeners) cb();
}

// THE SEED SITS HERE, beside the state rather than inside it. It is what
// deals every round after the first, and the state is the thing that gets
// broadcast - see the note above startGame(). Keeping it out here is what
// stops the overlay being handed enough to work the target out for itself.
type Game = { deck: DeckKey; seed: string; state: WavelengthState; past: WavelengthState[] };

// Module scope on purpose. Math.random() called inside a component is
// something React's lint is right to be suspicious of - a component must
// be safe to re-render - and hoisting it out says plainly that this is a
// one-off draw made when a button is pressed, not a value the render
// depends on.
function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isDeckKey(value: string | null): value is DeckKey {
  return DECKS.some((d) => d.key === value);
}

function WavelengthInner() {
  const params = useSearchParams();
  const router = useRouter();

  const urlDeck = params.get(DECK_PARAM);
  const picked = isDeckKey(urlDeck) ? urlDeck : null;
  const [deckKey, setDeckKey] = useState<DeckKey>(picked ?? DECKS[0].key);

  const names = useSyncExternalStore(subscribeNames, namesSnapshot, serverNames);
  const mode = useSyncExternalStore(subscribeMode, modeSnapshot, serverMode);
  const pairs = useSyncExternalStore(subscribePairs, pairsSnapshot, serverPairs);
  // What "Your own" would actually deal: blank rows are not cards.
  const written = customCards(pairs);
  // HOW LONG A CO-OP RUN IS. A written deck is played through twice, so
  // each of you is the psychic on every prompt you bothered to write;
  // anything off one of the big decks stops after five, because eighty-
  // eight cards twice is not an evening.
  const runLength = deckKey === "custom" ? pairedRunLength(written) : COOP_ROUNDS;
  // THE UNDO STACK LIVES INSIDE THE GAME, not beside it. An undo is just
  // going back to a state the reducer already produced - but it has to be
  // the same piece of state as the game, because pushing to a second
  // useState from inside this one's updater is a side effect in a
  // function React is allowed to call twice, and in StrictMode it does.
  const [game, setGame] = useState<Game | null>(null);

  const { code, rotate } = useWaveRoomCode();
  // Joined before the game starts, so the overlay can be set up in OBS and
  // confirmed working while there is still time to fix it.

  const step: "pick" | "setup" = picked ? "setup" : "pick";

  function choose(next: DeckKey) {
    setDeckKey(next);
    router.push(`/wavelength?${DECK_PARAM}=${next}`);
  }

  function start() {
    const seed = newSeed();
    setGame({
      deck: deckKey,
      seed,
      state: startGame(cardsFor(deckKey, pairs), deckKey, names.map((n, i) => n.trim() || `Player ${i + 1}`), seed, mode, runLength),
      past: [],
    });
  }

  const act = useCallback((action: WavelengthAction, record = true) => {
    setGame((g) => {
      if (!g) return g;
      const next = reduce(g.state, action, cardsFor(g.deck, pairsSnapshot()), g.seed);
      // A rejected action returns the same state. Pushing it would make
      // UNDO burn a press doing nothing.
      if (next === g.state) return g;
      return { ...g, state: next, past: record ? [...g.past, g.state].slice(-UNDO_DEPTH) : g.past };
    });
  }, []);

  // A GUEST'S HAND ON THE DIAL, reduced exactly like a local drag - not
  // recorded on the undo stack, because a knob being turned is not a move
  // somebody made. The reducer refuses it outright in any phase where the
  // dial is not live, so nothing here has to check.
  const onMove = useCallback((value: number) => act({ type: "guess", value }, false), [act]);
  const { live, viewers } = useWaveBroadcast(code, game?.deck ?? deckKey, game?.state ?? null, onMove);

  const undo = useCallback(() => {
    setGame((g) => {
      if (!g || g.past.length === 0) return g;
      return { ...g, state: g.past[g.past.length - 1], past: g.past.slice(0, -1) };
    });
  }, []);

  if (game) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 pb-10 pt-3">
        <WavelengthBoard
          state={game.state}
          deckTitle={(DECKS.find((d) => d.key === game.deck) ?? DECKS[0]).title}
          onAction={act}
          onUndo={undo}
          canUndo={game.past.length > 0}
          // Back to the setup screen, not the picker: the overwhelming
          // next move after a game is the same two teams going again.
          onRestart={() => setGame(null)}
        />
        <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} path="/wavelength/overlay" />
        <JoinLink code={code} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-16 pt-10">
      {/* The dial in the rules panel below has a lid, and a lid without
          the keyframes is just a lid that never opens - so the graphic's
          stylesheet has to be on this page too, not only inside the
          OverlayBoard the board screen renders. */}
      <WaveStyles />
      <h1 className="text-center text-[clamp(1.6rem,7vw,2.6rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        WAVELENGTH
      </h1>
      <p className="mt-2 text-center text-sm text-white/50">
        One word, two ends of a spectrum, and a target only the psychic can see.
      </p>

      {step === "pick" ? (
        <div className="mt-7 flex flex-col gap-3">
          {DECKS.map((d) => {
            const on = d.key === deckKey;
            // A card each rather than a select, because the two decks are
            // a real choice about what the room is playing and the sample
            // card underneath is what actually tells you.
            // The built-in decks carry their own; the custom one shows the
            // first thing actually written rather than a made-up example.
            const sample = d.key === "custom" ? written[0] : d.cards[0];
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDeckKey(d.key)}
                aria-pressed={on}
                className="rounded-2xl px-4 py-4 text-left transition-colors"
                style={{
                  background: on ? "rgba(58,168,255,0.10)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${on ? PLAYER_COLORS[0] : "rgba(255,255,255,0.12)"}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="text-[15px] tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-display)", color: on ? "#ffffff" : "rgba(255,255,255,0.8)" }}
                  >
                    {d.title.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-white/35">
                    {(d.key === "custom" ? written.length : d.cards.length)} cards
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-white/45">{d.note}</p>
                {sample && (
                  <p className="mt-2 text-[12px] text-white/60">
                    <span className="text-white/35">e.g.</span> {sample.left} &nbsp;&harr;&nbsp; {sample.right}
                  </p>
                )}
                {d.key === "custom" && !sample && (
                  <p className="mt-2 text-[12px] text-white/35">Nothing written yet.</p>
                )}
              </button>
            );
          })}

          {/* THE EDITOR, and only when it is the deck being used. Two
              boxes and a button: the whole feature is "let us type our
              own", and a form with more in it than that would be in the
              way of the four prompts somebody actually wanted. */}
          {deckKey === "custom" && (
            <div className="rounded-2xl px-4 py-4" style={{ border: "2px solid rgba(255,255,255,0.12)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] tracking-[0.16em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
                  YOUR PAIRS
                </span>
                <span className="text-[11px] text-white/30">
                  {written.length} ready{pairs.length > written.length ? ` · ${pairs.length - written.length} unfinished` : ""}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {pairs.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={pair.left}
                      onChange={(e) =>
                        writePairs(pairs.map((p, j) => (j === i ? { ...p, left: e.target.value } : p)))
                      }
                      placeholder="Worst team"
                      maxLength={CUSTOM_LEN}
                      className="min-w-0 flex-1 rounded-lg border bg-white/[0.05] px-2.5 py-2 text-[13px] outline-none transition-colors focus:border-white/45"
                      style={{ borderColor: "rgba(255,255,255,0.12)" }}
                    />
                    <span className="shrink-0 text-white/25">&harr;</span>
                    <input
                      value={pair.right}
                      onChange={(e) =>
                        writePairs(pairs.map((p, j) => (j === i ? { ...p, right: e.target.value } : p)))
                      }
                      placeholder="Best team"
                      maxLength={CUSTOM_LEN}
                      className="min-w-0 flex-1 rounded-lg border bg-white/[0.05] px-2.5 py-2 text-[13px] outline-none transition-colors focus:border-white/45"
                      style={{ borderColor: "rgba(255,255,255,0.12)" }}
                    />
                    <button
                      type="button"
                      onClick={() => writePairs(pairs.filter((_, j) => j !== i))}
                      aria-label={`Remove pair ${i + 1}`}
                      className="shrink-0 rounded-lg px-2 py-2 text-[13px] text-white/35 transition-colors hover:bg-white/10 hover:text-white/70"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => writePairs([...pairs, { left: "", right: "" }])}
                disabled={pairs.length >= CUSTOM_MAX}
                className="mt-3 w-full rounded-lg py-2.5 text-[11px] tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                style={{ fontFamily: "var(--font-display)", border: "2px dashed rgba(255,255,255,0.14)" }}
              >
                + ADD A PAIR
              </button>

              <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/35">
                Left end first. They are kept in this browser, so they are still here next time
                &mdash; and both ends have to be filled in for a pair to be dealt.
              </p>
            </div>
          )}

          <button
            onClick={() => choose(deckKey)}
            disabled={deckKey === "custom" && written.length === 0}
            className="mt-2 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99] disabled:opacity-40"
            style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
          >
            USE THIS DECK
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ border: "2px solid rgba(255,255,255,0.12)" }}>
            <span className="text-[14px] tracking-[0.1em]" style={{ fontFamily: "var(--font-display)" }}>
              {(DECKS.find((d) => d.key === deckKey) ?? DECKS[0]).title.toUpperCase()}
            </span>
            <button
              onClick={() => router.push("/wavelength")}
              className="text-[11px] text-white/40 underline underline-offset-2 hover:text-white/70"
            >
              Change
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {names.map((name, i) => (
              <label key={i} className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[0.16em]" style={{ fontFamily: "var(--font-display)", color: PLAYER_COLORS[i] }}>
                  {mode === "coop" ? `PLAYER ${i + 1}` : `TEAM ${i + 1}`}
                </span>
                <input
                  value={name}
                  onChange={(e) => writeNames(names.map((n, j) => (j === i ? e.target.value : n)))}
                  maxLength={18}
                  className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[14px] outline-none transition-colors focus:border-white/45"
                />
              </label>
            ))}
          </div>

          {/* HOW IT IS BEING PLAYED. Two buttons rather than a switch,
              because these are two different games rather than a setting
              on one - and most nights it is two people at a desk, not two
              teams, so co-op is not the afterthought it sounds like. */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {([
              { key: "teams" as const, title: "TEAM VS TEAM", note: `First to ${10}. The other side calls which way you missed.` },
              {
                key: "coop" as const,
                title: "CO-OP",
                note:
                  deckKey === "custom"
                    ? `Both of you, ${runLength} rounds — each pair twice — ${potMax(runLength)} points.`
                    : `Both of you, ${runLength} rounds, ${potMax(runLength)} points on the table.`,
              },
            ]).map((m) => {
              const on = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => writeMode(m.key)}
                  aria-pressed={on}
                  className="rounded-2xl px-3.5 py-3 text-left transition-colors"
                  style={{
                    background: on ? "rgba(0,227,95,0.10)" : "rgba(255,255,255,0.04)",
                    border: `2px solid ${on ? "#3ecb78" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  <span
                    className="block text-[12.5px] tracking-[0.14em]"
                    style={{ fontFamily: "var(--font-display)", color: on ? "#8fe9b4" : "rgba(255,255,255,0.75)" }}
                  >
                    {m.title}
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-snug text-white/45">{m.note}</span>
                </button>
              );
            })}
          </div>

          {/* WHAT THE GAME IS, for the half of the room that has never
              played it. Three lines, because anything longer does not get
              read while people are waiting to start. */}
          <div className="mt-5 flex items-center gap-4 rounded-2xl px-4 py-4" style={{ border: "2px solid rgba(255,255,255,0.10)" }}>
            <Dial width={150} left="Cold" right="Hot" target={68} guess={54} open />
            <ol className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/50">
              <li>1. The psychic holds a button and the dial opens &mdash; on every screen.</li>
              <li>2. They say one clue out loud. The other drags the needle.</li>
              <li>3. {mode === "coop" ? "Open the dial and bank the points." : "The other team calls which side it really is on."}</li>
            </ol>
          </div>

          <button
            onClick={start}
            className="mt-4 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
            style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
          >
            START THE GAME
          </button>

          <div className="mt-6 flex flex-col gap-4">
            <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} path="/wavelength/overlay" />
            <JoinLink code={code} />
          </div>
        </>
      )}
    </main>
  );
}

export default function WavelengthPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <WavelengthInner />
    </Suspense>
  );
}
