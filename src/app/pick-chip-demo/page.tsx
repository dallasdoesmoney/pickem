"use client";

// TEMPORARY. The team logo on a pick chip, made big enough to actually
// be a logo.
//
// Today it is a 32px badge sitting in the pill like a bullet point. The
// chip already reserves a slice of itself for it; the question is what
// happens if the mark uses all of that slice and then some - oversized,
// anchored to the pill's end, clipped by the pill's own rounded edge on
// the outside and running behind the name on the inside.
//
// Everything is drawn at OVERLAY SIZE - these are 1080x1920 stage
// pixels, the same numbers layouts.tsx uses - over a checkerboard,
// because the layer this lives on is transparent and sits over a face
// cam. Judging it on a dark page would flatter it.
//
// Delete this route, and the noindex beside it, once one is chosen.

import { useState } from "react";
import { TEAMS } from "@/data/teams";
import { MONEY_ON_LIGHT, outlined } from "@/components/versus/style";

// The real numbers from PickChip in layouts.tsx, so what is on screen
// here is the shipping chip with one layer changed.
const NAME = 40;
const PRICE = 29;
const BADGE = 32;
const PILL_PAD = 5;

// THE CASES THAT BREAK THINGS, not the pretty ones.
//
//   PIT  yellow, and the busiest mark in the league
//   NO   near-white gold - the fill a white logo disappears into
//   CHI  almost black, where a dark logo has nothing to sit on
//   MIA  bright aqua with a light logo
//   DAL  a plain star, the easy case, as a control
//   BAL  deep purple with an intricate bird
const PICKS: { abbr: keyof typeof TEAMS; name: string; price: number }[] = [
  { abbr: "PIT", name: "WARREN", price: 4 },
  { abbr: "NO", name: "OLAVE", price: 2 },
  { abbr: "CHI", name: "WILLIAMS", price: 7 },
  { abbr: "MIA", name: "WADDLE", price: 3 },
  { abbr: "DAL", name: "PRESCOTT", price: 6 },
  { abbr: "BAL", name: "JACKSON", price: 5 },
];

type Variant = {
  key: string;
  name: string;
  note: string;
  // null = the badge as it ships. Otherwise the oversized mark.
  logo: {
    // Multiple of the pill's own height. 1 is exactly as tall as the
    // pill; anything over 1 is bleeding out of it top and bottom.
    scale: number;
    // How far past the pill's end it hangs, as a fraction of its own
    // size. This is the "cut off on the side the pill ends" part.
    over: number;
    opacity: number;
    // A dark wash under the name so white lettering always has a ground.
    scrim: boolean;
    // Push the name clear of the mark instead of letting it overlap.
    clear: boolean;
    filter?: string;
  } | null;
};

const VARIANTS: Variant[] = [
  {
    key: "now",
    name: "A — What ships now",
    note: "A 32px badge sitting in the pill like a bullet point. The control.",
    logo: null,
  },
  {
    key: "fill",
    name: "B — Fills the pill",
    note: "Exactly the pill's height, hung a quarter of itself past the end. Nearly twice the badge and cut on the outer edge ONLY — the whole crest is there top to bottom, which is the safest of these on a mark you have to recognise in a clip.",
    logo: { scale: 1, over: 0.25, opacity: 1, scrim: false, clear: false },
  },
  {
    key: "bleed",
    name: "C — Bleeds a little",
    note: "1.4× the pill, hung 30% past the end. Bigger again, and now the top and bottom of the mark are cropped too — about a seventh off each.",
    logo: { scale: 1.4, over: 0.3, opacity: 1, scrim: false, clear: false },
  },
  {
    key: "scrim",
    name: "D — Bleeds hard, with a scrim",
    note: "1.8× the pill and a third of itself past the end, so a good quarter of the mark's height goes as well. A dark wash sits between it and the name, so the letters have a ground rather than relying on their outline.",
    logo: { scale: 1.8, over: 0.33, opacity: 1, scrim: true, clear: false },
  },
  {
    key: "ghost",
    name: "E — Bleeds hard, ghosted",
    note: "The same 1.8× mark at 55%. Reads as texture in the team's colour rather than as a second object competing with the name — and no scrim needed over it.",
    logo: { scale: 1.8, over: 0.33, opacity: 0.55, scrim: false, clear: false },
  },
  {
    key: "clear",
    name: "F — Big, and nothing overlaps",
    note: "1.9×, with the name pushed clear of it entirely. No lettering over artwork at all — and the widest chip here, which with ten of them on a 1080px stage is the thing to weigh.",
    logo: { scale: 1.9, over: 0.36, opacity: 1, scrim: false, clear: true },
  },
];

function Chip({ pick, who, variant }: { pick: (typeof PICKS)[number]; who: number; variant: Variant }) {
  const team = TEAMS[pick.abbr];
  const accent = team.color;
  const v = variant.logo;

  // The pill's height, from the parts that set it: the name's line box
  // plus its padding. Everything oversized is a multiple of this, so a
  // variant is one number rather than a set of pixel guesses.
  const H = NAME + PILL_PAD * 2 + 4;
  const mark = v ? Math.round(H * v.scale) : BADGE;
  // How much of the mark hangs past the pill's end. The pill has
  // overflow: hidden, so this is what gets cut off.
  const hang = v ? Math.round(mark * v.over) : 0;
  // THE ROOM THE NAME LEAVES, and the number the first draft got wrong.
  //
  // At 42% of the mark's visible width the name started almost on top
  // of it, and a 92px logo showed less of itself than the 32px badge it
  // replaced - which is the opposite of the point. 68% leaves most of
  // the mark clean and lets the name cross only its inner edge.
  const reserve = v ? (v.clear ? mark - hang : Math.round((mark - hang) * 0.68)) : 0;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: who === 0 ? "row-reverse" : "row",
        alignItems: "center",
        gap: v ? 0 : 9,
        padding: who === 0 ? `${PILL_PAD}px 14px ${PILL_PAD}px 10px` : `${PILL_PAD}px 10px ${PILL_PAD}px 14px`,
        borderRadius: 999,
        background: accent,
        border: "2px solid rgba(5,7,13,0.55)",
        overflow: "hidden",
        minHeight: H,
      }}
    >
      {v ? (
        <>
          {/* THE MARK, hung off the pill's end. Absolute rather than in
              the flow, because a 100px logo in a 58px pill would set the
              pill's height if it were a flex child - the whole point is
              that it exceeds the pill and gets cut. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              [who === 0 ? "right" : "left"]: -hang,
              transform: "translateY(-50%)",
              width: mark,
              height: mark,
              opacity: v.opacity,
              pointerEvents: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team.logo}
              alt=""
              width={mark}
              height={mark}
              style={{
                width: mark,
                height: mark,
                objectFit: "contain",
                filter: v.filter ?? "drop-shadow(0 3px 0 rgba(5,7,13,0.55))",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>

          {/* The wash, between the mark and the name. Runs from the
              name's side of the pill towards the mark, so the letters
              always have a ground and the logo's outer half does not. */}
          {v.scrim && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to ${who === 0 ? "left" : "right"}, rgba(5,7,13,0.55) 0%, rgba(5,7,13,0.22) 42%, transparent 72%)`,
                pointerEvents: "none",
              }}
            />
          )}

          {/* The room the mark takes out of the row. */}
          <span style={{ width: reserve, flexShrink: 0 }} />
        </>
      ) : (
        <span style={{ position: "relative", display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={team.logo}
            alt=""
            width={BADGE}
            height={BADGE}
            style={{
              width: BADGE,
              height: BADGE,
              objectFit: "contain",
              flexShrink: 0,
              filter: "drop-shadow(0 2px 0 rgba(5,7,13,0.8))",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </span>
      )}

      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: NAME,
          lineHeight: 1,
          color: "#ffffff",
          whiteSpace: "nowrap",
          marginLeft: v && who === 1 ? 4 : 0,
          marginRight: v && who === 0 ? 4 : 0,
          ...outlined(NAME),
        }}
      >
        {pick.name}
      </span>

      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          marginLeft: who === 0 ? 0 : 9,
          marginRight: who === 0 ? 9 : 0,
          padding: "2px 10px",
          borderRadius: 999,
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(5,7,13,0.5)",
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

export default function PickChipDemo() {
  const [scale, setScale] = useState(0.62);
  const [mirror, setMirror] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        THE LOGO ON A PICK
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
        The chip already keeps a slice of itself for the team mark. These use that slice properly: the logo oversized,
        anchored to the pill&rsquo;s end, cut off by the pill on the outside and running behind the name on the inside.
        Drawn at real overlay size over a checkerboard, because the layer is transparent and sits on top of a camera.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-white/40">
        Six teams, chosen for the cases that break: Pittsburgh&rsquo;s yellow and its busy mark, New Orleans&rsquo; near-white
        gold, Chicago&rsquo;s near-black, Miami&rsquo;s bright aqua, Baltimore&rsquo;s intricate bird, and Dallas as the easy
        control.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[
          [0.62, "62% · fits the page"],
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
                className="flex flex-col items-start gap-2.5"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: mirror ? "top right" : "top left",
                  width: `${100 / scale}%`,
                  alignItems: mirror ? "flex-end" : "flex-start",
                }}
              >
                {PICKS.map((p) => (
                  <Chip key={p.abbr} pick={p} who={mirror ? 0 : 1} variant={v} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
