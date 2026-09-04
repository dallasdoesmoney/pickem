"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, openLot, reduce, toAct, AuctionState } from "@/lib/auction/engine";
import type { AuctionFormat } from "@/lib/auction/format";
import { OverlayStage } from "@/components/versus/OverlayStage";
import { ANIMS, type AnimKey } from "@/components/versus/anims";
import { SPIN_MS } from "@/components/versus/style";

// FOUR BEATS THE GRAPHIC DOES NOT HAVE.
//
// An animation cannot be judged from a picture, so nothing here is one.
// Every block below is a live board with a PLAY button that drives the
// real state machine through the real moment, at the real speed, with
// only that one animation switched on. The last block runs a whole lot
// end to end with all four.
//
// They are all OFF in the live overlay - `anims` defaults to nothing, so
// the browser source is untouched until one is picked. ?anims=bump,sold
// on /versus/overlay turns them on there too, for looking at in OBS.
//
// Scratch page. It goes with the losing variants.

type Step = { at: number; act: (s: AuctionState, f: AuctionFormat) => AuctionState };

// A lot from START to sold, as a timeline. The gaps are what the real
// thing does: the reel runs for SPIN_MS, then bids land a beat apart.
const LOT: Step[] = [
  { at: 0, act: (s, f) => reduce(s, { type: "spin" }, f) },
  { at: SPIN_MS, act: (s, f) => reduce(s, { type: "reveal" }, f) },
  { at: SPIN_MS + 900, act: (s, f) => reduce(s, { type: "bid", by: toAct(s, f) ?? 0, amount: 1 }, f) },
  { at: SPIN_MS + 1800, act: (s, f) => reduce(s, { type: "bid", by: toAct(s, f) ?? 1, amount: 3 }, f) },
  { at: SPIN_MS + 2700, act: (s, f) => reduce(s, { type: "bid", by: toAct(s, f) ?? 0, amount: 6 }, f) },
  { at: SPIN_MS + 3600, act: (s, f) => reduce(s, { type: "pass", by: toAct(s, f) ?? 1 }, f) },
  {
    at: SPIN_MS + 5200,
    act: (s, f) => {
      if (s.phase !== "assigning" || !s.won) return s;
      const open = f.slots.filter((sl) => s.players[s.won!.by].roster[sl.key] === null);
      const item = f.items.find((it) => it.id === s.order[s.index]);
      const slot = open.find((sl) => !item?.fills || sl.key in item.fills);
      return slot ? reduce(s, { type: "assign", slotKey: slot.key }, f) : s;
    },
  },
];

// Where each animation lives in that timeline, so a single block can
// jump to just before its moment rather than making somebody sit
// through the whole lot to see one thing.
const FROM: Record<AnimKey, number> = {
  land: 0, // needs the spin, so it starts at the top
  bump: SPIN_MS + 500,
  sold: SPIN_MS + 3300,
  drain: SPIN_MS + 3300,
};

// A board a few lots in, so the rosters are not empty and a budget has
// something to drain from.
function warmed(format: AuctionFormat, seed: string, lots: number): AuctionState {
  let state = startAuction(format, ["NOAH", "BEN"], seed);
  for (let i = 0; i < lots && state.phase !== "done"; i++) {
    const who = state.opener;
    state = openLot(state, format);
    state = reduce(state, { type: "bid", by: who, amount: 2 + ((i * 3) % 5) }, format);
    if (state.phase === "bidding") state = reduce(state, { type: "pass", by: (who + 1) % 2 }, format);
    if (state.phase === "assigning") {
      const open = format.slots.filter((s) => state.players[state.won!.by].roster[s.key] === null);
      const item = format.items.find((it) => it.id === state.order[state.index]);
      const slot = open.find((s) => !item?.fills || s.key in item.fills);
      if (slot) state = reduce(state, { type: "assign", slotKey: slot.key }, format);
    }
  }
  return state;
}

function Player({
  format,
  seed,
  anims,
  from = 0,
  label,
}: {
  format: AuctionFormat;
  seed: string;
  anims: AnimKey[];
  // Skip the timeline forward to just before the interesting moment.
  from?: number;
  label: string;
}) {
  const base = warmed(format, seed, 3);
  const [state, setState] = useState<AuctionState>(base);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);
  useEffect(() => clear, [clear]);

  const play = () => {
    clear();
    setRunning(true);
    // Everything before `from` is applied at once, with no delay, so the
    // board is already sitting at the moment before the beat.
    let s = base;
    for (const step of LOT) if (step.at < from) s = step.act(s, format);
    setState(s);
    let acc = s;
    for (const step of LOT.filter((x) => x.at >= from)) {
      timers.current.push(
        window.setTimeout(() => {
          acc = step.act(acc, format);
          setState(acc);
        }, step.at - from),
      );
    }
    timers.current.push(window.setTimeout(() => setRunning(false), LOT[LOT.length - 1].at - from + 400));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={play}
          className="rounded-full border px-4 py-1.5 text-[11px] tracking-[0.14em] transition-colors"
          style={
            running
              ? { background: "rgba(0,227,95,0.14)", borderColor: "rgba(0,227,95,0.5)", color: "#dfffe9" }
              : { background: "transparent", borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }
          }
        >
          {running ? "PLAYING…" : label}
        </button>
        <button
          type="button"
          onClick={() => {
            clear();
            setRunning(false);
            setState(base);
          }}
          className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] tracking-[0.14em] text-white/45 transition-colors hover:text-white/75"
        >
          RESET
        </button>
      </div>
      <OverlayStage state={state} format={format} mode="band" anims={anims} />
    </div>
  );
}

export default function AnimationIdeasPage() {
  const formats = Object.values(AUCTION_FORMATS);
  const format = formats[0];
  const [seed, setSeed] = useState("anim-1");

  if (!format) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="text-sm text-white/45">No formats available &mdash; rosters have not been synced in this checkout.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-8">
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        THE MISSING BEATS
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        The graphic has three moving parts today: the reel, a pick landing, and the price flying to the winner.
        These are four moments that currently have nothing on them &mdash; and they are the ones that happen most.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/40">
        Press PLAY on any of them. Each one drives the real state machine through the real moment at the real
        speed, with only that animation switched on. All four are OFF in the live overlay until you pick.
      </p>

      <div className="mt-5">
        <button
          onClick={() => setSeed(`anim-${Math.random().toString(36).slice(2, 7)}`)}
          className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] tracking-[0.12em] text-white/55 transition-colors hover:text-white/80"
        >
          NEW TEAMS
        </button>
      </div>

      <div className="mt-9 flex flex-col gap-14">
        {ANIMS.map((a) => (
          <section key={a.key}>
            <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
              {a.name.toUpperCase()}
            </h2>
            <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{a.note}</p>
            <Player format={format} seed={seed} anims={[a.key]} from={FROM[a.key]} label="PLAY" />
          </section>
        ))}

        <section>
          <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
            ALL FOUR, ONE WHOLE LOT
          </h2>
          <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">
            START to sold, at the speed the real thing runs: the reel, the landing, three raises, a pass, the
            stamp, and the budget draining as the pick lands. This is the one that answers whether it is too
            much.
          </p>
          <Player format={format} seed={seed} anims={["bump", "sold", "land", "drain"]} label="PLAY THE LOT" />
        </section>

        <section>
          <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
            NONE OF THEM, FOR COMPARISON
          </h2>
          <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">
            The same lot as it looks today. Worth watching straight after the one above.
          </p>
          <Player format={format} seed={seed} anims={[]} label="PLAY THE LOT" />
        </section>
      </div>
    </main>
  );
}
