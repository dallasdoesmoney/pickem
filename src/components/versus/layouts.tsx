"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import type { AuctionFormat, SlotDef } from "@/lib/auction/format";
import { AuctionState, RosterEntry, toAct, currentItem } from "@/lib/auction/engine";
import { PLAYER_COLORS, MONEY, MONEY_ON_LIGHT, outlined } from "./style";
import { LogoReel, LotLogo, LotWaiting } from "./LotReel";
import { onTheClock, TurnNameMark } from "./turnIdeas";
import { AnimStyles, LandRing, SoldStamp, has, useDrain, type AnimKey } from "./anims";

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

// The receiver slot holds TWO surnames - "EVANS + SAMUEL SR." - where every other
// slot is one. Sized for the common case it overflowed; sized for the
// pair, every single-name pick was needlessly small. So it shrinks only
// as far as the long one needs, and only when it is long.
// `floor` is in PIXELS, not in fractions of the base, and the difference
// is not academic: it used to be base * 0.5, so raising the base raised
// the floor with it - and taking the pick name from 30 to 36 pushed the
// floor from 15px to 18px, at which "THOMAS JR. + WASHINGTON" stopped
// fitting its column and got quietly ellipsed. How small a name may get
// before a viewer cannot read it across a room is a fact about the
// stream, not about whatever the base happens to be this week.
function fitSize(text: string, base: number, comfortable: number, floor = base * 0.5): number {
  if (text.length <= comfortable) return base;
  return Math.max(Math.min(base, floor), (base * comfortable) / text.length);
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

type LayoutProps = { state: AuctionState; format: AuctionFormat; anims?: AnimKey[] };

// The budget, counting down rather than snapping. Its own component so
// the hook is never called conditionally - the animation is a prop, and
// a hook behind an if is how that becomes a crash on the render where
// somebody turns it off.
function DrainingMoney({ amount, size }: { amount: number; size: number }) {
  return <Money amount={useDrain(amount)} size={size} />;
}
// A pick is the most repeated object on the graphic - ten of them once
// both rosters fill - so a few pixels either way is worth more here than
// anywhere else, and so is anything it can be made to say for free.
//
// What every one of them has to hand: the surname, the team badge, the
// team COLOUR, and THE PRICE. The price is the one worth noticing - it is
// the most interesting number in the game and the current card throws it
// away the instant the lot is sold, so four of the five put it back.
//
// `side` is which player owns it: 0 reads outwards to the left, 1 to the
// right, and every card mirrors rather than being drawn twice.
const NAME_SIZE = 42;

// `comfortable` is how many characters fit before it starts shrinking,
// and it is per CARD rather than shared: a card that also carries a
// price and a pill's padding has less room for the name than one that is
// a logo and a word, and using one number for both ran "SUTTON + WADDLE"
// off the side of the screen.
function pickName(entry: RosterEntry, size = NAME_SIZE, comfortable = 12, floor?: number) {
  const text = (entry.short ?? entry.label).toUpperCase();
  return { text, size: fitSize(text, size, comfortable, floor) };
}

// THE CHIP.
//
// A pill in the team's own colour, holding the badge, the surname and
// what the pick cost. Chosen out of five fills - the alternatives were a
// tint of the colour, a dark body with a block of colour behind the
// badge, an outline, and a square slab. Full strength won: over a moving
// camera the team reads before the name does, which for a draft where
// the teams ARE the pieces is the point rather than the problem.
//
// THE PRICE IS THE PART THAT NEEDED SOLVING. Money on this board is
// green everywhere, and green on a full-strength team colour is not a
// colour pair - it is 32 different colour pairs, ten of which fail.
// Measured against every team in the league: Pittsburgh's yellow scores
// 1.02:1, which is not "low contrast", it is invisible; New Orleans'
// gold 1.07, Tennessee 1.89, Cincinnati and Denver 1.95. So the price
// gets its own capsule and stops depending on the fill at all - one
// pair, the same on all 32.
//
// The capsule is WHITE, and the digits are the dark reading of the
// board's green rather than the bright one: #00e35f is built to glow on
// a dark stage and scores 1.73 on white, which would have reintroduced
// the exact fault the capsule exists to remove. MONEY_ON_LIGHT is the
// same hue at 5.5:1.
//
// The name does not need the same treatment: it is white with a black
// stroke around it (see outlined), and a stroke is what makes white hold
// on a light fill where flat white would not.
function PickChip({ entry, who }: { entry: RosterEntry; who: number }) {
  const { text, size } = pickName(entry, 40, 9, 16);
  const accent = entry.accent ?? "#8899aa";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        // Mirrored, so the badge is always on the spine side and the
        // price always on the outer edge - the two columns read as each
        // other's reflection rather than as two different designs.
        flexDirection: who === 0 ? "row-reverse" : "row",
        alignItems: "center",
        gap: 9,
        // Mirrored too, and it has to be written out rather than left as
        // one shorthand: row-reverse flips the CHILDREN, not the box's
        // own padding, so a single "14px left" ends up on the badge side
        // in one column and the price side in the other. The badge is a
        // circle and wants the room; the price capsule has its own and
        // sits closer to the edge.
        padding: who === 0 ? "5px 14px 5px 10px" : "5px 10px 5px 14px",
        borderRadius: 999,
        background: accent,
        // Dark rather than a lighter tint of the fill: a light rim on a
        // light team turns the pill into a blob, and on a stream the
        // thing that has to survive is the SHAPE.
        border: "2px solid rgba(5,7,13,0.55)",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "relative", display: "flex" }}>
        <Badge url={entry.badge} size={32} />
      </span>
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: size,
          lineHeight: 1,
          color: "#ffffff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
          ...outlined(size),
        }}
      >
        {text}
      </span>
      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "2px 10px",
          borderRadius: 999,
          background: "#ffffff",
          // A thin dark rim, because white on a WHITE-ish team - the
          // Saints' gold, the Titans' light blue - needs an edge or the
          // capsule has no shape to be read as.
          boxShadow: "0 0 0 2px rgba(5,7,13,0.5)",
          fontFamily: "var(--font-display)",
          fontSize: 29,
          lineHeight: 1,
          color: MONEY_ON_LIGHT,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${entry.price}
      </span>
    </div>
  );
}



// THE WINNING BID, FLYING TO THE WINNER.
//
// It used to simply appear on their side, which is information without a
// moment. Now it starts where it was - on the logo's chin - and travels.
//
// Measured rather than hardcoded, because the whole stage is CSS-scaled
// and the two positions depend on the names either side of it. The catch
// is that getBoundingClientRect reports SCALED pixels while a transform
// applied inside the stage is scaled again, so the measured delta has to
// be divided by the scale first - which the logo box gives up by
// comparing its own rect against its offsetWidth.
function FlyingPrice({
  amount,
  color,
  from,
}: {
  amount: number;
  color: string;
  from: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const src = from.current;
    if (!el || !src) return;
    // CANCEL BEFORE MEASURING. Effects can run twice - React does exactly
    // that in development - and getBoundingClientRect includes the
    // transform, so a second run measuring an element already sitting at
    // the START of the flight computes a delta of zero and replaces the
    // real animation with one that goes nowhere. Cancelling first puts it
    // back at rest, so the measurement is the same both times.
    for (const running of el.getAnimations()) running.cancel();
    const a = el.getBoundingClientRect();
    const b = src.getBoundingClientRect();
    const scale = src.offsetWidth > 0 ? b.width / src.offsetWidth : 1;
    if (!scale) return;
    const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / scale;
    // The chin of the logo, which is where the number was sitting.
    const dy = (b.bottom - (a.top + a.height / 2)) / scale;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.4)`, opacity: 0.9 },
        { transform: "none", opacity: 1 },
      ],
      // Evenly paced rather than front-loaded: the first curve had it
      // most of the way across inside 120ms, which is a jump with a tail
      // rather than a move you can follow.
      { duration: 900, easing: "cubic-bezier(0.45, 0.02, 0.18, 1)" },
    );
  }, [from]);

  return (
    <div ref={ref} style={{ willChange: "transform" }}>
      <Money amount={amount} size={52} color={color} />
    </div>
  );
}




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
const LOT_SIZE = 180;
// TWO CENTRE COLUMNS, not one, and separating them is what actually
// closed the gap.
//
// SPINE_W is the LOGO's column on the names row. Its floor is the logo
// itself at LOT_SIZE, so it cannot go below 180 without the badge
// overhanging the budgets either side of it.
//
// LABEL_W is the POSITION's column on the rows below. It was sharing
// SPINE_W for no reason beyond both being "the middle", and a 250px
// column around a 71px word is ninety pixels of dead space on each side
// - which is exactly the gap between each roster and the spine. Sized to
// the widest label instead ("DEF", 99px of ink) plus room to breathe, it
// is about thirty-five.
//
// They do not need to match. Both rows centre their middle column on the
// stage's centre line, so the labels sit under the logo whatever the two
// widths are - and every pixel taken off LABEL_W goes to the picks.
const SPINE_W = 200;
const LABEL_W = 160;

function SpineLayout({ state, format, anims }: LayoutProps) {
  const head = headline(state, format);
  // Whose move it is, and only while it is still the opening one - see
  // turnIdeas.tsx. Null the rest of the time, which is most of the time.
  const clock = onTheClock(state, format);
  const item = currentItem(state, format);

  // WHILE WAITING, THE LAST TEAM STAYS UP. A lot ends, the pick lands on
  // a roster, and the logo used to blink back to a dashed question mark
  // immediately - throwing away the thing everyone is still looking at.
  // It holds until START spins the next one.
  const last = state.history[state.history.length - 1];
  const held = last ? (format.items.find((i) => i.id === last.itemId) ?? null) : null;

  // The price lives in one of two places and never both. While bidding it
  // sits ON the logo; the moment somebody wins it moves to their side and
  // waits above their name until the pick is placed, which is what makes
  // "who just got that, and for how much" a single glance.
  const wonBy = state.phase === "assigning" && state.won ? state.won.by : null;
  // Where the price flies from.
  const logoRef = useRef<HTMLDivElement>(null);

  // The badge sits INSIDE, next to the label, on both sides - so the
  // badges form two columns flanking the spine and the eye runs
  // label, badge, name outwards instead of hunting for the start.
  // data-pick / data-filled are read by scripts/versus-hotseat.test.mjs.
  // The board used to print both rosters a second time underneath the
  // graphic and the test read those; now that the graphic is the only
  // copy, the test reads the graphic - which is the copy that has to be
  // right regardless.
  const drawPick = (who: number, slotKey: string) => {
    const entry = state.players[who].roster[slotKey];
    if (!entry) {
      return <span data-pick={who} data-filled="0" style={{ width: 46, height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 2 }} />;
    }
    return (
      <div
        data-pick={who}
        data-filled="1"
        // Keyed on what is in the slot, so a pick that has just arrived
        // mounts fresh and plays the animation once. Re-renders for
        // anything else reuse it and it stays still.
        key={entry.itemId}
        className="versus-pick-in"
        style={{
          minWidth: 0,
          display: "flex",
          justifyContent: who === 0 ? "flex-end" : "flex-start",
        }}
      >
        <PickChip entry={entry} who={who} />
      </div>
    );
  };

  // BOTH SIDES THE SAME DISTANCE FROM THE SPINE, and that distance is
  // small. They used to be pushed out to the far edges of the stage while
  // every pick below them hugged the middle, so the two rows did not read
  // as belonging to the same player. Now the name sits over its own
  // column, mirrored, and the equal flex basis keeps the logo centred
  // whatever the names are.
  //
  // Nothing is dimmed. Who holds what has to be readable at every moment,
  // not just on your turn - the rosters are the thing viewers are
  // comparing, and fading one of them hides the comparison.
  const budget = (who: number) => (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: who === 0 ? "flex-end" : "flex-start",
      }}
    >
      <div
        data-budget={who}
        data-amount={state.players[who].budget}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexDirection: who === 0 ? "row" : "row-reverse",
        }}
      >
        {/* THE WINNING BID, parked over the winner's name until they say
            where it goes.
            
            ABSOLUTE, so it takes no layout space - reserving a band for
            it left 54 empty pixels between the logo and the names for the
            whole time nobody had won anything.
            
            Anchored to the NAME, not to the column, and to the name's
            OUTER end. Anchored to the column it sat against the spine,
            which was clear space until the logo moved down onto that
            line and started sharing it. */}
        {wonBy === who && (
          <div style={{ position: "absolute", bottom: "100%", marginBottom: 2, [who === 0 ? "left" : "right"]: 0 }}>
            <FlyingPrice amount={state.won?.price ?? 0} color={PLAYER_COLORS[who]} from={logoRef} />
          </div>
        )}
        {clock === who && <TurnNameMark who={who} />}
        <span style={{ fontFamily: "var(--font-display)", fontSize: 38, color: PLAYER_COLORS[who], ...outlined(38) }}>
          {state.players[who].name.toUpperCase()}
        </span>
        {/* Green, while the bid is a player colour. Green is what you
            have; a colour is what is being bid right now. */}
        {has(anims, "drain") ? (
          <DrainingMoney amount={state.players[who].budget} size={38} />
        ) : (
          <Money amount={state.players[who].budget} size={38} />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 24px" }}>
      <style>{`
        @keyframes versusPickIn {
          0%   { opacity: 0; transform: translateY(-26px) scale(0.9); }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: none; }
        }
        /* Slower, and it settles rather than snapping - the old 340ms
           with a hard curve read as a flicker at stream framerates. */
        .versus-pick-in { animation: versusPickIn 780ms cubic-bezier(0.34, 0.02, 0.18, 1) both; }
      `}</style>
      <AnimStyles />

      {/* THE LOGO SITS BETWEEN THE TWO NAMES, on their line.
      
          It used to have a row of its own, which cost its full height on
          a graphic whose whole problem is height. In the centre column -
          the same 250 the spine below it occupies - it costs nothing
          extra, and the names bottom-align to it so the three read as one
          band. Smaller than it was, because it no longer needs to carry
          the layout on its own. */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-end", marginBottom: 12 }}>
        {budget(0)}
        <div style={{ width: SPINE_W, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <div
            ref={logoRef}
            style={{
              position: "relative",
              width: LOT_SIZE,
              height: LOT_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {state.phase === "ready" ? (
              held ? <LotLogo item={held} size={LOT_SIZE} /> : <LotWaiting size={LOT_SIZE} />
            ) : state.phase === "spinning" && item ? (
              <LogoReel key={item.id} format={format} targetId={item.id} size={LOT_SIZE} />
            ) : (
              // Keyed on the lot, so it mounts fresh when the reel stops
              // on a new one and settles once. A re-render for anything
              // else reuses it and it stays still.
              <span
                key={has(anims, "land") ? `land:${item?.id ?? "none"}` : undefined}
                className={has(anims, "land") && state.phase === "bidding" ? "versus-land" : undefined}
                style={{ display: "inline-flex" }}
              >
                <LotLogo item={item} size={LOT_SIZE} />
              </span>
            )}
            {has(anims, "land") && state.phase === "bidding" && item && (
              <LandRing key={`ring:${item.id}`} size={LOT_SIZE} color={item.accent ?? "#ffffff"} />
            )}
            {has(anims, "sold") && wonBy !== null && state.won && (
              <SoldStamp key={`sold:${item?.id ?? state.index}`} who={wonBy} size={LOT_SIZE} />
            )}

            {/* INSIDE the logo now, not hanging off its chin - hanging
                below put it on the same line as the names the moment the
                two shared a row. */}
            {state.phase === "bidding" && head.amount !== null && (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 2, display: "flex", justifyContent: "center" }}>
                {/* KEYED ON THE VALUE, not fired by an event. The overlay
                    is handed whole states over a broadcast, so the only
                    way it knows a bid moved is that the number is
                    different - and a re-broadcast of the SAME state has
                    to be silent. Same key, same element, no replay. */}
                <span
                  key={has(anims, "bump") ? `${state.bid?.by ?? "x"}:${head.amount}` : undefined}
                  className={has(anims, "bump") ? "versus-bump" : undefined}
                  style={{ display: "inline-flex" }}
                >
                  <Money amount={head.amount} size={60} color={head.color} />
                </span>
              </div>
            )}
          </div>
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
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end" }}>{drawPick(0, slot.key)}</div>
            <div
              style={{
                width: LABEL_W,
                flexShrink: 0,
                textAlign: "center",
                fontFamily: "var(--font-display)",
                fontSize: slot.label.length > 6 ? 38 : 46,
                lineHeight: 1.25,
                color: "#ffffff",
                letterSpacing: 2,
                ...outlined(46),
              }}
            >
              {slot.label.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-start" }}>{drawPick(1, slot.key)}</div>
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
