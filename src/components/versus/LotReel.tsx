"use client";

import { useEffect, useState } from "react";
import type { AuctionFormat, AuctionItem } from "@/lib/auction/format";
import { shuffled, seedFrom } from "@/lib/auction/engine";
import { outlined, LOT_CELL_H, REEL_MS } from "./style";

// THE SLOT MACHINE.
//
// Every lot is drawn through LotCell, at a fixed height, in all four
// states - not yet started, spinning, landed, being bid on. That is the
// whole trick behind the reel stopping cleanly: the cell that flies past
// during the spin is the same cell, at the same size, in the same place,
// as the one sitting there afterwards. Nothing swaps out at the end, the
// strip just stops moving.

const STRIP = 34;

export function LotCell({ item, dim = false }: { item: AuctionItem | null; dim?: boolean }) {
  return (
    <div
      style={{
        height: LOT_CELL_H,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: dim ? 0.45 : 1,
      }}
    >
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          width={180}
          height={180}
          style={{
            width: 180,
            height: 180,
            objectFit: "contain",
            filter: `drop-shadow(0 6px 0 rgba(5,7,13,0.8)) drop-shadow(0 0 26px ${item.accent ?? "#ffffff"}88)`,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div style={{ width: 180, height: 180 }} />
      )}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: item && item.label.length > 17 ? 32 : 42,
          lineHeight: 1.02,
          color: "#ffffff",
          textAlign: "center",
          maxWidth: "100%",
          ...outlined(38),
        }}
      >
        {(item?.label ?? "").toUpperCase()}
      </div>
    </div>
  );
}

export function LotReel({ format, targetId }: { format: AuctionFormat; targetId: string }) {
  // SEEDED FROM THE LOT, so the control board and the OBS overlay run the
  // identical reel. They animate independently - a frame-by-frame
  // broadcast would be absurd - and this is what keeps them showing the
  // same teams flying past rather than two different ones.
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
    <div style={{ height: LOT_CELL_H, width: "100%", overflow: "hidden", position: "relative" }}>
      <div
        style={{
          transform: `translateY(${rolling ? -(strip.length - 1) * LOT_CELL_H : 0}px)`,
          // Fast out of the gate and a long, slow settle - the part that
          // reads as a slot machine rather than a list scrolling by.
          transition: `transform ${REEL_MS}ms cubic-bezier(0.08, 0.82, 0.14, 1)`,
          willChange: "transform",
        }}
      >
        {strip.map((item, i) => (
          <LotCell key={`${item.id}-${i}`} item={item} />
        ))}
      </div>

      {/* A little shading top and bottom so the strip runs off into the
          dark instead of ending on a hard edge. Pointer-events off; it is
          over the top of the reel. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(5,7,13,0.85) 0%, rgba(5,7,13,0) 22%, rgba(5,7,13,0) 78%, rgba(5,7,13,0.85) 100%)",
        }}
      />
    </div>
  );
}

// A lot that is drawn but not yet started. Deliberately says nothing
// about what it is.
export function LotWaiting() {
  return (
    <div
      style={{
        height: LOT_CELL_H,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          border: "6px dashed rgba(255,255,255,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontSize: 92,
          color: "rgba(255,255,255,0.3)",
          ...outlined(92, "soft"),
        }}
      >
        ?
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 34,
          letterSpacing: 6,
          color: "rgba(255,255,255,0.45)",
          ...outlined(34),
        }}
      >
        NEXT LOT
      </div>
    </div>
  );
}
