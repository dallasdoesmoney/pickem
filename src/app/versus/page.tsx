"use client";

import { useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, AuctionState } from "@/lib/auction/engine";
import { AuctionBoard } from "@/components/versus/AuctionBoard";

// HOTSEAT ONLY, for now. Both players act on one screen, which is how you
// play it sitting next to somebody - and is also the version that needs no
// network at all, so the rules can be proved right before anything is
// broadcast anywhere.
//
// Remote play and the OBS overlay come next, on top of the same engine:
// the rules live in src/lib/auction/engine.ts as a pure function, so the
// networked version reduces the same actions rather than reimplementing
// them.
//
// Deliberately unlinked - see layout.tsx.
const formats = Object.values(AUCTION_FORMATS);

export default function VersusPage() {
  const [slug, setSlug] = useState(formats[0]?.slug ?? "");
  const [names, setNames] = useState(["Player 1", "Player 2"]);
  const [game, setGame] = useState<{ slug: string; state: AuctionState } | null>(null);

  const format = AUCTION_FORMATS[slug];

  function start() {
    if (!format) return;
    // The seed is what makes a draft reproducible. Random here; when rooms
    // arrive it becomes the room code, so everyone in a room deals the
    // same cards.
    const seed = Math.random().toString(36).slice(2, 10);
    setGame({ slug, state: startAuction(format, names.map((n, i) => n.trim() || `Player ${i + 1}`), seed) });
  }

  if (game && AUCTION_FORMATS[game.slug]) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-16 pt-8">
        <AuctionBoard
          key={game.state.order.join(",")}
          format={AUCTION_FORMATS[game.slug]}
          initial={game.state}
          onRestart={() => setGame(null)}
        />
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
        </>
      )}
    </main>
  );
}
