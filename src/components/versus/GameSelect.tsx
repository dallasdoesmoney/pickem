"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { AuctionFormat, AuctionItem } from "@/lib/auction/format";

// CHOOSING A DRAFT.
//
// This was a stack of dark rectangles with three lines of text in each,
// which works for two modes and is the whole problem for the twenty
// that are coming: nothing on it said what you would be drafting, so
// every option looked the same until you read it.
//
// It is a game select screen now, and the load-bearing decision is that
// EVERY PICTURE ON IT COMES OUT OF THE FORMAT'S OWN POOL. Nothing needs
// a hand-made hero image, so a new mode stays what it is in this
// codebase - an entry in a file - rather than an entry in a file plus a
// design job.
//
// The hero is a fan of three: the item you are on, big in the middle,
// its neighbours peeking out either side, smaller and dimmed, shuffling
// one place left every couple of seconds. It was a crossfade in place
// first, and that fell apart on the Quarterback Room - two shoulder-up
// headshots at the same size in the same spot dissolve into one
// double-exposed face. Three at once, never in the same place, cannot
// do that.

const CYCLE_MS = 2000;

// The fan's three slots. These numbers are also written into the
// keyframes below, and the two have to agree exactly or every tick
// jumps by the difference.
const FAN_X = 62;
const FAN_S = 0.72;
const FAN_O = 0.34;

const ART = 168;
const GREEN = "#3ecb78";

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
    // case and hydration has nothing to swap.
    () => false,
  );
}

// The Hero is keyed on its mode, so switching modes remounts this at
// the start rather than picking up wherever the last one had got to - a
// hero that opens mid-shuffle reads as a glitch.
function useCycle(len: number, start = 0): number {
  const [i, setI] = useState(start);
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
// row, so the hero looks stuck. A stride sharing no factor with the
// pool size walks the whole thing and never repeats a colour twice
// running.
function walk(format: AuctionFormat): AuctionItem[] {
  const n = format.items.length;
  if (n === 0) return [];
  const stride = n % 7 === 0 ? 5 : 7;
  return Array.from({ length: n }, (_, i) => format.items[(i * stride) % n]);
}

// Who fronts the mode on its tile. Falls back to a spread of the pool
// when a format has no opinion - see the note on `headliners` in
// format.ts for why this is hand-kept rather than computed.
function faces(format: AuctionFormat): AuctionItem[] {
  const want = format.headliners;
  if (want) {
    const found = want
      .map((id) => format.items.find((it) => it.id === id))
      .filter((it): it is AuctionItem => Boolean(it));
    if (found.length === want.length) return found;
  }
  return walk(format).slice(0, 3);
}

function Mark({ item, size }: { item: AuctionItem | undefined; size: number }) {
  if (!item) return null;
  if (!item.imageUrl) {
    // A mode whose items have no art yet. A dim plate rather than
    // nothing, so the fan keeps its shape instead of collapsing into
    // one lonely mark.
    return (
      <span
        aria-hidden
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: size * 0.18,
          background: `${item.accent ?? "#22304f"}55`,
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      />
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

// THE CARD OPENS ON WHAT ITS TILE SHOWS.
//
// The hero used to walk a spread of the pool from wherever the stride
// began, so the Full Roster tile said Kansas City / Dallas / Philly and
// the card it opened said Arizona - the same mode wearing two different
// faces on one screen. The headliners go first, then the rest of the
// pool behind them.
//
// Index 1, not 0, because the fan draws pool[i-1], pool[i], pool[i+1]
// left to right: the middle headliner has to sit at index 1 for the
// first frame to BE the tile.
const OPENS_AT = 1;

function heroOrder(format: AuctionFormat): AuctionItem[] {
  const three = faces(format);
  const seen = new Set(three.map((it) => it.id));
  return [...three, ...walk(format).filter((it) => !seen.has(it.id))];
}

function Hero({ format, onConfirm }: { format: AuctionFormat; onConfirm: () => void }) {
  const pool = heroOrder(format);
  const i = useCycle(pool.length, OPENS_AT);
  const cur = pool[i];
  const prev = pool[(i - 1 + pool.length) % pool.length];
  const next = pool[(i + 1) % pool.length];

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
      {/* THE GROUND TAKES THE ITEM'S COLOUR, so Full Roster breathes
          through thirty-two team colours as it walks them. Two layers
          rather than a transition, because a CSS transition does not
          animate between two gradients: the previous one sits
          underneath at full opacity and the new one fades in over it. */}
      <div className="absolute inset-0" style={{ background: ground(prev?.accent) }} />
      <div key={`g${i}`} className="gs-fade absolute inset-0" style={{ background: ground(cur?.accent) }} />

      {/* TIGHT ENOUGH THAT THE TILES CLEAR THE FOLD. At the roomier
          spacing this had, the last tile's bottom edge landed at 740 on
          a 390x730 phone - ten pixels under - so the picker's whole
          point, seeing what else there is, was below a screen that
          ended on a green button. Measured, not guessed. */}
      <div className="relative flex flex-col items-center px-5 pb-4 pt-4" style={{ minHeight: 348 }}>
        {/* shrink-0, NOT flex-1. In a flex column flex-1 is
            flex-basis: 0 - it throws the height away and hands the box
            whatever is left over, which collapses it and lets the marks
            hang out of both ends onto the lines below. */}
        <div
          className="relative grid shrink-0 place-items-center"
          style={{ height: ART + 8, width: ART + FAN_X * 2 }}
        >
          {/* Each slot's base style is the state its keyframe ends on,
              so a reduced-motion viewer - who gets no animation at all -
              still sees the fan sitting correctly rather than three
              marks in a pile. */}
          <span
            key={`l${i}`}
            className="gs-left absolute"
            style={{ zIndex: 1, transform: `translateX(${-FAN_X}px) scale(${FAN_S})`, opacity: FAN_O }}
          >
            <Mark item={prev} size={ART} />
          </span>
          <span
            key={`r${i}`}
            className="gs-right absolute"
            style={{ zIndex: 1, transform: `translateX(${FAN_X}px) scale(${FAN_S})`, opacity: FAN_O }}
          >
            <Mark item={next} size={ART} />
          </span>
          <span key={`c${i}`} className="gs-front absolute" style={{ zIndex: 2 }}>
            <Mark item={cur} size={ART} />
          </span>
        </div>

        {/* What is on screen right now, named - the line that turns a
            moving picture into "oh, those are the teams". Fixed height
            and always rendered: a line that appears and disappears
            shoves the title up and down every two seconds. */}
        <p className="mt-2 h-5 text-[11px] leading-5 tracking-[0.1em] text-white/45">{cur?.label ?? " "}</p>

        <h2
          className="mt-2 text-center text-[clamp(1.5rem,6.5vw,2.1rem)] leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
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

        <p className="mt-2 text-[11px] text-white/45">
          {format.items.length} in the pool &middot; ${format.budget} each
        </p>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-3 w-full max-w-[17rem] rounded-xl px-5 py-3 text-[13px] tracking-[0.16em] text-[#08111f] transition-transform active:scale-[0.99]"
          style={{ fontFamily: "var(--font-display)", background: GREEN }}
        >
          PICK THIS DRAFT
        </button>
      </div>
    </div>
  );
}

// A roster tile: the same three-up as the hero, small. One face at this
// size says nothing - and with several rooms of players in a row it
// makes several tiles of the same generic man - so it is three, and the
// mode's own colour behind them says which room.
function Tile({ format, on, onPick }: { format: AuctionFormat; on: boolean; onPick: () => void }) {
  const three = faces(format);
  const mid = three[1] ?? three[0];
  return (
    <button
      type="button"
      onClick={onPick}
      title={format.title}
      aria-pressed={on}
      className="relative shrink-0 overflow-hidden rounded-xl transition-all"
      style={{
        width: 82,
        height: 64,
        background: `linear-gradient(160deg, ${mid?.accent ?? "#1b2c52"}dd, #0b1424)`,
        opacity: on ? 1 : 0.5,
        boxShadow: on ? `0 0 0 2px ${GREEN}, 0 0 16px rgba(62,203,120,0.35)` : "0 0 0 1px rgba(255,255,255,0.12)",
        transform: on ? "translateY(-2px)" : undefined,
      }}
    >
      {/* A HEIGHT, or there is nothing to centre in: with none, this is
          a zero-tall line and its absolutely-centred children straddle
          it, hanging out of the top of the tile to be clipped away. */}
      <span className="absolute inset-x-0 top-0 grid place-items-center" style={{ height: 44 }}>
        {three.map((item, k) => (
          <span
            key={`${item?.id}-${k}`}
            className="absolute"
            style={{ transform: `translateX(${(k - 1) * 22}px)`, opacity: k === 1 ? 1 : 0.5, zIndex: k === 1 ? 2 : 1 }}
          >
            <Mark item={item} size={k === 1 ? 38 : 30} />
          </span>
        ))}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 block pb-0.5 pt-2 text-center text-[8.5px] tracking-[0.1em]"
        style={{
          fontFamily: "var(--font-display)",
          background: "linear-gradient(to top, rgba(4,8,16,0.92), transparent)",
        }}
      >
        {format.short}
      </span>
    </button>
  );
}

export function GameSelectStyles() {
  return (
    <style>{`
      @keyframes gsFade { from { opacity: 0 } to { opacity: 1 } }
      /* Every slot moves one place left, so each mark animates from the
         slot to its right. These numbers match FAN_X / FAN_S / FAN_O. */
      @keyframes gsFront {
        from { transform: translateX(62px) scale(0.72); opacity: 0.34 }
        to   { transform: translateX(0) scale(1); opacity: 1 }
      }
      @keyframes gsLeft {
        from { transform: translateX(0) scale(1); opacity: 1 }
        to   { transform: translateX(-62px) scale(0.72); opacity: 0.34 }
      }
      @keyframes gsRight {
        from { transform: translateX(124px) scale(0.56); opacity: 0 }
        to   { transform: translateX(62px) scale(0.72); opacity: 0.34 }
      }
      .gs-fade  { animation: gsFade 520ms ease both; }
      .gs-front { animation: gsFront 560ms cubic-bezier(0.16,1,0.3,1) both; }
      .gs-left  { animation: gsLeft  560ms cubic-bezier(0.16,1,0.3,1) both; }
      .gs-right { animation: gsRight 560ms cubic-bezier(0.16,1,0.3,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .gs-fade, .gs-front, .gs-left, .gs-right { animation: none; }
      }
    `}</style>
  );
}

export function GameSelect({
  formats,
  slug,
  onPick,
  onConfirm,
}: {
  formats: AuctionFormat[];
  slug: string;
  onPick: (slug: string) => void;
  onConfirm: () => void;
}) {
  const format = formats.find((f) => f.slug === slug) ?? formats[0];
  // Shelves, in the order the formats are declared rather than
  // alphabetically - the first mode listed is the one to lead with.
  const shelves: string[] = [];
  for (const f of formats) {
    const cat = f.category ?? "Drafts";
    if (!shelves.includes(cat)) shelves.push(cat);
  }

  if (!format) return null;

  return (
    <div className="flex flex-col gap-3">
      <GameSelectStyles />
      <Hero key={format.slug} format={format} onConfirm={onConfirm} />

      <div className="flex flex-col gap-2.5">
        {shelves.map((cat) => (
          <div key={cat}>
            {/* A shelf label only earns its line when there is more than
                one shelf. With everything on "NFL" it is a heading that
                separates nothing from nothing. */}
            {shelves.length > 1 && (
              <p
                className="mb-1.5 text-[9.5px] tracking-[0.18em] text-white/35"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cat.toUpperCase()}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {formats
                .filter((f) => (f.category ?? "Drafts") === cat)
                .map((f) => (
                  <Tile key={f.slug} format={f} on={f.slug === slug} onPick={() => onPick(f.slug)} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The chosen draft, restated small on the setup screen. Without it the
// second step is two name boxes and a button with no memory of what you
// just picked.
export function ChosenDraft({ format, onChange }: { format: AuctionFormat; onChange: () => void }) {
  const three = faces(format);
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{ background: `linear-gradient(160deg, ${three[1]?.accent ?? "#1b2c52"}bb, #0b1424)`, border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <span className="relative grid h-11 w-[74px] shrink-0 place-items-center">
        {three.map((item, k) => (
          <span
            key={`${item?.id}-${k}`}
            className="absolute"
            style={{ transform: `translateX(${(k - 1) * 20}px)`, opacity: k === 1 ? 1 : 0.5, zIndex: k === 1 ? 2 : 1 }}
          >
            <Mark item={item} size={k === 1 ? 34 : 26} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] tracking-[0.06em]" style={{ fontFamily: "var(--font-display)" }}>
          {format.title.toUpperCase()}
        </span>
        {/* No "each" here. With five slots the line wrapped and left
            the word dangling on its own row; the hero already said it. */}
        <span className="mt-0.5 block text-[11px] text-white/50">
          {format.slots.map((s) => s.label).join(" · ")} &middot; ${format.budget}
        </span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1.5 text-[10px] tracking-[0.12em] text-white/70 transition-colors hover:text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        CHANGE
      </button>
    </div>
  );
}
