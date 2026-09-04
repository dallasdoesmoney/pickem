"use client";

import { useEffect, useRef, useState } from "react";

// HOW MANY PEOPLE HAVE PLAYED TODAY.
//
// Four ways to draw it, all of them the same two facts: a number, and
// something saying the number is alive. They differ in how loudly.
//
// The number is a COUNT OF PEOPLE SINCE MIDNIGHT EASTERN, not a running
// total and not a session count - it resets with the puzzle, so at 00:05
// it says a small number and that is correct rather than broken. Which
// means the empty state matters more than it usually would: for the
// first few minutes of every day this thing says "3", and it has to not
// look wrong.

export type CounterKey = "dot" | "pill" | "ticker" | "ping";

export const COUNTERS: { key: CounterKey; name: string; note: string }[] = [
  {
    key: "dot",
    name: "1 · Live dot",
    note: "No new furniture at all. The caption already has a coloured dot beside its status line - it just starts breathing, and the count joins the line it is already on. Cheapest, quietest, and the only one that adds nothing to the card.",
  },
  {
    key: "pill",
    name: "2 · Corner pill",
    note: "A small pill in the card's top corner, over the art. Reads as a badge on the thing rather than a line under it, and it is the only one you notice before you have read anything. Costs a corner of the artwork.",
  },
  {
    key: "ticker",
    name: "3 · Rolling number",
    note: "The digits roll when the count changes. Nothing else says \"live\" as well as a number that visibly moves - but it only pays off when somebody is watching at the moment it ticks, which on a card people glance at is not often.",
  },
  {
    key: "ping",
    name: "4 · Radar ping",
    note: "A dot with a ring pulsing out of it, the way a live map marks a signal. The most obviously \"live\" of the four and the most decorative - on a card that already has a busy board behind it, it is one more moving thing.",
  },
];

// Comma-grouped, because four figures without a separator reads as a
// year. tabular-nums everywhere so a tick does not reflow the line.
function group(n: number): string {
  return n.toLocaleString("en-US");
}

export function CounterStyles() {
  return (
    <style>{`
      @keyframes dailyLiveBreath {
        0%, 100% { opacity: 0.45; transform: scale(0.85); }
        50%      { opacity: 1;    transform: scale(1); }
      }
      @keyframes dailyLivePing {
        0%   { opacity: 0.55; transform: scale(1); }
        80%  { opacity: 0;    transform: scale(2.6); }
        100% { opacity: 0;    transform: scale(2.6); }
      }
      @keyframes dailyDigitRoll {
        0%   { transform: translateY(60%); opacity: 0; }
        100% { transform: none; opacity: 1; }
      }
      .daily-live-breath { animation: dailyLiveBreath 1.8s ease-in-out infinite; }
      .daily-live-ping   { animation: dailyLivePing 1.8s ease-out infinite; }
      .daily-digit-roll  { animation: dailyDigitRoll 260ms cubic-bezier(0.3,0.1,0.2,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .daily-live-breath, .daily-live-ping, .daily-digit-roll { animation: none; }
      }
    `}</style>
  );
}

const LIVE = "#4ade80";

// The dot, on its own, at whatever size the thing around it wants.
function LiveDot({ size = 6, ping }: { size?: number; ping?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {ping && (
        <span
          className="daily-live-ping absolute inset-0 rounded-full"
          style={{ background: LIVE }}
        />
      )}
      <span
        className={ping ? "relative rounded-full" : "daily-live-breath relative rounded-full"}
        style={{ width: size, height: size, background: LIVE }}
      />
    </span>
  );
}

// The number, re-mounted on change so the roll plays once per tick.
function Rolling({ value }: { value: number }) {
  return (
    <span key={value} className="daily-digit-roll inline-block tabular-nums">
      {group(value)}
    </span>
  );
}

// THE COUNT ITSELF, in the four treatments. `inline` is the home card's
// caption line; `strip` is the wider version for the game page, where
// there is room to say the whole thing.
export function PlayersToday({
  kind,
  count,
  variant = "inline",
}: {
  kind: CounterKey;
  count: number;
  variant?: "inline" | "strip";
}) {
  const strip = variant === "strip";
  const size = strip ? 8 : 6;

  if (kind === "pill") {
    return (
      <span
        className="inline-flex items-center rounded-full backdrop-blur-sm"
        style={{
          gap: strip ? 8 : 6,
          padding: strip ? "6px 12px" : "4px 9px",
          background: "rgba(3,7,15,0.72)",
          border: "1px solid rgba(74,222,128,0.45)",
          fontSize: strip ? 13 : 10.5,
          letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.82)",
        }}
      >
        <LiveDot size={size} />
        <span className="tabular-nums" style={{ color: LIVE, fontWeight: 600 }}>{group(count)}</span>
        {strip ? "playing today" : "TODAY"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center" style={{ gap: strip ? 8 : 6, fontSize: strip ? 13 : undefined }}>
      <LiveDot size={size} ping={kind === "ping"} />
      <span style={{ color: kind === "dot" ? undefined : LIVE, fontWeight: kind === "dot" ? undefined : 600 }}>
        {kind === "ticker" ? <Rolling value={count} /> : <span className="tabular-nums">{group(count)}</span>}
      </span>
      <span>{strip ? "have played today" : "PLAYED TODAY"}</span>
    </span>
  );
}

// A stand-in for the real thing while this is a mockup: starts somewhere
// plausible for the hour and creeps up, so the "live" half can actually
// be judged. The real one polls an RPC - see the notes on the page.
export function useFakeCount(start = 1247) {
  const [n, setN] = useState(start);
  const ref = useRef(start);
  useEffect(() => {
    const t = setInterval(() => {
      // Irregular, because a counter that ticks on a metronome reads as
      // a fake immediately - which, here, it is.
      if (Math.random() < 0.55) {
        ref.current += 1 + Math.floor(Math.random() * 2);
        setN(ref.current);
      }
    }, 1400);
    return () => clearInterval(t);
  }, []);
  return n;
}
