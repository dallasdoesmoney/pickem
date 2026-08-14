"use client";

import { TEAMS } from "@/data/teams";
import { darkenColor } from "@/components/TeamHalfPill";

// Temporary side-by-side demo of candidate textured-background options for
// the predictor page - not linked from the nav. Delete once a winner is
// picked. All CSS-only (gradients), so nothing to import/optimize, and
// each one automatically re-colors to whatever team is being tested.
const bg = darkenColor(TEAMS.DAL.color, 0.55, 1);
const lightLine = "rgba(255,255,255,0.08)";
const lightLineStrong = "rgba(255,255,255,0.14)";

const SWATCHES = [
  {
    name: "1. Diagonal pinstripe",
    blurb: "Thin jersey-style pinstripes on a 45deg angle.",
    style: {
      backgroundColor: bg,
      backgroundImage: `repeating-linear-gradient(45deg, ${lightLine} 0px, ${lightLine} 1px, transparent 1px, transparent 14px)`,
    },
  },
  {
    name: "2. Field grid",
    blurb: "Yard-line style grid - horizontal + vertical hairlines.",
    style: {
      backgroundColor: bg,
      backgroundImage: `linear-gradient(${lightLine} 1px, transparent 1px), linear-gradient(90deg, ${lightLine} 1px, transparent 1px)`,
      backgroundSize: "28px 28px",
    },
  },
  {
    name: "3. Halftone dots",
    blurb: "Small evenly-spaced dots, like an old sports poster print.",
    style: {
      backgroundColor: bg,
      backgroundImage: `radial-gradient(${lightLine} 1.4px, transparent 1.4px)`,
      backgroundSize: "12px 12px",
    },
  },
  {
    name: "4. Herringbone",
    blurb: "Two-directional weave - subtler, more fabric-like than pinstripe.",
    style: {
      backgroundColor: bg,
      backgroundImage: `repeating-linear-gradient(45deg, ${lightLine} 0px, ${lightLine} 1px, transparent 1px, transparent 10px), repeating-linear-gradient(-45deg, ${lightLine} 0px, ${lightLine} 1px, transparent 1px, transparent 10px)`,
    },
  },
  {
    name: "5. Football pebble",
    blurb: "Staggered dot grid mimicking football-leather grain.",
    style: {
      backgroundColor: bg,
      backgroundImage: `radial-gradient(${lightLineStrong} 1px, transparent 1px), radial-gradient(${lightLineStrong} 1px, transparent 1px)`,
      backgroundSize: "10px 10px",
      backgroundPosition: "0 0, 5px 5px",
    },
  },
  {
    name: "6. Diamond crosshatch",
    blurb: "Crossed diagonals forming a diamond-plate pattern.",
    style: {
      backgroundColor: bg,
      backgroundImage: `repeating-linear-gradient(60deg, ${lightLine} 0px, ${lightLine} 1px, transparent 1px, transparent 16px), repeating-linear-gradient(-60deg, ${lightLine} 0px, ${lightLine} 1px, transparent 1px, transparent 16px)`,
    },
  },
  {
    name: "7. Faint grain (toned way down)",
    blurb: "The original noise texture, but at 6% instead of 22% - barely-there option.",
    style: {
      backgroundColor: bg,
      backgroundImage: "url(/noise.png)",
      backgroundSize: "128px 128px",
      opacity: undefined,
    },
    overlayOpacity: 0.06,
  },
];

export default function TextureDemoPage() {
  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-2xl w-full mx-auto">
      <h1 className="text-2xl mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>
        BACKGROUND TEXTURE OPTIONS
      </h1>
      <p className="text-sm text-white/50 text-center mb-10">All on the same Cowboys navy. Pick a number.</p>

      <div className="flex flex-col gap-6">
        {SWATCHES.map((s) => (
          <div key={s.name} className="flex flex-col gap-2">
            <div>
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-display)" }}>
                {s.name}
              </div>
              <div className="text-xs text-white/50">{s.blurb}</div>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ height: 140 }}>
              {"overlayOpacity" in s ? (
                <>
                  <div className="absolute inset-0" style={{ backgroundColor: bg }} />
                  <div className="absolute inset-0" style={{ ...s.style, opacity: s.overlayOpacity }} />
                </>
              ) : (
                <div className="absolute inset-0" style={s.style} />
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
