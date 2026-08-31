"use client";

import type { AuctionFormat } from "@/lib/auction/format";
import { AuctionState, toAct, currentItem, fillLabel } from "@/lib/auction/engine";
import { PLAYER_COLORS, MONEY, outlined } from "./style";
import { LotCell, LotReel, LotWaiting } from "./LotReel";

export { PLAYER_COLORS };

// THE OBS LAYER. Not a web page that happens to be on a stream - a
// graphic, sitting on a transparent background, over two face cams.
//
// Which means it is built to different rules than the rest of the site.
// The site is quiet, dark panels and thin type on a dark ground. This is
// the opposite: heavy outlined lettering that survives being composited
// over a moving camera feed, money in a green you can read across a room,
// and one number bigger than everything else on screen. It should look
// like the caption layer on a TikTok gaming clip, because that is what it
// is competing with.
//
// A FIXED 1080 x 1920 STAGE. Point the OBS browser source at exactly that
// size and every position here is the position you get. Anything else
// letterboxes rather than reflowing, which is the right trade for a
// graphic: a layout that rearranges itself mid-stream is worse than one
// that is the wrong size once, at setup.

export const STAGE_W = 1080;
export const STAGE_H = 1920;

function Money({ amount, size, color = MONEY }: { amount: number; size: number; color?: string }) {
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

function Rail({
  state,
  format,
  who,
  align,
}: {
  state: AuctionState;
  format: AuctionFormat;
  who: number;
  align: "left" | "right";
}) {
  const player = state.players[who];
  const color = PLAYER_COLORS[who] ?? "#ffffff";
  const acting = toAct(state, format) === who;
  const winning = state.phase === "assigning" && state.won?.by === who;
  const lit = acting || winning;

  return (
    <div
      style={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "flex-end",
        textAlign: align,
        gap: 6,
        // The only thing that moves: whoever the game is waiting on gets
        // brighter. No animation, because a pulsing panel behind a face
        // cam is a distraction rather than information.
        opacity: lit ? 1 : 0.72,
        transition: "opacity 140ms linear",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 48,
          lineHeight: 1,
          color,
          maxWidth: 300,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...outlined(48),
        }}
      >
        {player.name.toUpperCase()}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#ffffff", letterSpacing: 2, ...outlined(22) }}>
          BUDGET
        </span>
        <Money amount={player.budget} size={66} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, width: "100%" }}>
        {format.slots.map((slot) => {
          const entry = player.roster[slot.key];
          return (
            // STACKED, not side by side. Beside the label there were about
            // 180px for the pick, and "De'Von Achane" and "DK Metcalf +
            // Roman Wilson" both truncated to nothing useful - a rail full
            // of "TRAVIS ETIE..." tells a viewer less than a blank one.
            // Stacked, the name gets the full width and two lines.
            <div key={slot.key} style={{ display: "flex", flexDirection: "column", width: "100%", gap: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 34,
                  lineHeight: 1,
                  color: entry ? "#ffffff" : "rgba(255,255,255,0.4)",
                  ...outlined(34),
                }}
              >
                {slot.label.toUpperCase()}
              </span>
              {entry && (
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 23,
                    lineHeight: 1.1,
                    color,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    ...outlined(23),
                  }}
                >
                  {entry.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverlayBoard({
  state,
  format,
  camTop,
  camBottom,
}: {
  state: AuctionState;
  format: AuctionFormat;
  camTop: number;
  camBottom: number;
}) {
  const item = currentItem(state, format);
  const acting = toAct(state, format);
  const bandHeight = STAGE_H - camTop - camBottom;
  // Nobody is "to act" while a lot is waiting or spinning - but the line
  // under the reel should already name whoever has to open, so it does
  // not blink into existence the moment the reel stops.
  const waitingOn = acting ?? (state.phase === "ready" || state.phase === "spinning" ? state.opener : null);

  return (
    <div style={{ width: STAGE_W, height: STAGE_H, position: "relative", overflow: "hidden" }}>
      {/* The band between the two cameras. Everything lives in here; the
          space above and below stays empty so the cams show through. */}
      <div
        style={{
          position: "absolute",
          top: camTop,
          left: 0,
          width: STAGE_W,
          height: bandHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 0 8px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 46,
            lineHeight: 1,
            color: "#ffffff",
            letterSpacing: 2,
            ...outlined(46),
          }}
        >
          {format.title.toUpperCase()}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, width: STAGE_W, padding: "0 26px" }}>
          <Rail state={state} format={format} who={0} align="left" />

          {/* The lot on the block - or the reel that is about to land on
              it. All three states are the same fixed-height cell, so
              nothing shifts as one becomes the next. */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {state.phase === "ready" ? (
              <LotWaiting />
            ) : state.phase === "spinning" && item ? (
              // Keyed on the lot, so every new lot mounts a fresh reel and
              // spins again rather than reusing one that has already
              // landed.
              <LotReel key={item.id} format={format} targetId={item.id} />
            ) : (
              <LotCell item={item} />
            )}
          </div>

          <Rail state={state} format={format} who={1} align="right" />
        </div>

        {/* THE ONE BIG NUMBER. Whatever is happening, the thing a viewer
            needs is the money, so it is the largest thing on screen and it
            is always in the same place. */}
        <div style={{ height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          {state.phase === "done" ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 58, color: "#ffffff", ...outlined(58) }}>
              DRAFT COMPLETE
            </div>
          ) : state.phase === "assigning" && state.won ? (
            <>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 30,
                  color: PLAYER_COLORS[state.won.by],
                  letterSpacing: 3,
                  ...outlined(30),
                }}
              >
                SOLD TO {state.players[state.won.by].name.toUpperCase()}
              </div>
              <Money amount={state.won.price} size={104} />
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  // Whoever the line is ABOUT, not whoever is to act. A
                  // standing bid names the bidder, so it takes the
                  // bidder's colour; only the "to open" prompt is about
                  // the player being waited on.
                  color: state.bid ? PLAYER_COLORS[state.bid.by] : waitingOn === null ? "#ffffff" : PLAYER_COLORS[waitingOn],
                  letterSpacing: 3,
                  ...outlined(28),
                }}
              >
                {state.bid
                  ? `${state.players[state.bid.by].name.toUpperCase()} BIDS`
                  : waitingOn === null
                    ? ""
                    : `${state.players[waitingOn].name.toUpperCase()} TO OPEN`}
              </div>
              <Money amount={state.bid?.amount ?? 0} size={104} color={state.bid ? MONEY : "rgba(255,255,255,0.55)"} />
            </>
          )}
        </div>
      </div>

      {/* What the winner actually took it for. Only while choosing, and
          only if there is something to say - "Bengals" on its own does not
          tell a viewer they just bought Joe Burrow. */}
      {state.phase === "assigning" && state.won && item && (
        <div
          style={{
            position: "absolute",
            top: camTop + bandHeight - 6,
            width: STAGE_W,
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontSize: 26,
            color: "#ffffff",
            ...outlined(26),
          }}
        >
          {format.slots
            .filter((s) => state.players[state.won!.by].roster[s.key] === null)
            .map((s) => fillLabel(item, s.key))
            .slice(0, 1)
            .join("")}
        </div>
      )}
    </div>
  );
}
