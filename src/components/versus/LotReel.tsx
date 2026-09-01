"use client";

import { useEffect, useState } from "react";
import type { AuctionFormat, AuctionItem } from "@/lib/auction/format";
import { shuffled, seedFrom } from "@/lib/auction/engine";
import { REEL_MS } from "./style";

// THE SLOT MACHINE - logos only.
//
// The first version drew a whole card per cell and masked the strip top
// and bottom with a dark gradient, which put a visible black box on a
// layer whose entire job is to be transparent. Over a face cam that reads
// as a bug. There is no box now and no mask: logos fly past on nothing,
// and the strip is clipped by an overflow window that paints nothing at
// all.

const STRIP = 34;

export function LotLogo({ item, size }: { item: AuctionItem | null; size: number }) {
  if (!item?.imageUrl) return <div style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        // The drop shadow is what separates a logo from whatever is
        // behind it. It replaces the box the reel used to sit in: it
        // follows the shape of the mark instead of boxing it.
        filter: `drop-shadow(0 5px 0 rgba(5,7,13,0.75)) drop-shadow(0 0 22px ${item.accent ?? "#ffffff"}99)`,
      }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

export function LogoReel({ format, targetId, size }: { format: AuctionFormat; targetId: string; size: number }) {
  // SEEDED FROM THE LOT, so the control board and the OBS overlay run the
  // identical reel. They animate independently - a frame-by-frame
  // broadcast would be absurd - and this is what keeps them showing the
  // same logos flying past rather than two different sets.
  const [strip] = useState(() => {
    const others = format.items.filter((i) => i.id !== targetId);
    const pool = shuffled(others, seedFrom(targetId));
    const run: AuctionItem[] = [];
    for (let i = 0; i < STRIP - 1; i++) run.push(pool[i % pool.length]);
    const target = format.items.find((i) => i.id === targetId);
    if (target) run.push(target);
    return run.filter(Boolean);
  });

  // The strip has to be painted at rest once before it is told to move,
  // or the browser has nothing to animate from and it simply appears at
  // the end. One frame, then go.
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRolling(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ height: size, width: size, overflow: "hidden" }}>
      <div
        style={{
          transform: `translateY(${rolling ? -(strip.length - 1) * size : 0}px)`,
          // Fast out of the gate and a long, slow settle - the part that
          // reads as a slot machine rather than a list scrolling by.
          transition: `transform ${REEL_MS}ms cubic-bezier(0.08, 0.82, 0.14, 1)`,
          willChange: "transform",
        }}
      >
        {strip.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{ height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LotLogo item={item} size={size} />
          </div>
        ))}
      </div>
    </div>
  );
}

// A lot that is drawn but not yet started. Deliberately says nothing
// about what it is, and - like the reel - sits on nothing.
export function LotWaiting({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${Math.max(4, Math.round(size * 0.035))}px dashed rgba(255,255,255,0.28)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.5,
        color: "rgba(255,255,255,0.32)",
        textShadow: "0 4px 0 rgba(5,7,13,0.7)",
      }}
    >
      ?
    </div>
  );
}
