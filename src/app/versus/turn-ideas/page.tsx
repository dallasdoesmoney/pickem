"use client";

import { useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, openLot, reduce, toAct, AuctionState } from "@/lib/auction/engine";
import type { AuctionFormat } from "@/lib/auction/format";
import { OverlayStage } from "@/components/versus/OverlayStage";
import { TURN_IDEAS } from "@/components/versus/turnIdeas";

// FIVE WAYS TO SAY WHOSE MOVE IT IS.
//
// The model has always known. headline() builds "NOAH TO OPEN" out of
// toAct(), and the spine layout draws the money and drops the words - so
// the one moment on the board with no number in it is also the one
// moment with nothing on it.
//
// All five are held at exactly that moment: a lot revealed, nobody has
// bid. The second half of the page holds the SAME five one action later,
// with a bid standing, to prove the other half of the brief - that they
// are all gone by then, because the price under the logo is already in
// the bidder's colour and two things saying one fact is one too many.
//
// Scratch page. It goes when one of the five wins.

// A lot revealed with nobody on the board yet. openLot -> spin -> reveal
// is the whole opening move; stopping before the bid is what leaves
// somebody on the clock.
function demo(format: AuctionFormat, lots: number, seed: string, withBid: boolean): AuctionState {
  let state = startAuction(format, ["NOAH", "BEN"], seed);
  for (let i = 0; i < lots && state.phase !== "done"; i++) {
    const who = state.opener;
    state = openLot(state, format);
    state = reduce(state, { type: "bid", by: who, amount: 1 + ((i * 3) % 6) }, format);
    if (state.phase === "bidding") state = reduce(state, { type: "pass", by: (who + 1) % 2 }, format);
    if (state.phase === "assigning") {
      const open = format.slots.filter((s) => state.players[state.won!.by].roster[s.key] === null);
      const item = format.items.find((it) => it.id === state.order[state.index]);
      const slot = open.find((s) => !item?.fills || s.key in item.fills);
      if (slot) state = reduce(state, { type: "assign", slotKey: slot.key }, format);
    }
  }
  if (state.phase === "done") return state;
  state = reduce(state, { type: "spin" }, format);
  state = reduce(state, { type: "reveal" }, format);
  if (withBid && state.phase === "bidding") {
    state = reduce(state, { type: "bid", by: toAct(state, format) ?? state.opener, amount: 3 }, format);
  }
  return state;
}

export default function TurnIdeasPage() {
  const formats = Object.values(AUCTION_FORMATS);
  const [slug, setSlug] = useState(formats[0]?.slug ?? "");
  const [seed, setSeed] = useState("turn-1");
  const [camTop, setCamTop] = useState(560);
  const [camBottom, setCamBottom] = useState(560);

  const format = AUCTION_FORMATS[slug];
  const waiting = format ? demo(format, 4, seed, false) : null;
  const bidding = format ? demo(format, 4, seed, true) : null;
  const clock = format && waiting ? toAct(waiting, format) : null;

  const chip = "rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] transition-colors";
  const on = { background: "rgba(0,227,95,0.14)", borderColor: "rgba(0,227,95,0.5)", color: "#dfffe9" };
  const off = { background: "transparent", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)" };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-8">
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        WHOSE TURN IT IS
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Five ways to show who opens, before anybody has bid. Every one of them switches off the instant a bid
        lands &mdash; from then on the price under the logo is already in the bidder&rsquo;s colour, and a second
        indicator on top of that is two things arguing about the same fact.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/40">
        None of them cost height. The band between the two cameras is the whole canvas, so all five are either
        absolutely positioned inside a box that already exists or a change to something already being drawn.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {formats.map((f) => (
          <button key={f.slug} onClick={() => setSlug(f.slug)} className={chip} style={f.slug === slug ? on : off}>
            {f.title.toUpperCase()}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button onClick={() => setSeed(`turn-${Math.random().toString(36).slice(2, 7)}`)} className={chip} style={off}>
          NEW DRAW
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-white/40">
        <label className="flex items-center gap-2">
          TOP CAM {camTop}px
          <input type="range" min={0} max={900} step={20} value={camTop} onChange={(e) => setCamTop(Number(e.target.value))} className="w-40" />
        </label>
        <label className="flex items-center gap-2">
          BOTTOM CAM {camBottom}px
          <input type="range" min={0} max={900} step={20} value={camBottom} onChange={(e) => setCamBottom(Number(e.target.value))} className="w-40" />
        </label>
      </div>

      {!format || !waiting || !bidding ? (
        <p className="mt-10 text-sm text-white/45">No formats available &mdash; rosters have not been synced in this checkout.</p>
      ) : (
        <>
          <p className="mt-8 text-[12px] tracking-[0.14em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
            NOBODY HAS BID &mdash; {clock === null ? "NOBODY" : waiting.players[clock].name.toUpperCase()} IS ON THE CLOCK
          </p>

          <div className="mt-4 flex flex-col gap-12">
            {TURN_IDEAS.map((idea) => (
              <section key={idea.key}>
                <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
                  {idea.name.toUpperCase()}
                </h2>
                <p className="mb-3 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{idea.note}</p>
                <OverlayStage state={waiting} format={format} camTop={camTop} camBottom={camBottom} mode="band" turn={idea.key} />
                <a
                  href={`/versus/overlay?preview=1&phase=open&turn=${idea.key}&lots=4&top=${camTop}&bottom=${camBottom}&p1=Noah&p2=Ben&seed=${seed}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11px] text-white/45 underline underline-offset-2 hover:text-white/75"
                >
                  Open full size
                </a>
              </section>
            ))}
          </div>

          {/* The other half of the brief. One action later, all five are
              gone - and they have to be gone identically, or "only before
              the first bid" is a claim rather than a fact. */}
          <p className="mt-16 text-[12px] tracking-[0.14em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
            ONE BID IN &mdash; EVERY INDICATOR IS OFF
          </p>
          <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">
            The same five, one action later. They should be indistinguishable from each other and from the board
            as it looks today.
          </p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {TURN_IDEAS.map((idea) => (
              <div key={idea.key}>
                <div className="mb-1 text-[10px] tracking-[0.14em] text-white/35">{idea.name.toUpperCase()}</div>
                <OverlayStage state={bidding} format={format} camTop={camTop} camBottom={camBottom} mode="band" turn={idea.key} />
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
