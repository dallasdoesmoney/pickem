"use client";

import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DECKS, deck, type DeckKey } from "@/lib/wavelength/spectrums";
import { startGame, reduce, type WavelengthState, type WavelengthAction } from "@/lib/wavelength/engine";
import { WavelengthBoard } from "@/components/wavelength/Board";
import { Dial } from "@/components/wavelength/Dial";
import { OverlayLink } from "@/components/versus/OverlayLink";
import { useWaveRoomCode, useWaveBroadcast } from "@/components/wavelength/useWaveRoom";
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

type Game = { deck: DeckKey; state: WavelengthState; past: WavelengthState[] };

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
  // THE UNDO STACK LIVES INSIDE THE GAME, not beside it. An undo is just
  // going back to a state the reducer already produced - but it has to be
  // the same piece of state as the game, because pushing to a second
  // useState from inside this one's updater is a side effect in a
  // function React is allowed to call twice, and in StrictMode it does.
  const [game, setGame] = useState<Game | null>(null);

  const { code, rotate } = useWaveRoomCode();
  // Joined before the game starts, so the overlay can be set up in OBS and
  // confirmed working while there is still time to fix it.
  const { live, viewers } = useWaveBroadcast(code, game?.deck ?? deckKey, game?.state ?? null);

  const step: "pick" | "setup" = picked ? "setup" : "pick";

  function choose(next: DeckKey) {
    setDeckKey(next);
    router.push(`/wavelength?${DECK_PARAM}=${next}`);
  }

  function start() {
    const seed = Math.random().toString(36).slice(2, 10);
    setGame({
      deck: deckKey,
      state: startGame(deck(deckKey), deckKey, names.map((n, i) => n.trim() || `Team ${i + 1}`), seed),
      past: [],
    });
  }

  const act = useCallback((action: WavelengthAction, record = true) => {
    setGame((g) => {
      if (!g) return g;
      const next = reduce(g.state, action, deck(g.deck));
      // A rejected action returns the same state. Pushing it would make
      // UNDO burn a press doing nothing.
      if (next === g.state) return g;
      return { ...g, state: next, past: record ? [...g.past, g.state].slice(-UNDO_DEPTH) : g.past };
    });
  }, []);

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
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-16 pt-10">
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
            const sample = d.cards[0];
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
                  <span className="text-[11px] text-white/35">{d.cards.length} cards</span>
                </div>
                <p className="mt-1 text-[12.5px] text-white/45">{d.note}</p>
                <p className="mt-2 text-[12px] text-white/60">
                  <span className="text-white/35">e.g.</span> {sample.left} &nbsp;&harr;&nbsp; {sample.right}
                </p>
              </button>
            );
          })}

          <button
            onClick={() => choose(deckKey)}
            className="mt-2 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
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
                  TEAM {i + 1}
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

          {/* WHAT THE GAME IS, for the half of the room that has never
              played it. Three lines, because anything longer does not get
              read while people are waiting to start. */}
          <div className="mt-5 flex items-center gap-4 rounded-2xl px-4 py-4" style={{ border: "2px solid rgba(255,255,255,0.10)" }}>
            <Dial width={150} left="Cold" right="Hot" target={68} guess={54} open />
            <ol className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/50">
              <li>1. The psychic holds a button and the dial opens, for them.</li>
              <li>2. They give one clue. Their team drags the needle.</li>
              <li>3. The other team calls which side it really is on.</li>
            </ol>
          </div>

          <button
            onClick={start}
            className="mt-4 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
            style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
          >
            START THE GAME
          </button>

          <div className="mt-6">
            <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} path="/wavelength/overlay" />
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
