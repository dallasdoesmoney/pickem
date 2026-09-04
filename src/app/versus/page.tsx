"use client";

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, reduce, AuctionState, AuctionAction } from "@/lib/auction/engine";
import { AuctionBoard } from "@/components/versus/AuctionBoard";
import { OverlayLink } from "@/components/versus/OverlayLink";
import { GameSelect, ChosenDraft } from "@/components/versus/GameSelect";
import { useRoomCode, useBroadcast } from "@/components/versus/useRoom";
import { SPIN_MS } from "@/components/versus/style";

// THE CONTROL BOARD. Both players act on this one screen - which is how
// you play it sitting next to somebody, and is also what a host does on a
// stream while the viewers watch the OBS overlay.
//
// The game lives HERE rather than in AuctionBoard, because it has two
// consumers now: the board that draws it and the room that broadcasts it.
// The rules stay in src/lib/auction/engine.ts as a pure function, so this
// page reduces actions rather than knowing any of them.
//
// Deliberately unlinked - see layout.tsx.
const formats = Object.values(AUCTION_FORMATS);

// WHICH DRAFT, IN THE URL. Without it every refresh dumped you back on
// the picker to choose the mode you were already playing - and a refresh
// is the normal way to start a draft over.
//
// A query parameter rather than a path segment, because /versus/overlay
// is a real route and a dynamic segment beside it would collide with any
// format ever slugged "overlay". The names ride along in localStorage so
// a reload comes back ready to press START rather than ready to retype
// two names.
const DRAFT_PARAM = "draft";
const NAMES_KEY = "pickem:versus-names";

// The two names as an EXTERNAL STORE rather than React state restored in
// an effect. localStorage does not exist on the server, so a plain
// useState initialiser reading it hands React markup that disagrees with
// the HTML it is hydrating - and restoring it in an effect afterwards is
// a cascading render that the lint rule is right to refuse.
//
// useSyncExternalStore is the shape this actually is: a value that lives
// outside React, with a separate answer for the server. Editing writes
// through, so the names are saved as they are typed rather than at the
// moment somebody presses START.
const DEFAULT_NAMES = ["Player 1", "Player 2"];
const nameListeners = new Set<() => void>();
// The snapshot has to be REFERENTIALLY STABLE between reads or
// useSyncExternalStore re-renders forever, so it is cached and only
// replaced when something writes.
let namesCache: string[] | null = null;

function readNames(): string[] {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((n) => typeof n === "string")) {
      return parsed.map((n) => n.slice(0, 18));
    }
  } catch {
    // Private mode, blocked storage, someone's corrupted value. The
    // defaults are perfectly usable; nothing here is worth an error.
  }
  return DEFAULT_NAMES;
}

function subscribeNames(cb: () => void): () => void {
  nameListeners.add(cb);
  return () => {
    nameListeners.delete(cb);
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
    // Same as reading: not worth failing a draft over.
  }
  for (const cb of nameListeners) cb();
}

// How many moves back UNDO can reach. Deep enough to cover a whole lot
// gone wrong - a bad bid, a pass, an assignment - without holding every
// state of a long draft in memory forever.
const UNDO_DEPTH = 40;

type Game = { slug: string; state: AuctionState; past: AuctionState[] };

function VersusInner() {
  const params = useSearchParams();
  const router = useRouter();

  // The URL is the source of truth for which draft, so the back button
  // and a reload agree with the screen.
  const urlDraft = params.get(DRAFT_PARAM);
  const picked = urlDraft && AUCTION_FORMATS[urlDraft] ? urlDraft : null;
  const [slug, setSlug] = useState(picked ?? formats[0]?.slug ?? "");

  const names = useSyncExternalStore(subscribeNames, namesSnapshot, serverNames);
  // THE UNDO STACK LIVES INSIDE THE GAME, not beside it. The engine is a
  // pure reducer, so an undo is just going back to a state it already
  // produced - no inverse of "pass" to write and nothing to keep in
  // step. But it has to be the SAME piece of state as the game: pushing
  // to a second useState from inside setGame's updater would be a side
  // effect in a function React is allowed to call twice, and in
  // StrictMode it does, so every move would push two entries.
  const [game, setGame] = useState<Game | null>(null);

  const format = AUCTION_FORMATS[slug];
  const { code, rotate } = useRoomCode();

  // TWO STEPS, because this screen used to be three decisions at once -
  // which mode, both names, and the OBS link - all on screen before you
  // had made any of them. Picking the draft is the only one you cannot
  // skip, and it is the one that wants the whole screen. Which step you
  // are on is read off the URL rather than held beside it, so there is
  // one answer rather than two that can disagree.
  const step: "pick" | "setup" = picked ? "setup" : "pick";

  function choose(next: string) {
    setSlug(next);
    router.push(`/versus?${DRAFT_PARAM}=${next}`);
  }

  // Joined before a draft starts, not after. The overlay can then be set
  // up in OBS and confirmed working while the setup screen is still up -
  // the point at which there is time to fix it.
  const liveGame = game && AUCTION_FORMATS[game.slug] ? game : null;
  const { live, viewers } = useBroadcast(code, liveGame?.slug ?? slug, liveGame?.state ?? null);

  function start() {
    if (!format) return;
    // The seed is what makes a draft reproducible. Random per draft, and
    // deliberately NOT the room code - the code outlives the draft, so
    // seeding from it would deal the same cards every single time.
    const seed = Math.random().toString(36).slice(2, 10);
    setGame({ slug, state: startAuction(format, names.map((n, i) => n.trim() || `Player ${i + 1}`), seed), past: [] });
  }

  // `record` is what separates a move somebody MADE from one the board
  // made on its own. The reveal at the end of a spin is the board's, and
  // recording it would make the first undo of a lot appear to do nothing
  // at all: it would land on "spinning", whose timer immediately reveals
  // again. Skipping it means one undo goes back past the whole reel, to
  // the moment before START - which is the step a person took.
  const act = useCallback((action: AuctionAction, record = true) => {
    setGame((g) => {
      const f = g && AUCTION_FORMATS[g.slug];
      if (!g || !f) return g;
      const next = reduce(g.state, action, f);
      // A rejected action returns the same state. Pushing it would make
      // UNDO burn a press doing nothing.
      if (next === g.state) return g;
      return {
        ...g,
        state: next,
        past: record ? [...g.past, g.state].slice(-UNDO_DEPTH) : g.past,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setGame((g) => {
      if (!g || g.past.length === 0) return g;
      return { ...g, state: g.past[g.past.length - 1], past: g.past.slice(0, -1) };
    });
  }, []);

  // THE REEL LANDING. The spin is an animation, so something has to say
  // when it is over, and that something is the board - the one screen
  // that is allowed to change the game. The overlay just watches.
  //
  // Driven off the phase rather than fired alongside the click, so a
  // board that reloads mid-spin re-arms the timer and the draft carries
  // on instead of sitting on a stopped reel forever.
  const phase = liveGame?.state.phase;
  const lot = liveGame?.state.index;
  useEffect(() => {
    if (phase !== "spinning") return;
    const id = setTimeout(() => act({ type: "reveal" }, false), SPIN_MS);
    return () => clearTimeout(id);
  }, [phase, lot, act]);

  if (liveGame) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">
        <AuctionBoard
          key={liveGame.state.order.join(",")}
          format={AUCTION_FORMATS[liveGame.slug]}
          state={liveGame.state}
          onAction={act}
          onUndo={undo}
          canUndo={liveGame.past.length > 0}
          // Back to the setup screen, not the picker: the overwhelming
          // next move after a draft is the same two people going again,
          // and CHANGE is right there for the time it is not.
          onRestart={() => setGame(null)}
        />
        <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-16 pt-10">
      <h1 className="text-center text-[clamp(1.6rem,7vw,2.6rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        VERSUS
      </h1>
      <p className="mt-2 text-center text-sm text-white/50">
        Blind auction draft. $20 each, and nothing gets skipped.
      </p>

      {formats.length === 0 ? (
        <p className="mt-10 text-center text-sm text-white/45">
          No formats available &mdash; the rosters have not been synced in this checkout.
        </p>
      ) : step === "pick" ? (
        <div className="mt-6">
          <GameSelect formats={formats} slug={slug} onPick={setSlug} onConfirm={() => choose(slug)} />
        </div>
      ) : (
        <>
          {format && (
            <div className="mt-6">
              <ChosenDraft format={format} onChange={() => router.push("/versus")} />
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {names.map((name, i) => (
              <label key={i} className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[0.16em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
                  PLAYER {i + 1}
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

          <button
            onClick={start}
            className="mt-5 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
            style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
          >
            START THE DRAFT
          </button>

          {/* Still BEFORE the draft, which is the point of it being on
              this screen: the overlay can be set up in OBS and confirmed
              working while there is still time to fix it. */}
          <div className="mt-6">
            <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} />
          </div>
        </>
      )}
    </main>
  );
}

export default function VersusPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <VersusInner />
    </Suspense>
  );
}
