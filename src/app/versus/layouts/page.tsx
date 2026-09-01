"use client";

import { useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, openLot, reduce, toAct, AuctionState } from "@/lib/auction/engine";
import type { AuctionFormat } from "@/lib/auction/format";
import { OverlayStage } from "@/components/versus/OverlayStage";
import { PICK_CARDS, DEFAULT_PICK, type PickKey } from "@/components/versus/layouts";

// FIVE WAYS TO DRAW A PICK, side by side, with real teams in them.
//
// Choosing out of a description does not work - the question is always
// "how much room does it actually take, and can you read it", and both
// are answers you can only get by looking. So this draws all five from
// the same position of the same draft, at the same scale.
//
// The layout question is settled (the spine), so this compares the thing
// that is repeated ten times inside it instead. Scratch page: it goes
// when one is picked.

const MOMENTS = [
  { key: "bidding", label: "Mid-auction", lots: 6 },
  { key: "ready", label: "Lot not started", lots: 6 },
  { key: "spinning", label: "Reel spinning", lots: 6 },
  { key: "full", label: "Late, rosters full", lots: 9 },
] as const;

function demo(format: AuctionFormat, lots: number, phase: string, seed: string): AuctionState {
  let state = startAuction(format, ["NOAH", "BEN"], seed);
  for (let i = 0; i < lots && state.phase !== "done"; i++) {
    const who = state.opener;
    state = openLot(state, format);
    // At least a dollar: the floor belongs to whoever is on the clock,
    // so $0 is not a legal opening bid any more.
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
  if (phase === "ready") return state;
  state = reduce(state, { type: "spin" }, format);
  if (phase === "spinning") return state;
  state = reduce(state, { type: "reveal" }, format);
  if (state.phase === "bidding") state = reduce(state, { type: "bid", by: toAct(state, format) ?? state.opener, amount: 6 }, format);
  return state;
}

export default function LayoutsPage() {
  const formats = Object.values(AUCTION_FORMATS);
  const [slug, setSlug] = useState(formats[0]?.slug ?? "");
  const [moment, setMoment] = useState<(typeof MOMENTS)[number]["key"]>("bidding");
  // A different draw of teams, so a layout is judged on more than one
  // lucky set of short names.
  const [seed, setSeed] = useState("layouts-1");
  const [camTop, setCamTop] = useState(560);
  const [camBottom, setCamBottom] = useState(560);

  const format = AUCTION_FORMATS[slug];
  const chosen = MOMENTS.find((m) => m.key === moment) ?? MOMENTS[0];
  const state = format ? demo(format, chosen.lots, chosen.key === "full" ? "bidding" : chosen.key, seed) : null;

  const chip = "rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] transition-colors";
  const on = { background: "rgba(0,227,95,0.14)", borderColor: "rgba(0,227,95,0.5)", color: "#dfffe9" };
  const off = { background: "transparent", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)" };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 pt-8">
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        PLAYER CARDS
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-white/50">
        Five versions of the chip, in the layout you picked. Same moment of the same draft in each. Same
        shape, same size, same price on the end &mdash; the only thing that changes is how the pill is filled.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {formats.map((f) => (
          <button key={f.slug} onClick={() => setSlug(f.slug)} className={chip} style={f.slug === slug ? on : off}>
            {f.title.toUpperCase()}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {MOMENTS.map((m) => (
          <button key={m.key} onClick={() => setMoment(m.key)} className={chip} style={m.key === moment ? on : off}>
            {m.label.toUpperCase()}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button onClick={() => setSeed(`layouts-${Math.random().toString(36).slice(2, 7)}`)} className={chip} style={off}>
          NEW TEAMS
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
        <span>Band left for the graphic: {1920 - camTop - camBottom}px</span>
      </div>

      {!format || !state ? (
        <p className="mt-10 text-sm text-white/45">No formats available &mdash; rosters have not been synced in this checkout.</p>
      ) : (
        <div className="mt-6 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {(Object.keys(PICK_CARDS) as PickKey[]).map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] tracking-[0.14em]" style={{ fontFamily: "var(--font-display)" }}>
                  {PICK_CARDS[key].name.toUpperCase()}
                </span>
                {key === DEFAULT_PICK && <span className="text-[9px] tracking-[0.14em] text-[#00e35f]">CURRENT</span>}
              </div>
              <OverlayStage state={state} format={format} camTop={camTop} camBottom={camBottom} pick={key} />
              <p className="text-[11.5px] leading-relaxed text-white/40">{PICK_CARDS[key].note}</p>
              <a
                href={`/versus/overlay?preview=1&pick=${key}&lots=${chosen.lots}&top=${camTop}&bottom=${camBottom}&p1=Noah&p2=Ben&seed=${seed}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-white/45 underline underline-offset-2 hover:text-white/75"
              >
                Open full size
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
