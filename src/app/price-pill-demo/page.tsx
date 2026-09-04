"use client";

// TEMPORARY. Six ways to edge the price capsule.
//
// What ships is a 2px rim at half opacity all the way round, which is
// the thing that reads as neither-one-thing-nor-the-other: too faint to
// be an outline, too present to be nothing. Everything below is that
// one box-shadow changed, drawn inside the real chip.
//
// The house alternative is the NAMEPLATE PRESS: a solid block of ink
// offset down and right, no blur, no rim - the same shape the daily
// game's buttons and cards use. It is the "thicker on one side" look.
//
// THE PILL CLIPS. The chip has overflow: hidden so the oversized team
// mark gets cut by it, which means anything hanging off the capsule is
// cut too. Measured rather than guessed: the capsule sits 7.8px clear
// of the pill's padding edge below and 9.2px to the side, so the
// nameplate's own 3px 4px fits with room to spare. The first estimate
// here said 3.5px and was measuring to the BORDER box, which is not
// where overflow cuts.
//
// Everything is at OVERLAY SIZE over a checkerboard, because this layer
// is transparent and sits on a face cam.
//
// Delete this route, and the noindex beside it, once one is chosen.

import { useState } from "react";
import { TEAMS } from "@/data/teams";
import { INK, MONEY, MONEY_ON_LIGHT, outlined } from "@/components/versus/style";

// The real numbers out of PickChip in layouts.tsx, so what is on screen
// is the shipping chip with one property changed.
const NAME = 40;
const PRICE = 29;
const PILL_PAD = 5;
const PILL_H = 54;
const MARK = Math.round(PILL_H * 1.3);
const MARK_HANG = 3;
const MARK_ROOM = Math.round((MARK - MARK_HANG) * 0.5);
const MARK_ALPHA = 0.46;

// The teams that break a capsule: the two near-white fills it has to
// hold its own shape against, the two darkest, and a bright one.
const PICKS: { abbr: keyof typeof TEAMS; name: string; price: number }[] = [
  { abbr: "NO", name: "OLAVE", price: 2 },
  { abbr: "PIT", name: "WARREN", price: 4 },
  { abbr: "TEN", name: "RIDLEY", price: 11 },
  { abbr: "CHI", name: "WILLIAMS", price: 7 },
  { abbr: "BAL", name: "JACKSON", price: 5 },
  { abbr: "MIA", name: "WADDLE", price: 3 },
];

type Style = {
  key: string;
  name: string;
  note: string;
  bg: string;
  ink: string;
  shadow: string;
};

const STYLES: Style[] = [
  {
    key: "now",
    name: "A — What ships now",
    note: "A 2px rim at half opacity, all the way round. The control — and the thing that reads as neither an outline nor nothing.",
    bg: "#ffffff",
    ink: MONEY_ON_LIGHT,
    shadow: "0 0 0 2px rgba(5,7,13,0.5)",
  },
  {
    key: "press",
    name: "B — The nameplate press",
    note: "No rim at all: a solid block of ink offset down and right, exactly like the daily game's buttons. The edge is thick on two sides and absent on the other two, which is what makes it read as a physical thing sitting on the pill.",
    bg: "#ffffff",
    ink: MONEY_ON_LIGHT,
    shadow: `3px 4px 0 ${INK}`,
  },
  {
    key: "both",
    name: "C — Outlined, and pressed",
    note: "A solid 2px rim all round AND the offset block under it. The rim holds the shape on the near-white teams where a white capsule would otherwise dissolve; the block gives it somewhere to sit.",
    bg: "#ffffff",
    ink: MONEY_ON_LIGHT,
    shadow: `0 0 0 2px ${INK}, 3px 4px 0 ${INK}`,
  },
  {
    key: "solid",
    name: "D — Just a proper rim",
    note: "The same idea as today, but opaque and 3px instead of 2px at half strength. No offset, nothing new — only the thing that is already there, committed to.",
    bg: "#ffffff",
    ink: MONEY_ON_LIGHT,
    shadow: `0 0 0 3px ${INK}`,
  },
  {
    key: "dark",
    name: "E — Flip it: dark capsule, bright money",
    note: "The capsule becomes ink and the digits become the board's real green, the same green as every other number on the graphic. Bare, though, it is the white capsule's problem inverted and worse: measured against all 32 fills it drops under 3:1 on 21 of them and reaches 1.05:1 on Chicago, which is why the Bears row below has no capsule at all. Look at it, then look at F.",
    bg: INK,
    ink: MONEY,
    shadow: "none",
  },
  {
    key: "darkrim",
    name: "F — Dark capsule, white rim",
    note: "E with a 2px white rim, which is the only thing that makes a dark capsule survive the dark half of the league. Same trade as the white capsule, run the other way round.",
    bg: INK,
    ink: MONEY,
    shadow: "0 0 0 2px #ffffff",
  },
];

function Chip({ pick, who, style }: { pick: (typeof PICKS)[number]; who: number; style: Style }) {
  const team = TEAMS[pick.abbr];
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
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: NAME,
          lineHeight: 1,
          color: "#ffffff",
          whiteSpace: "nowrap",
          marginLeft: who === 1 ? 4 : 0,
          marginRight: who === 0 ? 4 : 0,
          ...outlined(NAME),
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
          background: style.bg,
          boxShadow: style.shadow,
          fontFamily: "var(--font-display)",
          fontSize: PRICE,
          lineHeight: 1,
          color: style.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${pick.price}
      </span>
    </div>
  );
}

export default function PricePillDemo() {
  const [scale, setScale] = useState(0.72);
  const [mirror, setMirror] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        THE PRICE CAPSULE
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
        Six edges for the one white pill on the graphic. Everything else about the chip is exactly what ships &mdash; the
        oversized ghosted crest, the surname, the mirroring &mdash; so the only thing changing between these is the capsule.
      </p>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
        Six teams chosen for what breaks a capsule: Pittsburgh&rsquo;s yellow and New Orleans&rsquo; gold, the two fills a white
        pill has the least edge against; Chicago and Baltimore at the dark end, where a dark capsule has none; Tennessee&rsquo;s
        light blue; Miami&rsquo;s aqua. The chip clips, so the offset was measured against the pill&rsquo;s padding edge rather
        than guessed &mdash; there is 7.8px of room below, and the nameplate&rsquo;s own 3px&nbsp;4px fits inside it.
      </p>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
        Contrast of the capsule against the team fill, all 32 measured: a <strong className="text-white/70">white</strong>
        capsule drops under 3:1 on two teams and never below 1.76:1, so it always has some edge. An
        {" "}<strong className="text-white/70">ink</strong> capsule drops under 3:1 on twenty-one and reaches 1.05:1 on
        Chicago &mdash; invisible. That is why E carries a warning and F carries a rim.
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
        {STYLES.map((s) => (
          <section key={s.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {s.name}
            </h2>
            <p className="mb-3 mt-1 max-w-2xl text-[12.5px] leading-snug text-white/50">{s.note}</p>
            <div
              className="overflow-x-auto rounded-xl p-4"
              style={{ background: "repeating-conic-gradient(#59617a 0% 25%, #444b60 0% 50%) 50% / 44px 44px" }}
            >
              <div
                className="flex flex-col gap-2.5"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: mirror ? "top right" : "top left",
                  width: `${100 / scale}%`,
                  alignItems: mirror ? "flex-end" : "flex-start",
                }}
              >
                {PICKS.map((p) => (
                  <Chip key={p.abbr} pick={p} who={mirror ? 0 : 1} style={s} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
