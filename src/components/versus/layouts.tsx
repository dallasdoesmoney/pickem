"use client";

import type { CSSProperties } from "react";
import type { AuctionFormat, SlotDef } from "@/lib/auction/format";
import { AuctionState, RosterEntry, toAct, currentItem } from "@/lib/auction/engine";
import { PLAYER_COLORS, MONEY, outlined } from "./style";
import { LogoReel, LotLogo, LotWaiting } from "./LotReel";

// ONE SHAPE, FIVE WAYS.
//
// Settled, from looking at the first five: the lot and the money go big
// and dead centre (that was C), and each player's positions run down the
// far EDGE of the screen, left and right (that was A). Everything below
// is that shape with the knobs turned differently.
//
// Also settled and shared: a surname rather than a full name, the team
// badge beside it doing the work of the rest, the position label on the
// SAME LINE as the pick, and the money immediately under the logo.
//
// The band between two cameras is the whole canvas, and height is the
// scarce dimension - every pixel this takes is a pixel of somebody's
// face. So the variants are mostly arguments about height.

// ---------------------------------------------------------------- pieces

export function Money({ amount, size, color = MONEY }: { amount: number; size: number; color?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariantNumeric: "tabular-nums",
        ...outlined(size),
      }}
    >
      ${amount}
    </span>
  );
}

function Badge({ url, size }: { url?: string; size: number }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 2px 0 rgba(5,7,13,0.8))" }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

// A WR Duo is two surnames - "EVANS + SAMUEL SR." - where every other
// slot is one. Sized for the common case it overflowed; sized for the
// duo, every single-name pick was needlessly small. So it shrinks only
// as far as the long one needs, and only when it is long.
function fitSize(text: string, base: number, comfortable: number): number {
  if (text.length <= comfortable) return base;
  return Math.max(base * 0.5, (base * comfortable) / text.length);
}

// One roster line: POSITION, then who is in it, on ONE line.
//
// It used to be the label with the name stacked underneath, which is
// twice the height for the same information. A surname fits beside the
// label where a full name did not, and the badge is what makes a surname
// on its own unambiguous.
function PosRow({
  slot,
  entry,
  color,
  align,
  size = 30,
}: {
  slot: SlotDef;
  entry: RosterEntry | null;
  color: string;
  align: "left" | "right";
  size?: number;
}) {
  const badge = Math.round(size * 1.05);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "left" ? "row" : "row-reverse",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: badge,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: size * 0.72,
          lineHeight: 1,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 1,
          minWidth: size * 2.5,
          textAlign: align,
          flexShrink: 0,
          ...outlined(size * 0.72),
        }}
      >
        {slot.label.toUpperCase()}
      </span>
      {entry ? (
        (() => {
          const text = (entry.short ?? entry.label).toUpperCase();
          const fitted = fitSize(text, size, 11);
          return (
            <>
              <Badge url={entry.badge} size={badge} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: fitted,
                  lineHeight: 1,
                  color,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  ...outlined(fitted),
                }}
              >
                {text}
              </span>
            </>
          );
        })()
      ) : (
        <span style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
      )}
    </div>
  );
}

// The lot itself: not started, spinning, or landed. Always the same box,
// so the reel stops dead on the real logo instead of the layout jumping.
function Lot({ state, format, size }: { state: AuctionState; format: AuctionFormat; size: number }) {
  const item = currentItem(state, format);
  if (state.phase === "ready") return <LotWaiting size={size} />;
  if (state.phase === "spinning" && item) return <LogoReel key={item.id} format={format} targetId={item.id} size={size} />;
  return <LotLogo item={item} size={size} />;
}

// What the big number says, and whose colour it is.
function headline(state: AuctionState, format: AuctionFormat) {
  const acting = toAct(state, format);
  const waitingOn = acting ?? (state.phase === "ready" || state.phase === "spinning" ? state.opener : null);
  if (state.phase === "done") return { text: "DRAFT COMPLETE", color: "#ffffff", amount: null as number | null, live: false };
  if (state.phase === "assigning" && state.won) {
    return { text: `SOLD TO ${state.players[state.won.by].name.toUpperCase()}`, color: PLAYER_COLORS[state.won.by], amount: state.won.price, live: true };
  }
  if (state.bid) {
    return { text: `${state.players[state.bid.by].name.toUpperCase()} BIDS`, color: PLAYER_COLORS[state.bid.by], amount: state.bid.amount, live: true };
  }
  return {
    text: waitingOn === null ? "" : `${state.players[waitingOn].name.toUpperCase()} TO OPEN`,
    color: waitingOn === null ? "#ffffff" : PLAYER_COLORS[waitingOn],
    amount: 0,
    live: false,
  };
}

function lotName(state: AuctionState, format: AuctionFormat): string {
  if (state.phase === "ready" || state.phase === "spinning") return "";
  return (currentItem(state, format)?.label ?? "").toUpperCase();
}

function nameStyle(text: string, base: number): CSSProperties {
  const size = text.length > 18 ? base * 0.76 : base;
  return { fontFamily: "var(--font-display)", fontSize: size, lineHeight: 1, color: "#ffffff", ...outlined(size) };
}

type LayoutProps = { state: AuctionState; format: AuctionFormat };


// ------------------------------------------------------------ the shape
//
// A factory rather than five copies. Five hand-written layouts that agree
// on nine tenths of their markup drift the moment one of them is edited,
// and the whole point of comparing them is that only the named difference
// differs.
type Split = {
  name: string;
  note: string;
  // The lot: logo over money, or logo beside it. Beside is shorter and
  // wider, stacked is taller and reads bigger.
  centre: "stacked" | "beside";
  logo: number;
  money: number;
  // The rails down each edge.
  railWidth: number;
  rowSize: number;
  // Where the rails sit against the centre column.
  railAlign: "center" | "flex-end" | "flex-start";
  // A hairline under each row, and the label in its own outer column.
  tabs?: boolean;
  // How far in from the edge of the 1080 stage the rails start.
  edge: number;
};

function makeSplit(opts: Split) {
  return function SplitLayout({ state, format }: LayoutProps) {
    const head = headline(state, format);
    const name = lotName(state, format);

    const rail = (who: number) => (
      <div
        style={{
          width: opts.railWidth,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: opts.tabs ? 0 : 6,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: who === 0 ? "row" : "row-reverse",
            alignItems: "baseline",
            gap: 10,
            marginBottom: opts.tabs ? 6 : 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: opts.rowSize * 1.4, color: PLAYER_COLORS[who], ...outlined(opts.rowSize * 1.4) }}>
            {state.players[who].name.toUpperCase()}
          </span>
          <Money amount={state.players[who].budget} size={opts.rowSize * 1.4} />
        </div>
        {format.slots.map((slot) => (
          <div
            key={slot.key}
            style={
              opts.tabs
                ? { paddingBottom: 4, marginBottom: 4, borderBottom: "2px solid rgba(255,255,255,0.14)" }
                : undefined
            }
          >
            <PosRow
              slot={slot}
              entry={state.players[who].roster[slot.key]}
              color={PLAYER_COLORS[who]}
              align={who === 0 ? "left" : "right"}
              size={opts.rowSize}
            />
          </div>
        ))}
      </div>
    );

    const lot = (
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {opts.centre === "stacked" ? (
          <>
            <Lot state={state} format={format} size={opts.logo} />
            {head.amount !== null && <Money amount={head.amount} size={opts.money} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Lot state={state} format={format} size={opts.logo} />
            {head.amount !== null && <Money amount={head.amount} size={opts.money} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
          </div>
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: opts.rowSize, letterSpacing: 3, color: head.color, ...outlined(opts.rowSize) }}>
          {head.text}
        </div>
        <div style={nameStyle(name, opts.rowSize * 1.2)}>{name}</div>
      </div>
    );

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: opts.railAlign,
          gap: 18,
          padding: `0 ${opts.edge}px`,
        }}
      >
        {rail(0)}
        {lot}
        {rail(1)}
      </div>
    );
  };
}


// ------------------------------------------------------------- the spine
//
// A different idea from the five above, and a better one: the POSITIONS
// run down the middle, big, and each pick sits to the left or the right
// of its own position depending on who won it. Above them, centred, the
// team on the block; above that, biggest thing on the graphic, the price
// as it climbs.
//
// What it buys is the comparison. Every other arrangement puts two
// rosters side by side and leaves the viewer to work out who has the
// better quarterback; here the two quarterbacks are on the same line with
// the word QB between them. Nobody has to be told what to compare.
// Big enough that the mark is legible across a room, and big enough to
// carry a number inside it without the two fighting.
const LOT_SIZE = 300;

function SpineLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  // Held back until the reel lands. A price over a spinning reel is two
  // things moving in the same square inch, and there is nothing to say
  // yet anyway - bidding has not opened.
  const showPrice = head.amount !== null && state.phase !== "ready" && state.phase !== "spinning";

  // The badge sits INSIDE, next to the label, on both sides - so the
  // badges form two columns flanking the spine and the eye runs
  // label, badge, name outwards instead of hunting for the start.
  // data-pick / data-filled are read by scripts/versus-hotseat.test.mjs.
  // The board used to print both rosters a second time underneath the
  // graphic and the test read those; now that the graphic is the only
  // copy, the test reads the graphic - which is the copy that has to be
  // right regardless.
  const pick = (who: number, slotKey: string) => {
    const entry = state.players[who].roster[slotKey];
    if (!entry) {
      return <span data-pick={who} data-filled="0" style={{ width: 46, height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 2 }} />;
    }
    const text = (entry.short ?? entry.label).toUpperCase();
    const size = fitSize(text, 30, 11);
    return (
      <div data-pick={who} data-filled="1" style={{ display: "flex", flexDirection: who === 0 ? "row-reverse" : "row", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Badge url={entry.badge} size={34} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: size,
            lineHeight: 1,
            color: PLAYER_COLORS[who],
            whiteSpace: "nowrap",
            ...outlined(size),
          }}
        >
          {text}
        </span>
      </div>
    );
  };

  // EQUAL WIDTH, both sides. With the two blocks sized to their own text
  // ("NOAH $9" against "$14 BEN") space-between put the logo wherever the
  // difference left it, which is to say never quite over the positions.
  // Equal flex basis and the logo is centred whatever the names are.
  //
  // Nothing is dimmed. Who holds what has to be readable at every moment,
  // not just on your turn - the rosters are the thing viewers are
  // comparing, and fading one of them hides the comparison.
  const budget = (who: number) => (
    <div
      data-budget={who}
      data-amount={state.players[who].budget}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "baseline",
        justifyContent: who === 0 ? "flex-start" : "flex-end",
        gap: 10,
        flexDirection: who === 0 ? "row" : "row-reverse",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: 34, color: PLAYER_COLORS[who], ...outlined(34) }}>
        {state.players[who].name.toUpperCase()}
      </span>
      {/* Green, while the price above is a player colour. Green is what
          you have; a colour is what is being bid right now. */}
      <Money amount={state.players[who].budget} size={34} />
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 24px" }}>
      {/* THE LOT, sitting directly on top of the first position.
      
          The budgets moved out to the edges of this same line rather than
          taking a row of their own between the logo and the spine, which
          is what was holding the logo away from it.

          There is no "NOAH BIDS" line any more either. The price is in
          the bidding player's colour, so the line was captioning
          something already on screen - and the colour says it in a glance
          rather than a read. Before anyone opens, the $0 carries the
          colour of whoever is on the clock. */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-end", gap: 12 }}>
        {budget(0)}
        <div
          style={{
            position: "relative",
            width: LOT_SIZE,
            height: LOT_SIZE,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lot state={state} format={format} size={LOT_SIZE} />
          {showPrice && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Money amount={head.amount ?? 0} size={104} color={head.color} />
            </div>
          )}
        </div>
        {budget(1)}
      </div>

      {/* The one thing the colour cannot say on its own. */}
      {state.phase === "done" && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40, letterSpacing: 4, color: "#ffffff", ...outlined(40) }}>
          DRAFT COMPLETE
        </div>
      )}

      {/* THE SPINE. One line per position, both picks on it. */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
        {format.slots.map((slot) => (
          <div key={slot.key} style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end" }}>{pick(0, slot.key)}</div>
            <div
              style={{
                width: 250,
                flexShrink: 0,
                textAlign: "center",
                fontFamily: "var(--font-display)",
                fontSize: slot.label.length > 6 ? 34 : 42,
                lineHeight: 1.25,
                color: "#ffffff",
                letterSpacing: 2,
                ...outlined(42),
              }}
            >
              {slot.label.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-start" }}>{pick(1, slot.key)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type LayoutKey = "s1" | "c1" | "c2" | "c3" | "c4" | "c5";

const SPLITS = {
  c1: {
    name: "Even",
    note: "The straight combination. Rails and centre share the height, everything lined up through the middle.",
    centre: "stacked", logo: 180, money: 118, railWidth: 320, rowSize: 26, railAlign: "center", edge: 24,
  },
  c2: {
    name: "Hung",
    note: "Rails hang from the top of the band and the centre drops below them, so the logo sits in clear space rather than between two columns of text.",
    centre: "stacked", logo: 190, money: 124, railWidth: 320, rowSize: 26, railAlign: "flex-start", edge: 24,
  },
  c3: {
    name: "Big centre",
    note: "Narrower rails, smaller rows, and everything that space buys goes into the logo and the number.",
    centre: "stacked", logo: 220, money: 148, railWidth: 268, rowSize: 22, railAlign: "center", edge: 20,
  },
  c4: {
    name: "Ruled",
    note: "Same as Even, with a hairline under every pick. Gives each roster the look of a printed sheet rather than a floating list.",
    centre: "stacked", logo: 180, money: 118, railWidth: 330, rowSize: 25, railAlign: "center", tabs: true, edge: 22,
  },
  c5: {
    name: "Short",
    note: "Logo and money side by side instead of stacked. Costs a little size, and is the shortest of the five by some way.",
    centre: "beside", logo: 148, money: 122, railWidth: 320, rowSize: 24, railAlign: "center", edge: 24,
  },
} satisfies Record<string, Split>;

type Entry = { name: string; note: string; Component: (p: LayoutProps) => React.ReactElement };

export const LAYOUTS: Record<LayoutKey, Entry> = {
  s1: {
    name: "Spine",
    note: "Positions down the middle, big. Each pick sits on the side of the player who won it, so the two quarterbacks are on the same line with the word QB between them. One big logo up top with the price sitting on it.",
    Component: SpineLayout,
  },
  ...(Object.fromEntries(
    (Object.keys(SPLITS) as (keyof typeof SPLITS)[]).map((key) => [
      key,
      { name: SPLITS[key].name, note: SPLITS[key].note, Component: makeSplit(SPLITS[key]) },
    ]),
  ) as Record<keyof typeof SPLITS, Entry>),
};

export function isLayoutKey(value: string | null): value is LayoutKey {
  return value !== null && value in LAYOUTS;
}
