"use client";

import { TEAMS, TEAMS_SORTED, TeamAbbr } from "@/data/teams";

// Temporary demo of what an "NFL Helmets" tier list could actually look
// like - not linked from the nav. Delete once it is a yes or a no.
//
// The point of it: the helmet is DRAWN, not photographed. There is one
// silhouette, used for all 32, filled with the team's real shell colour
// and wearing the team's real logo. Nothing here is a picture of an
// actual helmet, and the page says so out loud in a few places, because
// the whole question is whether a drawing is good enough for a list
// whose entire subject is how the real ones look.

// The real shell colour of each team's primary helmet. Hand-written, and
// it has to be: the site's team colour is the BRAND colour, and for 15 of
// the 32 that is not what is on their head. Steelers gold, Packers dark
// green, Browns brown, Raiders black, Dolphins aqua - all wrong on a
// helmet. Helmets change about once a decade, so unlike a depth chart
// this is fine to keep by hand.
const SHELL: Record<TeamAbbr, string> = {
  ARI: "#97233F", ATL: "#000000", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#FB4F14",
  DAL: "#8A8D8F", DEN: "#002244", DET: "#B0B7BC", GB: "#FFB612",
  HOU: "#03202F", IND: "#FFFFFF", JAX: "#000000", KC: "#E31837",
  LAC: "#FFFFFF", LAR: "#003594", LV: "#A5ACAF", MIA: "#FFFFFF",
  MIN: "#4F2683", NE: "#B0B7BC", NO: "#D3BC8D", NYG: "#0B2265",
  NYJ: "#125740", PHI: "#004C54", PIT: "#000000", SEA: "#002244",
  SF: "#B3995D", TB: "#D50A0A", TEN: "#002244", WAS: "#5A1414",
};

// The teams whose helmet is famous for something this drawing cannot
// draw. Not a complete list of what is missing - a complete list is
// "every stripe, every facemask colour, every finish" - but these are
// the ones where the missing thing IS the design.
const LOSES: Partial<Record<TeamAbbr, string>> = {
  CIN: "The tiger stripes. Without them this is just an orange helmet.",
  DEN: "The orange-and-white side stripe running front to back.",
  KC: "The arrowhead is the logo, but the yellow outline stripe is gone.",
  MIN: "The white horn wrapping the shell - it is not a decal, it is the shape.",
  NYJ: "The white and green stripe over the crown.",
  PHI: "The silver wings sweeping back from the facemask.",
  NE: "The red-white-blue stripe, and the flying-Elvis is only half of it.",
  PIT: "The logo is on ONE side only - the left is bare black.",
  MIA: "The aqua-and-orange stripe on a white shell.",
  LAC: "The bolt is the whole helmet, and it runs off the back edge.",
};

// Light shells need the standard logo; the site's default is the "dark"
// cut, which is outlined for dark backgrounds and disappears on white.
function logoFor(abbr: TeamAbbr, shell: string) {
  const hex = shell.replace("#", "");
  const lum =
    (0.299 * parseInt(hex.slice(0, 2), 16) +
      0.587 * parseInt(hex.slice(2, 4), 16) +
      0.114 * parseInt(hex.slice(4, 6), 16)) /
    255;
  const espn = abbr === "WAS" ? "wsh" : abbr.toLowerCase();
  return lum > 0.6
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${espn}.png`
    : TEAMS[abbr].logo;
}

// One silhouette for all 32. Side view, facing right: round at the back,
// projecting forward into a brow, with the jaw below it and the face
// opening between the two. The ear hole is what gives it scale - without
// it the shape reads as a cap.
const SHELL_PATH = `M 26 132
  C 16 116 14 92 22 72
  C 34 38 74 16 120 16
  C 166 16 200 40 210 78
  C 214 94 213 104 206 112
  L 192 122
  C 178 128 164 131 150 132
  C 149 142 152 152 160 159
  C 142 167 116 166 100 158
  C 74 154 44 148 26 132 Z`;

function Helmet({ abbr, decal = true }: { abbr: TeamAbbr; decal?: boolean }) {
  const shell = SHELL[abbr];
  return (
    <svg viewBox="0 0 232 180" className="h-full w-full" role="img" aria-label={`${TEAMS[abbr].name} helmet`}>
      <g fill="none" stroke="#c7ced9" strokeWidth={9} strokeLinecap="round">
        <path d="M198 118 C218 130 218 146 200 154" />
        <path d="M152 140 L206 137" />
        <path d="M158 158 L200 154" />
      </g>
      <path d={SHELL_PATH} fill={shell} />
      <circle cx="86" cy="104" r="16" fill="rgba(0,0,0,.26)" />
      <circle cx="86" cy="104" r="7" fill="rgba(0,0,0,.32)" />
      {decal && (
        <image href={logoFor(abbr, shell)} x="96" y="40" width="82" height="58" preserveAspectRatio="xMidYMid meet" />
      )}
    </svg>
  );
}

const CARD = "rounded-xl bg-[#0b1730] border border-white/10 overflow-hidden";

export default function HelmetDemo() {
  const striped = (Object.keys(LOSES) as TeamAbbr[]).filter((a) => TEAMS[a]);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8">
      <p className="mb-2 text-[11px] tracking-[0.16em] text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
        TEMPORARY DEMO
      </p>
      <h1 className="mb-4 text-[clamp(1.8rem,6vw,2.5rem)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
        WHAT A HELMET LIST WOULD LOOK LIKE
      </h1>
      <div className="mb-8 max-w-[68ch] space-y-3 text-[15px] text-white/60">
        <p>
          These are <strong className="text-white">drawings</strong>, not photographs. There is one helmet shape, used
          for all 32, filled with each team&rsquo;s <strong className="text-white">real shell colour</strong> and
          wearing their real logo. No NFL helmet photos exist that we can legally use 32 of, so this is the only
          version of this list I can actually build.
        </p>
        <p>
          The shell colours are hand-written and worth checking:{" "}
          <strong className="text-white">15 of the 32 differ from the team colour the site already stores</strong>.
          Steelers are black, not gold. Packers are gold, not green. Browns are orange, not brown. Raiders are silver.
        </p>
      </div>

      <h2 className="mb-3 text-[13px] tracking-[0.12em] text-white/70" style={{ fontFamily: "var(--font-display)" }}>
        ALL 32, AT BOARD SIZE
      </h2>
      <div className="mb-12 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {TEAMS_SORTED.map((t) => (
          <div key={t.abbr} className={CARD}>
            <div className="aspect-[4/3]">
              <Helmet abbr={t.abbr} />
            </div>
            <div className="px-1 pb-1 text-center text-[9px] text-white/40">{t.abbr}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-[13px] tracking-[0.12em] text-white/70" style={{ fontFamily: "var(--font-display)" }}>
        BIG, SO YOU CAN SEE THE DRAWING
      </h2>
      <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["KC", "SEA", "GB", "PIT"] as TeamAbbr[]).map((a) => (
          <div key={a} className={CARD}>
            <div className="aspect-[4/3]">
              <Helmet abbr={a} />
            </div>
            <div className="px-2 pb-2 text-center text-[11px] text-white/50">
              {TEAMS[a].city} {TEAMS[a].name}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-[13px] tracking-[0.12em] text-[#fbbf24]" style={{ fontFamily: "var(--font-display)" }}>
        WHERE IT FALLS DOWN
      </h2>
      <p className="mb-4 max-w-[68ch] text-[14px] text-white/50">
        A helmet list is an argument about stripes, facemasks and finishes. This drawing has none of those. For these
        ten teams the thing it cannot draw <em>is</em> the design people would be ranking.
      </p>
      <div className="mb-12 grid gap-2 sm:grid-cols-2">
        {striped.map((a) => (
          <div key={a} className="flex items-center gap-3 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.04] p-2">
            <div className="h-14 w-20 shrink-0">
              <Helmet abbr={a} />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-white/80" style={{ fontFamily: "var(--font-display)" }}>
                {TEAMS[a].name.toUpperCase()}
              </div>
              <div className="text-[12px] leading-snug text-white/45">{LOSES[a]}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-[13px] tracking-[0.12em] text-white/70" style={{ fontFamily: "var(--font-display)" }}>
        SHAPE ONLY, NO LOGO
      </h2>
      <p className="mb-4 max-w-[68ch] text-[14px] text-white/50">
        Worth seeing on its own: without the decal, how many of these could you name? That is roughly how much work the
        drawing is doing versus how much the logo is doing.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {TEAMS_SORTED.slice(0, 16).map((t) => (
          <div key={t.abbr} className={CARD}>
            <div className="aspect-[4/3]">
              <Helmet abbr={t.abbr} decal={false} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
