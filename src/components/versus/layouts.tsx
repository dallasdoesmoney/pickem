"use client";

import type { CSSProperties } from "react";
import type { AuctionFormat, SlotDef } from "@/lib/auction/format";
import { AuctionState, RosterEntry, toAct, currentItem } from "@/lib/auction/engine";
import { PLAYER_COLORS, MONEY, outlined } from "./style";
import { LogoReel, LotLogo, LotWaiting } from "./LotReel";

// FIVE LAYOUTS, one graphic.
//
// The band between two cameras is the whole canvas, and the scarce
// dimension is height - every pixel this takes is a pixel of somebody's
// face. So these are five answers to one question: how little vertical
// space can the draft be legible in?
//
// What they share, because it is settled: a surname rather than a full
// name, the team badge beside it doing the work of the rest of the name,
// the position label on the SAME LINE as the pick, and the money
// immediately under the logo rather than at the bottom of the screen.
//
// What differs is arrangement, which is the part worth looking at rather
// than arguing about.

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
  return Math.max(base * 0.6, (base * comfortable) / text.length);
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
          minWidth: size * 3.1,
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
          const fitted = fitSize(text, size, 14);
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

// ------------------------------------------------------------- layout A
// RAILS. The shape that already exists, compacted: a column per player
// down the sides, the lot in the middle. Most familiar, widest.
function RailsLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  const name = lotName(state, format);
  const rail = (who: number) => (
    <div style={{ width: 330, display: "flex", flexDirection: "column", gap: 7, opacity: toAct(state, format) === who ? 1 : 0.78 }}>
      <div style={{ display: "flex", flexDirection: who === 0 ? "row" : "row-reverse", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 38, color: PLAYER_COLORS[who], ...outlined(38) }}>
          {state.players[who].name.toUpperCase()}
        </span>
        <Money amount={state.players[who].budget} size={38} />
      </div>
      {format.slots.map((slot) => (
        <PosRow
          key={slot.key}
          slot={slot}
          entry={state.players[who].roster[slot.key]}
          color={PLAYER_COLORS[who]}
          align={who === 0 ? "left" : "right"}
          size={26}
        />
      ))}
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 20, padding: "0 30px" }}>
      {rail(0)}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Lot state={state} format={format} size={190} />
        {head.amount !== null && <Money amount={head.amount} size={92} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: 2, color: head.color, ...outlined(24) }}>{head.text}</div>
        <div style={nameStyle(name, 30)}>{name}</div>
      </div>
      {rail(1)}
    </div>
  );
}

// ------------------------------------------------------------- layout B
// STACKED BANDS. Full width, three short rows: the lot across the top,
// then one row per player. The shortest of the five.
function BandsLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  const name = lotName(state, format);
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "0 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Lot state={state} format={format} size={150} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 3, color: head.color, ...outlined(22) }}>{head.text}</div>
          {head.amount !== null && <Money amount={head.amount} size={104} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
          <div style={nameStyle(name, 28)}>{name}</div>
        </div>
      </div>

      {[0, 1].map((who) => (
        <div key={who} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, opacity: toAct(state, format) === who ? 1 : 0.8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 30, color: PLAYER_COLORS[who], width: 168, ...outlined(30) }}>
            {state.players[who].name.toUpperCase()}
          </span>
          <Money amount={state.players[who].budget} size={30} />
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            {format.slots.map((slot) => {
              const entry = state.players[who].roster[slot.key];
              return (
                <div key={slot.key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "rgba(255,255,255,0.45)", ...outlined(16) }}>
                    {slot.label.toUpperCase()}
                  </span>
                  {entry ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                      <Badge url={entry.badge} size={26} />
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: fitSize((entry.short ?? entry.label), 21, 9),
                          color: PLAYER_COLORS[who],
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          ...outlined(fitSize((entry.short ?? entry.label), 21, 9)),
                        }}
                      >
                        {(entry.short ?? entry.label).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <span style={{ width: 40, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- layout C
// CENTRE STACK. Lot and money dead centre and large, rosters as two
// columns underneath. Puts the most weight on the auction itself.
function CentreLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  const name = lotName(state, format);
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 34px" }}>
      <Lot state={state} format={format} size={168} />
      {head.amount !== null && <Money amount={head.amount} size={116} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 3, color: head.color, ...outlined(26) }}>{head.text}</div>
      <div style={nameStyle(name, 34)}>{name}</div>

      <div style={{ width: "100%", display: "flex", gap: 34, marginTop: 6 }}>
        {[0, 1].map((who) => (
          <div key={who} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5, opacity: toAct(state, format) === who ? 1 : 0.78 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 32, color: PLAYER_COLORS[who], ...outlined(32) }}>
                {state.players[who].name.toUpperCase()}
              </span>
              <Money amount={state.players[who].budget} size={32} />
            </div>
            {format.slots.map((slot) => (
              <PosRow key={slot.key} slot={slot} entry={state.players[who].roster[slot.key]} color={PLAYER_COLORS[who]} align="left" size={24} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- layout D
// SCOREBOARD. One horizontal bar, read left to right like a scorebug:
// player, lot and money, player. Nothing stacked at all.
function ScoreboardLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  const name = lotName(state, format);
  const side = (who: number) => (
    <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 4, opacity: toAct(state, format) === who ? 1 : 0.78 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexDirection: who === 0 ? "row" : "row-reverse" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 34, color: PLAYER_COLORS[who], ...outlined(34) }}>
          {state.players[who].name.toUpperCase()}
        </span>
        <Money amount={state.players[who].budget} size={34} />
      </div>
      {/* Wrapped: five slots land in two or three lines rather than five. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", justifyContent: who === 0 ? "flex-start" : "flex-end" }}>
        {format.slots.map((slot) => {
          const entry = state.players[who].roster[slot.key];
          return (
            <div key={slot.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "rgba(255,255,255,0.42)", ...outlined(15) }}>
                {slot.label.toUpperCase()}
              </span>
              {entry ? (
                <>
                  <Badge url={entry.badge} size={22} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 19, color: PLAYER_COLORS[who], ...outlined(19) }}>
                    {(entry.short ?? entry.label).toUpperCase()}
                  </span>
                </>
              ) : (
                <span style={{ width: 26, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 26px" }}>
      {side(0)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <Lot state={state} format={format} size={132} />
        {head.amount !== null && <Money amount={head.amount} size={86} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 2, color: head.color, ...outlined(20) }}>{head.text}</div>
        <div style={nameStyle(name, 24)}>{name}</div>
      </div>
      {side(1)}
    </div>
  );
}

// ------------------------------------------------------------- layout E
// MINIMAL. The auction only, big. Rosters shrink to one line each, under
// the fold of the action. Gives the cameras the most room of the five.
function MinimalLayout({ state, format }: LayoutProps) {
  const head = headline(state, format);
  const name = lotName(state, format);
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <Lot state={state} format={format} size={158} />
        {head.amount !== null && <Money amount={head.amount} size={132} color={head.live ? MONEY : "rgba(255,255,255,0.5)"} />}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 3, color: head.color, ...outlined(26) }}>{head.text}</div>
      <div style={nameStyle(name, 30)}>{name}</div>

      {[0, 1].map((who) => (
        <div key={who} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, opacity: toAct(state, format) === who ? 1 : 0.75 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: PLAYER_COLORS[who], width: 120, ...outlined(24) }}>
            {state.players[who].name.toUpperCase()}
          </span>
          <Money amount={state.players[who].budget} size={24} />
          <div style={{ flex: 1, display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            {format.slots.map((slot) => {
              const entry = state.players[who].roster[slot.key];
              if (!entry) return <span key={slot.key} style={{ width: 22, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />;
              // Badge alone at this size - the position is implied by the
              // order, which never changes, and a surname beside five
              // other surnames stops being readable anyway.
              return <Badge key={slot.key} url={entry.badge} size={34} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export type LayoutKey = "a" | "b" | "c" | "d" | "e";

export const LAYOUTS: Record<LayoutKey, { name: string; note: string; Component: (p: LayoutProps) => React.ReactElement }> = {
  a: { name: "Rails", note: "A column per player down the sides, lot in the middle. Closest to what is there now, but one line per pick.", Component: RailsLayout },
  b: { name: "Bands", note: "Full width. Lot across the top, then one row per player with the five picks spread across it.", Component: BandsLayout },
  c: { name: "Centre stack", note: "Lot and money big and dead centre, both rosters in two columns underneath.", Component: CentreLayout },
  d: { name: "Scorebug", note: "One horizontal bar read left to right, like a broadcast scorebug. Picks wrap two or three to a line.", Component: ScoreboardLayout },
  e: { name: "Minimal", note: "The auction only, as large as it goes. Rosters collapse to a row of badges. Most camera room.", Component: MinimalLayout },
};

export function isLayoutKey(value: string | null): value is LayoutKey {
  return value === "a" || value === "b" || value === "c" || value === "d" || value === "e";
}
