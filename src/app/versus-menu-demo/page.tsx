"use client";

// TEMPORARY. The draft picker as a GAME SELECT SCREEN.
//
// Round one was five cards - five dark rounded rectangles with a
// handful of small marks scattered on each. They all looked like each
// other, which is the same complaint as the text list with pictures
// added, and none of them felt like choosing a match.
//
// This is one idea in three arrangements. The idea:
//
//   ONE THING, BIG, AND IT MOVES. A mode's identity is not four little
//   logos in a square. NFL Teams IS all thirty-two, so the hero shows
//   them one at a time at 170px, cycling, with the ground taking each
//   team's colour as it comes. Quarterback Room cycles faces. A themed
//   draft cycles whatever its items are. Nothing is a collage and
//   nothing needs a hand-made hero image - the art is the pool.
//
//   THE PICKER IS A ROSTER. Small tiles underneath, one per mode, the
//   way a fighting game lays out its characters. The name lives on the
//   hero, not on thirty tiles.
//
// Three arrangements of that, A/B/C below. Delete this route, and the
// noindex beside it, once one is chosen.

import { useEffect, useState, useSyncExternalStore } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";
import { TEAMS } from "@/data/teams";
import { espnHeadshot } from "@/lib/espnImages";

// ---------------------------------------------------------------------
// The modes, drawn at seven rather than the two that exist - the whole
// question is what this looks like once there are a lot of them.
// ---------------------------------------------------------------------

type MenuItem = { id: string; label: string; imageUrl?: string; glyph?: string; accent?: string };
type MenuFormat = {
  slug: string;
  title: string;
  // Two or three characters for the tile. A tile is 60px and four of
  // these modes are a photograph of a man's face - without a label,
  // Running Backs and Tight Ends are the same tile.
  short: string;
  tagline: string;
  budget: number;
  category: string;
  slots: { key: string; label: string }[];
  items: MenuItem[];
  // Demo bookkeeping. `art: false` means the items have no pictures
  // yet and are standing in with emoji.
  built: boolean;
  art: boolean;
};

function roomFrom(
  slug: string,
  title: string,
  short: string,
  tagline: string,
  rows: { espnId: string; name: string; team: keyof typeof TEAMS }[],
  slotLabel: string,
): MenuFormat {
  return {
    slug,
    title,
    short,
    tagline,
    budget: 20,
    category: "NFL",
    slots: [1, 2, 3, 4].map((n) => ({ key: `${slug}${n}`, label: `${slotLabel} ${n}` })),
    items: rows.map((r) => ({
      id: r.espnId,
      label: r.name,
      imageUrl: espnHeadshot(r.espnId),
      accent: TEAMS[r.team]?.color,
    })),
    built: false,
    art: true,
  };
}

// A theme on the day it is thought of, before it has art. Emoji rather
// than invented artwork - a picture of a burger I do not have is not a
// thing this page can honestly show. Two of these, not six, because
// they are the least representative thing here: a real themed draft
// ships with real pictures and looks like the NFL modes do.
function themed(slug: string, title: string, short: string, tagline: string, glyphs: string[], accent: string): MenuFormat {
  return {
    slug,
    title,
    short,
    tagline,
    budget: 20,
    category: "Everything else",
    slots: [1, 2, 3, 4].map((n) => ({ key: `${slug}${n}`, label: `Pick ${n}` })),
    items: glyphs.map((g, i) => ({ id: `${slug}-${i}`, label: "", glyph: g, accent })),
    built: false,
    art: false,
  };
}

const REAL: MenuFormat[] = Object.values(AUCTION_FORMATS).map((f) => ({
  slug: f.slug,
  title: f.title,
  short: f.slug === "nfl-teams" ? "NFL" : "QB",
  tagline: f.tagline,
  budget: f.budget,
  category: "NFL",
  slots: f.slots,
  items: f.items,
  built: true,
  art: true,
}));

const MENU: MenuFormat[] = [
  ...REAL,
  roomFrom("rb-room", "Running Backs", "RB", "Four backs each, and every one of them costs", RUNNING_BACKS, "RB"),
  roomFrom("wr-room", "Wide Receivers", "WR", "The deepest pool on the board", WIDE_RECEIVERS, "WR"),
  roomFrom("te-room", "Tight Ends", "TE", "A short pool, so everybody overpays", TIGHT_ENDS, "TE"),
  themed("fast-food", "Fast Food", "FOOD", "Build the four-item order you would defend", ["🍔", "🌮", "🍕", "🍗", "🍟", "🥤", "🍩", "🌭"], "#e8552d"),
  themed("christmas", "Christmas Movies", "XMAS", "Four films, one December", ["🎄", "🎅", "⛄", "🦌", "🔔", "🎁", "❄️", "🕯️"], "#1f7a4c"),
];

const CATEGORIES = ["NFL", "Everything else"];

// ---------------------------------------------------------------------
// The cycle. What makes the hero a portrait rather than a poster.
// ---------------------------------------------------------------------

const CYCLE_MS = 2000;

const MOTION_Q = "(prefers-reduced-motion: reduce)";

function subscribeMotion(cb: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const q = matchMedia(MOTION_Q);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}

function useReduced(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => typeof matchMedia === "function" && matchMedia(MOTION_Q).matches,
    // Server: assume motion is fine, so the markup matches the common
    // case and hydration does not have to swap it.
    () => false,
  );
}

// Walks the pool. The Hero is keyed on its mode, so switching modes
// remounts this at zero rather than picking up wherever the last one
// had got to - a hero that opens mid-shuffle reads as a glitch.
function useCycle(len: number): number {
  const [i, setI] = useState(0);
  const reduced = useReduced();
  useEffect(() => {
    if (reduced || len < 2) return;
    const id = setInterval(() => setI((v) => v + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, [len, reduced]);
  return len > 0 ? i % len : 0;
}

// A SPREAD of the pool, not the top of it. Walking NFL Teams in order
// is Arizona, Atlanta, Baltimore, Buffalo - four red-ish birds in a
// row, so the hero looks stuck. Stepping by a stride that shares no
// factor with 32 walks the whole pool and never repeats a colour twice
// running.
function walk(format: MenuFormat): MenuItem[] {
  const n = format.items.length;
  if (n === 0) return [];
  const stride = n % 7 === 0 ? 5 : 7;
  return Array.from({ length: n }, (_, i) => format.items[(i * stride) % n]);
}

function Mark({ item, size, plate = false }: { item: MenuItem | undefined; size: number; plate?: boolean }) {
  if (!item) return null;
  if (item.glyph) {
    return (
      <span
        aria-hidden
        className={plate ? "grid place-items-center rounded-2xl" : "grid place-items-center"}
        style={{
          width: size,
          height: size,
          fontSize: size * (plate ? 0.52 : 0.8),
          lineHeight: 1,
          background: plate ? "rgba(4,8,16,0.3)" : undefined,
          border: plate ? "1px solid rgba(255,255,255,0.12)" : undefined,
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
        }}
      >
        {item.glyph}
      </span>
    );
  }
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
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))",
      }}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

function ground(accent: string | undefined): string {
  const a = accent ?? "#1b2c52";
  return `radial-gradient(120% 90% at 50% 18%, ${a}ee, ${a}55 46%, #070e1c 100%)`;
}

// ---------------------------------------------------------------------
// THE HERO. Shared by all three arrangements - the arrangements differ
// only in how you get to it.
// ---------------------------------------------------------------------

function Hero({ format, height, bleed = false }: { format: MenuFormat; height: number; bleed?: boolean }) {
  const pool = walk(format);
  const i = useCycle(pool.length);
  const cur = pool[i];
  const prev = pool[(i - 1 + pool.length) % pool.length];
  const art = format.art ? 168 : 150;

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: bleed ? 0 : 20, border: bleed ? "none" : "1px solid rgba(255,255,255,0.12)" }}
    >
      {/* THE GROUND TAKES THE ITEM'S COLOUR. Two layers rather than a
          transition, because a CSS transition does not animate between
          two gradients - the previous one sits underneath at full
          opacity and the new one fades in over it. */}
      <div className="absolute inset-0" style={{ background: ground(prev?.accent) }} />
      <div key={`g${i}`} className="menu-fade absolute inset-0" style={{ background: ground(cur?.accent) }} />

      <div className="relative flex flex-col items-center px-5 pb-5 pt-6" style={{ minHeight: height }}>
        <div className="relative grid flex-1 place-items-center" style={{ height: art + 16, width: art }}>
          <span className="absolute">
            <Mark item={prev} size={art} plate={!format.art} />
          </span>
          <span key={`m${i}`} className="menu-pop absolute">
            <Mark item={cur} size={art} plate={!format.art} />
          </span>
        </div>

        {/* What is on screen right now, named. The line that turns a
            moving picture into "oh, those are the teams". */}
        {/* Fixed height and always rendered, even when a mode's items
            have no names - a line that appears and disappears shoves
            the title up and down every two seconds. */}
        <p className="mt-2 h-5 text-[11px] leading-5 tracking-[0.1em] text-white/45">{cur?.label ?? "\u00a0"}</p>

        <h2 className="mt-2 text-center text-[clamp(1.5rem,6.5vw,2.1rem)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
          {format.title.toUpperCase()}
        </h2>
        <p className="mt-1.5 max-w-[19rem] text-center text-[13px] leading-snug text-white/60">{format.tagline}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {format.slots.map((s) => (
            <span
              key={s.key}
              className="rounded-md px-2 py-1 text-[10px] tracking-[0.12em]"
              style={{
                fontFamily: "var(--font-display)",
                background: "rgba(4,8,16,0.5)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              {s.label.toUpperCase()}
            </span>
          ))}
        </div>

        <p className="mt-2.5 text-[11px] text-white/45">
          {format.items.length} in the pool &middot; ${format.budget} each
        </p>

        <button
          type="button"
          className="mt-4 w-full max-w-[17rem] rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
          style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
        >
          START THE DRAFT
        </button>
      </div>

      {!format.built && <Badge text={format.art ? "NOT BUILT" : "ART TO COME"} />}
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span
      className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[8.5px] tracking-[0.12em]"
      style={{ background: "rgba(4,8,16,0.75)", color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)" }}
    >
      {text}
    </span>
  );
}

// A roster tile. One static mark on the mode's colour, its short label
// under it. Dim until it is the one you are looking at.
function Tile({ format, on, onPick, size = 62 }: { format: MenuFormat; on: boolean; onPick: () => void; size?: number }) {
  const first = walk(format)[0];
  return (
    <button
      type="button"
      onClick={onPick}
      title={format.title}
      className="relative shrink-0 overflow-hidden rounded-xl transition-all"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(160deg, ${first?.accent ?? "#1b2c52"}dd, #0b1424)`,
        opacity: on ? 1 : 0.5,
        boxShadow: on ? "0 0 0 2px #3ecb78, 0 0 16px rgba(62,203,120,0.35)" : "0 0 0 1px rgba(255,255,255,0.12)",
        transform: on ? "translateY(-2px)" : undefined,
      }}
    >
      <span className="absolute inset-x-0 top-1 grid place-items-center">
        <Mark item={first} size={size * 0.56} />
      </span>
      <span
        className="absolute inset-x-0 bottom-0 block pb-0.5 pt-2 text-center text-[8.5px] tracking-[0.1em]"
        style={{ fontFamily: "var(--font-display)", background: "linear-gradient(to top, rgba(4,8,16,0.9), transparent)" }}
      >
        {format.short}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// A - THE ROSTER. Hero on top, every mode laid out underneath in a grid
// that wraps, split by category. Literally a character select screen:
// nothing is hidden, and a new theme is one more tile.
// ---------------------------------------------------------------------

function VariantA({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  const format = MENU.find((f) => f.slug === picked) ?? MENU[0];
  return (
    <div className="flex flex-col gap-3">
      <Hero key={format.slug} format={format} height={380} />
      <div className="flex flex-col gap-2.5">
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <p className="mb-1.5 text-[9.5px] tracking-[0.18em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
              {cat.toUpperCase()}
            </p>
            <div className="flex flex-wrap gap-2">
              {MENU.filter((f) => f.category === cat).map((f) => (
                <Tile key={f.slug} format={f} on={f.slug === picked} onPick={() => onPick(f.slug)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// B - THE STRIP. Hero on top, one row of tiles under it that scrolls
// sideways. Tidier, and the row does not grow taller as modes are
// added - it just gets longer.
// ---------------------------------------------------------------------

function VariantB({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  const format = MENU.find((f) => f.slug === picked) ?? MENU[0];
  return (
    <div className="flex flex-col gap-3">
      <Hero key={format.slug} format={format} height={400} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {MENU.map((f) => (
          <Tile key={f.slug} format={f} on={f.slug === picked} onPick={() => onPick(f.slug)} size={66} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// C - FULL BLEED. No tiles at all: the hero is the entire screen and
// you step through modes with the arrows. The biggest the art can
// possibly be, and the only one where you cannot see what else exists.
// ---------------------------------------------------------------------

function VariantC({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  const at = Math.max(0, MENU.findIndex((f) => f.slug === picked));
  const format = MENU[at];
  const step = (d: number) => onPick(MENU[(at + d + MENU.length) % MENU.length].slug);

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
      <Hero key={format.slug} format={format} height={440} bleed />
      {[-1, 1].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => step(d)}
          aria-label={d < 0 ? "Previous draft" : "Next draft"}
          className="absolute grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[18px] transition-colors"
          style={{
            // Level with the ART, not with the panel. At the panel's
            // midpoint they landed on the item's name and the title,
            // which put a button through the middle of the two lines
            // the hero exists to show.
            top: 116,
            [d < 0 ? "left" : "right"]: 8,
            background: "rgba(4,8,16,0.55)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {d < 0 ? "‹" : "›"}
        </button>
      ))}
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {MENU.map((f, i) => (
          <span
            key={f.slug}
            style={{
              width: i === at ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i === at ? "#3ecb78" : "rgba(255,255,255,0.3)",
              transition: "width 180ms",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

const VARIANTS = [
  {
    key: "a",
    name: "A — The roster",
    note: "Every mode on screen at once under the hero, split by category. Nothing hidden, and a new theme is one more tile. The grid gets taller as modes are added.",
    render: VariantA,
  },
  {
    key: "b",
    name: "B — The strip",
    note: "One row that scrolls sideways instead of a grid that grows. Tidier and the hero gets more room; you can only see about five modes without scrolling.",
    render: VariantB,
  },
  {
    key: "c",
    name: "C — Full bleed",
    note: "No tiles at all — the hero is the whole screen and the arrows step through. Biggest art, and the only one where you cannot see what else is on offer.",
    render: VariantC,
  },
];

export default function VersusMenuDemo() {
  const [picked, setPicked] = useState(MENU[0]?.slug ?? "");
  const [width, setWidth] = useState(390);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
      <style>{`
        @keyframes menuFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes menuPop { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
        .menu-fade { animation: menuFade 520ms ease both; }
        .menu-pop  { animation: menuPop 520ms cubic-bezier(0.2,0.9,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .menu-fade, .menu-pop { animation: none; }
        }
      `}</style>

      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        GAME SELECT
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        One idea in three arrangements. The hero shows the pool <strong className="text-white/80">one item at a time, big</strong>,
        cycling &mdash; NFL Teams is all thirty-two, so it walks them, and the ground takes each team&rsquo;s colour as it
        comes. Nothing is a collage and no mode needs a hand-made hero image.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-white/40">
        Seven modes instead of the two that exist. Three NFL rooms are marked NOT BUILT &mdash; their rosters are already
        synced. Two non-football themes are marked ART TO COME and stand in with emoji; a real themed draft ships with real
        pictures and looks like the NFL modes do.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {[390, 720].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] transition-colors ${
              width === w ? "border-white/45 bg-white/10 text-white" : "border-white/15 text-white/60 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {w === 390 ? "PHONE" : "WIDE"}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-12">
        {VARIANTS.map((v) => (
          <section key={v.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {v.name}
            </h2>
            <p className="mb-3 mt-1 max-w-lg text-[12.5px] leading-snug text-white/50">{v.note}</p>
            <div className="rounded-2xl bg-black/40 p-4" style={{ maxWidth: width, overflow: "hidden" }}>
              <v.render picked={picked} onPick={setPicked} />
            </div>
          </section>
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-white/12 p-4">
        <h2 className="text-[13px]" style={{ fontFamily: "var(--font-display)" }}>
          THE OTHER HALF OF THE CLUNK
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
          The picker is one of three things on <code>/versus</code> at once &mdash; modes, both player names, and the OBS
          overlay link &mdash; and all of it is on screen before you have decided anything. START on the hero would go to a
          short second screen with the two names and the overlay link, which is also what gives the picker the whole screen.
        </p>
      </section>
    </main>
  );
}
