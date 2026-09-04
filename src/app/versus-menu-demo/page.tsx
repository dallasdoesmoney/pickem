"use client";

// TEMPORARY. Five ways to choose a draft, drawn with eight modes rather
// than the two that exist today - because the thing being judged is what
// the screen looks like once there are a lot of them, and a picker that
// works for two is exactly the one on the site now.
//
// Every option's art is DERIVED FROM ITS OWN POOL. Nothing here is a
// hand-made hero image, and that is the load-bearing decision: a new
// mode has to stay an entry in a file (see the note at the top of
// format.ts), not an entry in a file plus a design job. So the card
// reaches into format.items, takes a spread of them, and draws their
// marks. The Quarterback Room shows faces because its items are faces.
//
// Delete this route, and the noindex beside it, once one is chosen.

import { useState } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";
import { TEAMS } from "@/data/teams";
import { espnHeadshot } from "@/lib/espnImages";

// ---------------------------------------------------------------------
// The shape a menu needs, which is a little more than a format has.
//
// Two fields the real AuctionFormat would gain if one of these ships:
//
//   category  what shelf it sits on. The moment there is a draft that is
//             not football, "NFL Teams" and "Christmas Movies" in one
//             flat list is the clunkiness, not the card design.
//   glyph     a stand-in mark for an item with no picture yet, so a
//             theme can be added the day it is thought of and get its
//             art later.
// ---------------------------------------------------------------------

type MenuItem = { id: string; label: string; imageUrl?: string; glyph?: string; accent?: string };
type MenuFormat = {
  slug: string;
  title: string;
  tagline: string;
  budget: number;
  category: string;
  slots: { key: string; label: string }[];
  items: MenuItem[];
  // Demo bookkeeping only - marks the four that are not built yet, so
  // nothing on this page pretends to be shippable when it is not.
  real: boolean;
};

function roomFrom(
  slug: string,
  title: string,
  tagline: string,
  rows: { espnId: string; name: string; team: keyof typeof TEAMS }[],
  slotLabel: string,
): MenuFormat {
  return {
    slug,
    title,
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
    real: false,
  };
}

// A theme with no art yet. Emoji rather than invented artwork, because a
// picture of a burger I do not have is not a thing this page can honestly
// show - and because this IS what the first day of a new theme looks
// like. Give its items images later and the same card fills in.
function themed(slug: string, title: string, tagline: string, glyphs: string[], accent: string): MenuFormat {
  return {
    slug,
    title,
    tagline,
    budget: 20,
    category: "Just for fun",
    slots: [1, 2, 3, 4].map((n) => ({ key: `${slug}${n}`, label: `Pick ${n}` })),
    items: glyphs.map((g, i) => ({ id: `${slug}-${i}`, label: g, glyph: g, accent })),
    real: false,
  };
}

const REAL: MenuFormat[] = Object.values(AUCTION_FORMATS).map((f) => ({
  slug: f.slug,
  title: f.title,
  tagline: f.tagline,
  budget: f.budget,
  category: "NFL",
  slots: f.slots,
  items: f.items,
  real: true,
}));

const MENU: MenuFormat[] = [
  ...REAL,
  roomFrom("rb-room", "Running Backs", "Four backs each, and every one of them costs", RUNNING_BACKS, "RB"),
  roomFrom("wr-room", "Wide Receivers", "The deepest pool on the board", WIDE_RECEIVERS, "WR"),
  roomFrom("te-room", "Tight Ends", "A short pool, so everybody overpays", TIGHT_ENDS, "TE"),
  themed("fast-food", "Fast Food", "Build the four-item order you would defend", ["🍔", "🌮", "🍕", "🍗", "🍟", "🥤", "🍩", "🌭"], "#e8552d"),
  themed("candy", "Halloween Candy", "The bucket, drafted", ["🍫", "🍬", "🍭", "🧁", "🍪", "🥧", "🍮", "🍯"], "#7c3aed"),
  themed("christmas", "Christmas Movies", "Four films, one December", ["🎄", "🎅", "⛄", "🦌", "🔔", "🎁", "❄️", "🕯️"], "#1f7a4c"),
];

const CATEGORIES = ["NFL", "Just for fun"];

// ---------------------------------------------------------------------
// The two pieces every variant shares.
// ---------------------------------------------------------------------

// A SPREAD of the pool, not the top of it. Taking items 0..3 off NFL
// Teams gives four alphabetical neighbours - Arizona, Atlanta, Baltimore,
// Buffalo - which is four red-ish birds and reads as one team's tile.
// Stepping through the pool gives a card that looks like the range of
// what is in it.
function artFor(format: MenuFormat, n: number): MenuItem[] {
  const step = Math.max(1, Math.floor(format.items.length / n));
  const out: MenuItem[] = [];
  for (let i = 0; i < n; i++) out.push(format.items[(i * step) % format.items.length]);
  return out.filter(Boolean);
}

function Mark({ item, size, dim = 1 }: { item: MenuItem; size: number; dim?: number }) {
  if (!item) return null;
  if (item.glyph) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          fontSize: size * 0.78,
          lineHeight: `${size}px`,
          textAlign: "center",
          opacity: dim,
          display: "inline-block",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
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
        opacity: dim,
        filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.55))",
      }}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

// The ground each card sits on: the pool's own colours, not one house
// blue. Two accents from the spread, so NFL Teams is not the same
// rectangle as Tight Ends.
function ground(format: MenuFormat): string {
  const art = artFor(format, 4);
  const a = art[0]?.accent ?? "#1b2c52";
  const b = art[2]?.accent ?? "#101d38";
  return `linear-gradient(145deg, ${a}dd, ${b}99 62%, #0b1424 100%)`;
}

const RING = "0 0 0 2px #3ecb78, 0 0 22px rgba(62,203,120,0.35)";

function Slots({ format, muted = false }: { format: MenuFormat; muted?: boolean }) {
  return (
    <span className={`text-[10px] tracking-[0.08em] ${muted ? "text-white/40" : "text-white/55"}`}>
      {format.slots.map((s) => s.label).join(" · ")} &middot; ${format.budget}
    </span>
  );
}

function NotBuilt({ format }: { format: MenuFormat }) {
  if (format.real) return null;
  return (
    <span
      className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] tracking-[0.1em]"
      style={{ background: "rgba(4,8,16,0.78)", color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)" }}
      title="Drawn to show the menu at scale - this mode does not exist yet"
    >
      NOT BUILT
    </span>
  );
}

// ---------------------------------------------------------------------
// A - CREST TILES. A square each, two up. Four marks in a 2x2 over the
// pool's colours, title on a band across the bottom.
// ---------------------------------------------------------------------

function VariantA({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {MENU.map((f) => {
        const art = artFor(f, 4);
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onPick(f.slug)}
            className="relative overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.985]"
            style={{
              aspectRatio: "1 / 1",
              background: ground(f),
              boxShadow: picked === f.slug ? RING : "0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            <NotBuilt format={f} />
            <span className="absolute inset-0 grid grid-cols-2 place-items-center p-3 pb-9">
              {art.map((item, i) => (
                <Mark key={`${item?.id}-${i}`} item={item} size={46} dim={0.95} />
              ))}
            </span>
            <span
              className="absolute inset-x-0 bottom-0 block px-2.5 pb-2 pt-6"
              style={{ background: "linear-gradient(to top, rgba(4,8,16,0.94), rgba(4,8,16,0.7) 45%, transparent)" }}
            >
              <span className="block text-[12px] leading-tight tracking-[0.06em]" style={{ fontFamily: "var(--font-display)" }}>
                {f.title.toUpperCase()}
              </span>
              <span className="mt-0.5 block text-[9.5px] text-white/45">
                {f.slots.length} slots &middot; ${f.budget}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// B - SHELVES. Grouped by category, each a row that scrolls sideways.
// The one shape that does not get worse as modes are added: a new theme
// is a new poster on a shelf, or a new shelf.
// ---------------------------------------------------------------------

function VariantB({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h3 className="mb-2 text-[11px] tracking-[0.18em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
            {cat.toUpperCase()}
          </h3>
          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2">
            {MENU.filter((f) => f.category === cat).map((f) => {
              const art = artFor(f, 4);
              return (
                <button
                  key={f.slug}
                  type="button"
                  onClick={() => onPick(f.slug)}
                  className="relative shrink-0 snap-start overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.985]"
                  style={{
                    width: 136,
                    background: ground(f),
                    boxShadow: picked === f.slug ? RING : "0 0 0 1px rgba(255,255,255,0.12)",
                  }}
                >
                  <NotBuilt format={f} />
                  {/* One mark big, three small under it. A poster has a
                      subject; a grid of four equal marks does not. */}
                  <span className="flex h-[124px] items-center justify-center pt-3">
                    <Mark item={art[0]} size={68} />
                  </span>
                  <span className="flex items-center justify-center gap-1.5 pb-2">
                    {art.slice(1).map((item, i) => (
                      <Mark key={`${item?.id}-${i}`} item={item} size={22} dim={0.6} />
                    ))}
                  </span>
                  <span className="block px-2.5 pb-2.5" style={{ background: "rgba(4,8,16,0.55)" }}>
                    <span className="block pt-2 text-[11.5px] leading-tight tracking-[0.05em]" style={{ fontFamily: "var(--font-display)" }}>
                      {f.title.toUpperCase()}
                    </span>
                    <span className="mt-0.5 block text-[9.5px] leading-snug text-white/45">{f.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// C - BANNER ROWS. Today's list with an art panel bolted to the left.
// The smallest change on the page, and the only one that keeps the
// tagline at a readable size.
// ---------------------------------------------------------------------

function VariantC({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {MENU.map((f) => {
        const art = artFor(f, 3);
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onPick(f.slug)}
            className="relative flex items-stretch gap-3 overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.995]"
            style={{
              background: "#101d38",
              boxShadow: picked === f.slug ? RING : "0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            {/* Three marks overlapped, so the panel reads as a pool
                rather than as one logo standing for the whole mode. */}
            <span className="relative flex h-[86px] w-[106px] shrink-0 items-center justify-center" style={{ background: ground(f) }}>
              {art.map((item, i) => (
                // The panel has to be wide enough for the whole fan. At
                // 92px the third mark ran off its right edge and was
                // clipped in half - which reads as a broken image, not
                // as a stack.
                <span key={`${item?.id}-${i}`} style={{ position: "absolute", left: 10 + i * 24, zIndex: 3 - i }}>
                  <Mark item={item} size={i === 0 ? 44 : 36} dim={i === 0 ? 1 : 0.75} />
                </span>
              ))}
            </span>
            <span className="flex min-w-0 flex-col justify-center py-2 pr-3">
              <span className="text-[13px] tracking-[0.07em]" style={{ fontFamily: "var(--font-display)" }}>
                {f.title.toUpperCase()}
              </span>
              <span className="mt-0.5 truncate text-[12px] text-white/50">{f.tagline}</span>
              <span className="mt-1">
                <Slots format={f} muted />
              </span>
            </span>
            <NotBuilt format={f} />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// D - THE LINEUP. The card is the roster you would be filling: one cell
// per slot, with a real item from the pool behind each label. Says what
// the mode IS in a way a title cannot - five slots of NFL Teams and four
// quarterbacks are different games, and this is the only card that shows
// that before you start.
// ---------------------------------------------------------------------

function VariantD({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {MENU.map((f) => {
        const art = artFor(f, f.slots.length);
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onPick(f.slug)}
            className="relative overflow-hidden rounded-2xl px-3 pb-2.5 pt-2.5 text-left transition-transform active:scale-[0.995]"
            style={{
              background: ground(f),
              boxShadow: picked === f.slug ? RING : "0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            <NotBuilt format={f} />
            <span className="block text-[13px] tracking-[0.07em]" style={{ fontFamily: "var(--font-display)" }}>
              {f.title.toUpperCase()}
            </span>
            <span className="mt-2 flex gap-1.5">
              {f.slots.map((s, i) => (
                <span
                  key={s.key}
                  className="relative flex flex-1 flex-col items-center justify-end overflow-hidden rounded-lg pb-1 pt-1"
                  style={{ height: 58, background: "rgba(4,8,16,0.45)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  <span className="absolute inset-x-0 top-1 flex justify-center">
                    <Mark item={art[i]} size={34} dim={0.55} />
                  </span>
                  <span className="relative text-[9px] tracking-[0.1em] text-white/80" style={{ fontFamily: "var(--font-display)" }}>
                    {s.label.toUpperCase()}
                  </span>
                </span>
              ))}
            </span>
            <span className="mt-1.5 block text-[11px] text-white/45">
              {f.items.length} in the pool &middot; ${f.budget} each
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// E - THE FAN. Marks dealt across the card like a hand, tilted. The pool
// as a physical thing rather than a grid of icons.
// ---------------------------------------------------------------------

function VariantE({ picked, onPick }: { picked: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {MENU.map((f) => {
        const art = artFor(f, 5);
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onPick(f.slug)}
            className="relative overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.995]"
            style={{
              background: ground(f),
              boxShadow: picked === f.slug ? RING : "0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            <NotBuilt format={f} />
            <span className="relative flex h-[96px] items-center justify-center">
              {art.map((item, i) => {
                const mid = (art.length - 1) / 2;
                return (
                  <span
                    key={`${item?.id}-${i}`}
                    style={{
                      position: "absolute",
                      left: `calc(50% + ${(i - mid) * 46}px)`,
                      transform: `translateX(-50%) rotate(${(i - mid) * 8}deg) translateY(${Math.abs(i - mid) * 5}px)`,
                      zIndex: 10 - Math.abs(i - mid),
                    }}
                  >
                    <span
                      className="grid place-items-center rounded-xl"
                      style={{
                        width: 62,
                        height: 62,
                        background: "rgba(4,8,16,0.55)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        boxShadow: "0 6px 14px rgba(0,0,0,0.45)",
                      }}
                    >
                      <Mark item={item} size={44} />
                    </span>
                  </span>
                );
              })}
            </span>
            <span
              className="block px-3 pb-2.5 pt-2"
              style={{ background: "linear-gradient(to top, rgba(4,8,16,0.92), rgba(4,8,16,0.55))" }}
            >
              <span className="block text-[13px] tracking-[0.07em]" style={{ fontFamily: "var(--font-display)" }}>
                {f.title.toUpperCase()}
              </span>
              <span className="mt-0.5 block text-[12px] text-white/50">{f.tagline}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------

const VARIANTS = [
  {
    key: "a",
    name: "A — Crest tiles",
    note: "Two up, square, four marks from the pool in each. Most modes visible at once; the tagline does not fit, so the title has to carry the whole idea.",
    render: VariantA,
  },
  {
    key: "b",
    name: "B — Shelves",
    note: "Grouped by category, each shelf scrolling sideways. The only one that does not get worse with thirty modes — a new theme is a new poster, or a new shelf. Sideways scroll hides things, which is the cost.",
    render: VariantB,
  },
  {
    key: "c",
    name: "C — Banner rows",
    note: "Today's list with an art panel on the left. Smallest change here, keeps the tagline readable, and a long list is still a long scroll.",
    render: VariantC,
  },
  {
    key: "d",
    name: "D — The lineup",
    note: "The card is the roster you would fill, one cell per slot with a real item behind each. The only one that shows five NFL slots and four quarterbacks are different games before you start.",
    render: VariantD,
  },
  {
    key: "e",
    name: "E — The fan",
    note: "The pool dealt out like a hand. The most physical, and the loudest — five cards each is a lot of card for a list of eight.",
    render: VariantE,
  },
];

export default function VersusMenuDemo() {
  const [picked, setPicked] = useState(MENU[0]?.slug ?? "");
  const [width, setWidth] = useState(390);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        CHOOSING A DRAFT
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        Five pickers, each drawn with <strong className="text-white/80">eight</strong> modes instead of the two that exist,
        because the question is what this looks like once there are a lot of them. Every card&rsquo;s art comes out of the
        format&rsquo;s own pool — no mode needs a hand-made hero image to be added.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-white/40">
        Six of the eight are marked NOT BUILT: three NFL rooms off rosters that are already synced, and three non-football
        themes standing in with emoji to show what a theme looks like the day it is added, before it has art.
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
          The picker is one of three things on <code>/versus</code> at once — modes, both player names, and the OBS overlay
          link — and all of it is on screen before you have decided anything. Whichever card wins, the screen wants to be two
          steps: <strong className="text-white/80">pick the draft</strong>, then a short second screen with the two names,
          the overlay link and START. That also gives the picker the whole screen, which is what every one of these cards is
          asking for.
        </p>
      </section>
    </main>
  );
}
