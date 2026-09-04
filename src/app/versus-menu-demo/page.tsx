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
//   logos in a square. Full Roster IS all thirty-two teams, so the hero
//   shows them one at a time at 168px, cycling, with the ground taking
//   each team's colour as it comes. Quarterback Room cycles faces. A
//   themed draft cycles whatever its items are. Nothing is a collage
//   and nothing needs a hand-made hero image - the art is the pool.
//
//   THE PICKER IS A ROSTER. Small tiles underneath, one per mode, the
//   way a fighting game lays out its characters. The name lives on the
//   hero, not on thirty tiles.
//
// The roster arrangement is chosen. What is left on this page is the
// two ways the hero can move between items. Delete this route, and the
// noindex beside it, once one of those is chosen.

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
  // A word for the tile's label bar. Four of these modes are
  // photographs of men's faces at 30px - without a label, Running Backs
  // and Tight Ends are the same tile.
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
  short: f.slug === "nfl-teams" ? "ROSTER" : "QB",
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

// A SPREAD of the pool, not the top of it. Walking the teams in order
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
// THE HERO, in the two motions. Everything else about it is settled.
// ---------------------------------------------------------------------

type Motion = "slide" | "fan";

// THE FAN's three slots, and the ONE place their numbers live - the
// inline style below and the keyframes at the bottom of the file have
// to agree exactly, or every tick jumps by the difference.
const FAN_X = 62;
const FAN_S = 0.72;
const FAN_O = 0.34;

function Hero({
  format,
  height,
  motion,
  bleed = false,
}: {
  format: MenuFormat;
  height: number;
  motion: Motion;
  bleed?: boolean;
}) {
  const pool = walk(format);
  const i = useCycle(pool.length);
  const cur = pool[i];
  const prev = pool[(i - 1 + pool.length) % pool.length];
  const next = pool[(i + 1) % pool.length];
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
        {/* NOTHING IS EVER DIRECTLY BEHIND ANYTHING.

            This was a crossfade in position: the outgoing item and the
            incoming one sat dead on top of each other and dissolved
            into each other. Round team crests survived that; two
            shoulder-up headshots at the same size in the same spot
            read as one double-exposed face.

            SLIDE fixes the overlap by removing it - the old one leaves
            to the left, the new one arrives from the right 110ms later,
            so they are barely on screen together at all.

            FAN fixes it by staggering - three at once, the one you are
            on big in the middle and its neighbours peeking out either
            side, smaller and dimmed. Each tick everything shuffles one
            place left. You always see three faces, and no two of them
            are ever in the same place. */}
        {/* shrink-0, NOT flex-1. In a flex column, flex-1 is
            flex-basis: 0 - it throws the height away and gives the box
            whatever is left over, which collapsed this to 86px and let
            the 168px marks hang out of both ends of it. The mark's
            shoulders were landing on the item's name and the top of
            the title, on every mode, in both motions. */}
        <div
          className="relative grid shrink-0 place-items-center"
          style={{ height: art + 16, width: motion === "fan" ? art + FAN_X * 2 : art }}
        >
          {motion === "slide" ? (
            <>
              <span key={`p${i}`} className="menu-out absolute">
                <Mark item={prev} size={art} plate={!format.art} />
              </span>
              <span key={`m${i}`} className="menu-in absolute">
                <Mark item={cur} size={art} plate={!format.art} />
              </span>
            </>
          ) : (
            <>
              {/* The base style of each slot is the state its keyframe
                  ends on, so a reduced-motion viewer - who gets no
                  animation at all - still sees the fan sitting
                  correctly rather than three marks in a pile. */}
              <span
                key={`l${i}`}
                className="fan-left absolute"
                style={{ zIndex: 1, transform: `translateX(${-FAN_X}px) scale(${FAN_S})`, opacity: FAN_O }}
              >
                <Mark item={prev} size={art} plate={!format.art} />
              </span>
              <span
                key={`r${i}`}
                className="fan-right absolute"
                style={{ zIndex: 1, transform: `translateX(${FAN_X}px) scale(${FAN_S})`, opacity: FAN_O }}
              >
                <Mark item={next} size={art} plate={!format.art} />
              </span>
              <span key={`c${i}`} className="fan-front absolute" style={{ zIndex: 2 }}>
                <Mark item={cur} size={art} plate={!format.art} />
              </span>
            </>
          )}
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

// WHO IS ON THE THUMBNAIL.
//
// The tile used to take walk()[0] - whoever the stride happened to land
// on - which is how the Wide Receivers tile ended up being Jauan
// Jennings. At 30px a face you do not know is not a face at all, and
// with five NFL rooms in a row it made five tiles of a generic man.
//
// A pool has no ranking in it. `depth` is per team, so it says Chase is
// Cincinnati's first receiver and nothing about whether he is better
// than Jefferson - there is no column that would answer that. So the
// three headliners are hand-kept, which is the honest way to hold an
// opinion: it is three names per mode, in one place, and swapping one
// is editing this list.
const HEADLINERS: Record<string, string[]> = {
  // Teams are ids, players are names.
  "nfl-teams": ["KC", "DAL", "PHI"],
  "qb-room": ["Josh Allen", "Patrick Mahomes", "Lamar Jackson"],
  "rb-room": ["Derrick Henry", "Saquon Barkley", "Jahmyr Gibbs"],
  "wr-room": ["Justin Jefferson", "Ja'Marr Chase", "CeeDee Lamb"],
  "te-room": ["Travis Kelce", "Brock Bowers", "Trey McBride"],
};

// The middle one is the face of the mode, so the list is written with
// the biggest name in the CENTRE rather than first.
function faces(format: MenuFormat): MenuItem[] {
  const want = HEADLINERS[format.slug];
  if (want) {
    const found = want
      .map((w) => format.items.find((it) => it.id === w || it.label === w))
      .filter((it): it is MenuItem => Boolean(it));
    // All three or none. Two headliners and a stranger is worse than
    // three strangers - it looks like something failed to load.
    if (found.length === want.length) return found;
  }
  return walk(format).slice(0, 3);
}

// A roster tile: the same three-up as the hero, small. One face at this
// size says nothing; three say "this is a room of players", and the
// mode's own colour behind them says which room.
function Tile({ format, on, onPick }: { format: MenuFormat; on: boolean; onPick: () => void }) {
  const three = faces(format);
  const mid = three[1] ?? three[0];
  const W = 82;
  const H = 64;
  return (
    <button
      type="button"
      onClick={onPick}
      title={format.title}
      className="relative shrink-0 overflow-hidden rounded-xl transition-all"
      style={{
        width: W,
        height: H,
        background: `linear-gradient(160deg, ${mid?.accent ?? "#1b2c52"}dd, #0b1424)`,
        opacity: on ? 1 : 0.5,
        boxShadow: on ? "0 0 0 2px #3ecb78, 0 0 16px rgba(62,203,120,0.35)" : "0 0 0 1px rgba(255,255,255,0.12)",
        transform: on ? "translateY(-2px)" : undefined,
      }}
    >
      {/* A HEIGHT, or there is nothing to centre in. This wrapper used
          to be top-1 with no height, so it was a zero-tall line and its
          absolutely-centred children straddled it - every mark hung 15px
          out of the top of the tile and got clipped by overflow-hidden.
          Same class of mistake as the hero's collapsed art box. */}
      <span className="absolute inset-x-0 top-0 grid place-items-center" style={{ height: 44 }}>
        {three.map((item, k) => (
          <span
            key={`${item?.id}-${k}`}
            className="absolute"
            style={{
              transform: `translateX(${(k - 1) * 22}px)`,
              opacity: k === 1 ? 1 : 0.5,
              zIndex: k === 1 ? 2 : 1,
            }}
          >
            <Mark item={item} size={k === 1 ? 38 : 30} />
          </span>
        ))}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 block pb-0.5 pt-2 text-center text-[8.5px] tracking-[0.1em]"
        style={{ fontFamily: "var(--font-display)", background: "linear-gradient(to top, rgba(4,8,16,0.92), transparent)" }}
      >
        {format.short}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// THE ROSTER, chosen. Hero on top, every mode laid out underneath in a
// grid that wraps, split by category. Literally a character select
// screen: nothing is hidden, and a new theme is one more tile.
// ---------------------------------------------------------------------

function Roster({ picked, onPick, motion }: { picked: string; onPick: (s: string) => void; motion: Motion }) {
  const format = MENU.find((f) => f.slug === picked) ?? MENU[0];
  return (
    <div className="flex flex-col gap-3">
      <Hero key={`${format.slug}-${motion}`} format={format} height={380} motion={motion} />
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

// The roster is chosen. What is left to decide is how the hero gets
// from one item to the next, which is the thing that fell apart on
// headshots - so both answers are on screen at once rather than behind
// a toggle, because the difference is in the movement and you cannot
// compare two movements you have to switch between.
const TREATMENTS: { key: Motion; name: string; note: string }[] = [
  {
    key: "slide",
    name: "1 — Slide",
    note: "One at a time, the way it is now, but the outgoing item leaves to the left and the next arrives from the right instead of dissolving in place. Biggest art, and the pool goes past like a reel.",
  },
  {
    key: "fan",
    name: "2 — Fan",
    note: "Three at once: the one you are on big in the middle, its neighbours peeking out either side, smaller and dimmed. Everything shuffles one place left each tick. Nothing is ever behind anything, and you can see what is coming.",
  },
];

export default function VersusMenuDemo() {
  const [picked, setPicked] = useState(MENU[0]?.slug ?? "");
  const [width, setWidth] = useState(390);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
      <style>{`
        @keyframes menuFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes menuOut {
          from { opacity: 1; transform: translateX(0) scale(1) }
          to   { opacity: 0; transform: translateX(-52px) scale(0.86) }
        }
        @keyframes menuIn {
          from { opacity: 0; transform: translateX(52px) scale(0.86) }
          to   { opacity: 1; transform: translateX(0) scale(1) }
        }
        .menu-fade { animation: menuFade 520ms ease both; }
        .menu-out  { animation: menuOut 380ms cubic-bezier(0.4,0,0.9,0.4) both; }
        /* The delay is what stops the two from being on screen at the
           same time. The both fill mode holds the from-state through
           it, so the incoming mark waits off to the right rather than
           flashing into place. */
        .menu-in   { animation: menuIn 520ms cubic-bezier(0.16,1,0.3,1) 110ms both; }

        /* THE FAN. Every slot moves one place left, so each mark
           animates from the slot to its right. The numbers have to
           match FAN_X / FAN_S / FAN_O in the component. */
        @keyframes fanFront {
          from { transform: translateX(62px) scale(0.72); opacity: 0.34 }
          to   { transform: translateX(0) scale(1); opacity: 1 }
        }
        @keyframes fanLeft {
          from { transform: translateX(0) scale(1); opacity: 1 }
          to   { transform: translateX(-62px) scale(0.72); opacity: 0.34 }
        }
        @keyframes fanRight {
          from { transform: translateX(124px) scale(0.56); opacity: 0 }
          to   { transform: translateX(62px) scale(0.72); opacity: 0.34 }
        }
        .fan-front { animation: fanFront 560ms cubic-bezier(0.16,1,0.3,1) both; }
        .fan-left  { animation: fanLeft  560ms cubic-bezier(0.16,1,0.3,1) both; }
        .fan-right { animation: fanRight 560ms cubic-bezier(0.16,1,0.3,1) both; }

        @media (prefers-reduced-motion: reduce) {
          .menu-fade, .menu-out, .menu-in,
          .fan-front, .fan-left, .fan-right { animation: none; }
          .menu-out { opacity: 0; }
        }
      `}</style>

      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        GAME SELECT
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
The roster, twice, with the two answers to the marks landing on top of each other. Both keep everything else the
        same: the hero walks the pool, the ground takes each item&rsquo;s colour, the tiles underneath are the roster.
        <strong className="text-white/80"> Only the movement differs.</strong>
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
        {TREATMENTS.map((t) => (
          <section key={t.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {t.name}
            </h2>
            <p className="mb-3 mt-1 max-w-lg text-[12.5px] leading-snug text-white/50">{t.note}</p>
            <div className="rounded-2xl bg-black/40 p-4" style={{ maxWidth: width, overflow: "hidden" }}>
              <Roster picked={picked} onPick={setPicked} motion={t.key} />
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
