"use client";

// TEMPORARY. How far the nameplate press should go.
//
// B won on the price capsule: a solid block of ink offset down and
// right, no blur, thick on two sides and absent on the other two. The
// question now is whether the name and the pill itself want the same
// treatment, or whether one pressed object per chip is the whole point.
//
// Five answers, drawn in rows of five so the vertical crowding is
// visible - which is the thing that actually decides this. Rows on the
// real overlay sit 6-7px apart, so a block hanging 5px off the bottom
// of a pill nearly touches the chip below it. Measured, not guessed;
// see the note under the last variant.
//
// THE NAME ALREADY HAS HALF OF THIS. outlined() draws a 2px ink stroke
// plus a shadow straight DOWN - so the pressed variants only move that
// shadow diagonally and make it opaque, which is a smaller change than
// it sounds and lines the name's light up with the capsule's.
//
// Delete this route, and the noindex beside it, once one is chosen.

import { useState } from "react";
import { TEAMS } from "@/data/teams";
import { INK, MONEY_ON_LIGHT, outlined } from "@/components/versus/style";

const NAME = 40;
const PRICE = 29;
const PILL_PAD = 5;
const PILL_H = 54;
const MARK = Math.round(PILL_H * 1.3);
const MARK_HANG = 3;
const MARK_ROOM = Math.round((MARK - MARK_HANG) * 0.5);
const MARK_ALPHA = 0.46;

// The press, one definition. The capsule's is the nameplate's own
// 3px 4px; the pill's is a pixel smaller down, because the rails only
// leave 6-7px between rows and 5px would put the block on the next
// chip's head.
const PRESS_PRICE = `3px 4px 0 ${INK}`;
const PRESS_PILL = `4px 4px 0 ${INK}`;
const PRESS_NAME = `3px 4px 0 ${INK}`;

// A real rail's worth: five slots, five teams, spread across the range
// of fills rather than picked for looking good.
const PICKS: { abbr: keyof typeof TEAMS; name: string; price: number }[] = [
  { abbr: "NO", name: "OLAVE", price: 2 },
  { abbr: "PIT", name: "WARREN", price: 4 },
  { abbr: "CHI", name: "WILLIAMS", price: 7 },
  { abbr: "BAL", name: "JACKSON", price: 5 },
  { abbr: "MIA", name: "WADDLE", price: 3 },
];

type Variant = {
  key: string;
  name: string;
  note: string;
  pill: boolean;
  nameText: boolean;
  // The capsule: "press" is B as you saw it, "flat" drops its edge
  // entirely so the chip carries one shadow rather than three.
  price: "press" | "flat";
};

const VARIANTS: Variant[] = [
  {
    key: "price",
    name: "1 — Price only",
    note: "B exactly as you saw it. One pressed object on the chip; the name and the pill are untouched.",
    pill: false,
    nameText: false,
    price: "press",
  },
  {
    key: "name",
    name: "2 — Price and the name",
    note: "The name's shadow moves from straight down to the same diagonal, and goes opaque. Its ink stroke is unchanged. Now the two things sitting ON the pill are lit from the same corner.",
    pill: false,
    nameText: true,
    price: "press",
  },
  {
    key: "pill",
    name: "3 — Price and the whole pill",
    note: "The chip itself gets a block, so the whole pick lifts off the layer. The name is left alone. This is the one that has to live inside the 6-7px between rows.",
    pill: true,
    nameText: false,
    price: "press",
  },
  {
    key: "all",
    name: "4 — All three",
    note: "Pill, name and price all pressed. The most committed to the look — and three nested blocks is either a house style or a lot going on, which is the call to make.",
    pill: true,
    nameText: true,
    price: "press",
  },
  {
    key: "pillonly",
    name: "5 — The pill only, capsule flat",
    note: "The block moves OUT to the pill and the capsule gives up its edge entirely — one shadow on one object rather than a shadow inside a shadow. The white capsule still reads because it never drops below 1.76:1 against any team fill.",
    pill: true,
    nameText: false,
    price: "flat",
  },
];

function Chip({ pick, who, v }: { pick: (typeof PICKS)[number]; who: number; v: Variant }) {
  const team = TEAMS[pick.abbr];
  const base = outlined(NAME);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: who === 0 ? "row-reverse" : "row",
        alignItems: "center",
        gap: 0,
        padding: who === 0 ? `${PILL_PAD}px 14px ${PILL_PAD}px 10px` : `${PILL_PAD}px 10px ${PILL_PAD}px 14px`,
        borderRadius: 999,
        background: team.color,
        border: "2px solid rgba(5,7,13,0.55)",
        overflow: "hidden",
        minHeight: PILL_H,
        // An outer box-shadow is NOT clipped by the element's own
        // overflow: hidden - that clips children. So the pill can carry
        // a block and still crop the oversized crest.
        boxShadow: v.pill ? PRESS_PILL : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          [who === 0 ? "right" : "left"]: -MARK_HANG,
          transform: "translateY(-50%)",
          width: MARK,
          height: MARK,
          opacity: MARK_ALPHA,
          pointerEvents: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={team.logo}
          alt=""
          width={MARK}
          height={MARK}
          style={{ width: MARK, height: MARK, objectFit: "contain", filter: "drop-shadow(0 2px 0 rgba(5,7,13,0.8))" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </span>
      <span style={{ width: MARK_ROOM, flexShrink: 0 }} />
      <span
        data-name
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: NAME,
          lineHeight: 1,
          color: "#ffffff",
          whiteSpace: "nowrap",
          marginLeft: who === 1 ? 4 : 0,
          marginRight: who === 0 ? 4 : 0,
          ...base,
          ...(v.nameText ? { textShadow: PRESS_NAME } : null),
        }}
      >
        {pick.name}
      </span>
      <span
        data-price
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          marginLeft: who === 0 ? 0 : 9,
          marginRight: who === 0 ? 9 : 0,
          padding: "2px 10px",
          borderRadius: 999,
          background: "#ffffff",
          boxShadow: v.price === "press" ? PRESS_PRICE : "none",
          fontFamily: "var(--font-display)",
          fontSize: PRICE,
          lineHeight: 1,
          color: MONEY_ON_LIGHT,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${pick.price}
      </span>
    </div>
  );
}

export default function PressDemo() {
  const [scale, setScale] = useState(0.72);
  const [mirror, setMirror] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        HOW FAR THE PRESS GOES
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
        Five versions of B. The capsule keeps its block in all of them; what changes is whether the name and the pill get one
        too. Drawn five to a rail at the real row spacing, because the thing that decides this is how it looks stacked, not
        how one chip looks alone.
      </p>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
        The rails leave <strong className="text-white/70">6&ndash;7px between rows</strong> on the real overlay, so a pill
        block is working in a very small space &mdash; it is 4px here rather than the capsule&rsquo;s 5, and 3, 4 and 5 are
        the variants to judge on crowding rather than on a single chip. The name already carries half of this: it has a 2px
        ink stroke and a shadow straight down, so pressing it only moves that shadow diagonally and makes it opaque.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[
          [0.72, "72% · fits the page"],
          [1, "100% · true overlay size"],
        ].map(([s, label]) => (
          <button
            key={String(s)}
            type="button"
            onClick={() => setScale(s as number)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] transition-colors ${
              scale === s ? "border-white/45 bg-white/10 text-white" : "border-white/15 text-white/60 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {label as string}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMirror((m) => !m)}
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-[11px] text-white/60 transition-colors hover:text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {mirror ? "RIGHT RAIL" : "LEFT RAIL"}
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-10">
        {VARIANTS.map((v) => (
          <section key={v.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {v.name}
            </h2>
            <p className="mb-3 mt-1 max-w-2xl text-[12.5px] leading-snug text-white/50">{v.note}</p>
            <div
              className="overflow-x-auto rounded-xl p-4"
              style={{ background: "repeating-conic-gradient(#59617a 0% 25%, #444b60 0% 50%) 50% / 44px 44px" }}
            >
              <div
                className="flex flex-col"
                style={{
                  // The rails' own spacing, so the crowding on screen is
                  // the crowding on the stream.
                  gap: 7,
                  transform: `scale(${scale})`,
                  transformOrigin: mirror ? "top right" : "top left",
                  width: `${100 / scale}%`,
                  alignItems: mirror ? "flex-end" : "flex-start",
                }}
              >
                {PICKS.map((p) => (
                  <Chip key={p.abbr} pick={p} who={mirror ? 0 : 1} v={v} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
