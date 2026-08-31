"use client";

// TEMPORARY. Six ways of putting a team logo behind a quarterback's
// headshot, drawn at the two sizes the board actually uses, with the
// real ESPN art. Exists because the effect cannot be judged from
// placeholder shapes - it depends entirely on how a specific outlined
// logo sits against a specific cut-out player on a specific team colour.
//
// Delete this route, and the noindex below, once a variant is chosen.

import { useState } from "react";
import { QUARTERBACKS } from "@/data/rosters/qbs";
import { espnHeadshot } from "@/lib/espnImages";
import { TEAMS } from "@/data/teams";

type Variant = {
  key: string;
  name: string;
  note: string;
  // Size as a multiple of the chip, and where its centre sits as a
  // fraction of the chip from the chip's own centre. Stated this way
  // rather than as raw CSS because the first version of this page set
  // insets on a box that already had a width and a height - which CSS
  // resolves by keeping the size and honouring only left/top, so every
  // mark was shifted up and left instead of enlarged. That is what made
  // them look off-centre.
  logo: { scale: number; dx?: number; dy?: number; filter?: string; opacity: number } | null;
};

const VARIANTS: Variant[] = [
  { key: "none", name: "A — None", note: "What ships today. The control.", logo: null },
  {
    key: "watermark",
    name: "B — Centred watermark",
    note: "Logo a little larger than the chip, centred, low opacity. This is what now ships.",
    logo: { scale: 1.2, opacity: 0.22 },
  },
  {
    key: "corner",
    name: "C — Corner mark",
    note: "Half size, bottom left, stronger. Reads as a badge.",
    logo: { scale: 0.52, dx: -0.2, dy: 0.14, opacity: 0.38 },
  },
  {
    key: "bleed",
    name: "D — Oversized bleed",
    note: "Much larger and pushed off the top-left corner, so only part of it is in frame.",
    logo: { scale: 1.5, dx: -0.32, dy: -0.28, opacity: 0.25 },
  },
  {
    key: "white",
    name: "E — White silhouette",
    note: "Desaturated to white. Looks the same on every team rather than fighting each one's colours.",
    logo: { scale: 1.16, opacity: 0.3, filter: "grayscale(1) brightness(3)" },
  },
  {
    key: "halo",
    name: "F — Behind the head",
    note: "Sized and lifted to sit behind the player's head like a halo.",
    logo: { scale: 0.92, dy: -0.08, opacity: 0.34 },
  },
];

// A spread of team colours: very dark, very bright, mid, and a couple of
// busy logos - the cases where a backdrop is most likely to fall apart.
const PICKS = ["Patrick Mahomes", "Lamar Jackson", "Jordan Love", "Bo Nix", "Jalen Hurts", "Caleb Williams"];

function surname(fullName: string): string {
  const suffixes = new Set(["jr.", "sr.", "ii", "iii", "iv", "v"]);
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const tail = parts.length - (suffixes.has(parts[parts.length - 1].toLowerCase()) ? 2 : 1);
  return parts.slice(tail).join(" ");
}

function captionSize(fullName: string, chip: number): number {
  const chars = Math.max(1, surname(fullName).length);
  return Math.max(6, Math.min(chip * 0.17, (chip - 4) / (0.72 * chars)));
}

function Chip({ name, size, variant }: { name: string; size: number; variant: Variant }) {
  const qb = QUARTERBACKS.find((q) => q.name === name);
  if (!qb) return null;
  const team = TEAMS[qb.team];
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-xl"
      style={{ width: size, height: size }}
      title={`${qb.name} — ${team.city} ${team.name}`}
    >
      <span className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${team.color}, ${team.color}66)` }} />
      {variant.logo && (
        <img
          src={team.logo}
          alt=""
          crossOrigin="anonymous"
          className="pointer-events-none absolute max-w-none select-none object-contain"
          style={{
            width: `${variant.logo.scale * 100}%`,
            height: `${variant.logo.scale * 100}%`,
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${(variant.logo.dx ?? 0) * 100}%), calc(-50% + ${(variant.logo.dy ?? 0) * 100}%))`,
            opacity: variant.logo.opacity,
            filter: variant.logo.filter,
          }}
        />
      )}
      <img
        src={espnHeadshot(qb.espnId)}
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full select-none object-cover object-top"
      />
      <span
        className="absolute inset-x-0 bottom-0 flex items-end justify-center whitespace-nowrap px-1 pb-0.5 text-white"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: captionSize(qb.name, size),
          lineHeight: 1.1,
          background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 55%, transparent)",
          paddingTop: size * 0.22,
          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        }}
      >
        {surname(qb.name)}
      </span>
    </span>
  );
}

export default function QbChipDemo() {
  // 46 is the chip on a 390px phone, 80 on a wide desktop board - the two
  // ends the real solver lands on.
  const [size, setSize] = useState(46);
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        QB CHIP BACKDROPS
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Six ways to put the team logo behind the player. Same chip, same caption, same plate as the real board — only the
        logo layer differs.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {[46, 64, 80].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] transition-colors ${
              size === s ? "border-white/45 bg-white/10 text-white" : "border-white/15 text-white/60 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {s}px {s === 46 ? "· phone" : s === 80 ? "· desktop" : ""}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-9">
        {VARIANTS.map((v) => (
          <section key={v.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {v.name}
            </h2>
            <p className="mt-1 mb-3 text-[12.5px] leading-snug text-white/50">{v.note}</p>
            <div className="flex flex-wrap items-start gap-1.5 rounded-xl bg-black p-2.5">
              {PICKS.map((n) => (
                <Chip key={n} name={n} size={size} variant={v} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
