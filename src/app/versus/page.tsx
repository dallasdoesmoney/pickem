"use client";

import { useCallback, useEffect, useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, reduce, AuctionState, AuctionAction } from "@/lib/auction/engine";
import { AuctionBoard } from "@/components/versus/AuctionBoard";
import { OverlayLink } from "@/components/versus/OverlayLink";
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

export default function VersusPage() {
  const [slug, setSlug] = useState(formats[0]?.slug ?? "");
  const [names, setNames] = useState(["Player 1", "Player 2"]);
  const [game, setGame] = useState<{ slug: string; state: AuctionState } | null>(null);

  const format = AUCTION_FORMATS[slug];
  const { code, rotate } = useRoomCode();

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
    setGame({ slug, state: startAuction(format, names.map((n, i) => n.trim() || `Player ${i + 1}`), seed) });
  }

  const act = useCallback((action: AuctionAction) => {
    setGame((g) => {
      const f = g && AUCTION_FORMATS[g.slug];
      return g && f ? { ...g, state: reduce(g.state, action, f) } : g;
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
    const id = setTimeout(() => act({ type: "reveal" }), SPIN_MS);
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
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-2">
            {formats.map((f) => (
              <button
                key={f.slug}
                onClick={() => setSlug(f.slug)}
                className="rounded-2xl border px-4 py-3 text-left transition-colors"
                style={{
                  background: "#101d38",
                  borderColor: f.slug === slug ? "rgba(62,203,120,0.55)" : "rgba(255,255,255,0.12)",
                }}
              >
                <div className="text-[14px] tracking-[0.1em]" style={{ fontFamily: "var(--font-display)" }}>
                  {f.title.toUpperCase()}
                </div>
                <div className="mt-1 text-[12.5px] text-white/50">{f.tagline}</div>
                <div className="mt-1.5 text-[11px] text-white/30">
                  {f.slots.map((s) => s.label).join(" · ")} &mdash; ${f.budget} each
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {names.map((name, i) => (
              <label key={i} className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[0.16em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
                  PLAYER {i + 1}
                </span>
                <input
                  value={name}
                  onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                  maxLength={18}
                  className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[14px] outline-none transition-colors focus:border-white/45"
                />
              </label>
            ))}
          </div>

          <button
            onClick={start}
            className="mt-6 rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
            style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
          >
            START THE DRAFT
          </button>

          <div className="mt-6">
            <OverlayLink code={code} live={live} viewers={viewers} onRotate={rotate} />
          </div>
        </>
      )}
    </main>
  );
}
