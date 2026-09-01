"use client";

import { useState } from "react";
import type { AuctionFormat } from "@/lib/auction/format";
import { PLAYER_COLORS, MONEY, outlined, display } from "./style";
import { OverlayStage } from "./OverlayStage";
import {
  AuctionState,
  AuctionAction,
  toAct,
  bidRange,
  currentItem,
  openSlots,
  slotsItemCanFill,
  fillLabel,
} from "@/lib/auction/engine";

// THE CONTROL SCREEN, which is the overlay plus buttons.
//
// It used to be the overlay in a little box on a card, with both rosters
// printed again underneath in a different visual language: three
// backgrounds, two drawings of the same game, and a graphic the size of a
// postage stamp. Playing it looked nothing like watching it.
//
// So the graphic is now the page - full width, cropped to the band it
// actually occupies, on the site's own ground with nothing painted behind
// it - and everything below it is only the things you cannot do by
// looking: press start, name a price, pass, choose a slot. The rosters,
// the budgets, the lot and the price are all already on screen, because
// they are on screen for the viewers.
//
// Which also means this screen is worth sharing on its own. Screen-share
// it and you have the game without OBS at all.

// No cameras on a web page, so no bands: the graphic centres in the whole
// stage and OverlayStage crops to what it measures.
const SITE_CAM = 0;

const RULE = "rgba(255,255,255,0.10)";

function ActionButton({
  onClick,
  disabled,
  children,
  tone = "primary",
  grow = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
  grow?: boolean;
}) {
  const primary = tone === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-14 rounded-xl px-6 transition-transform active:scale-[0.98] disabled:opacity-40"
      style={{
        ...display(16, { letterSpacing: 2 }),
        flex: grow ? 1 : undefined,
        background: primary ? MONEY : "transparent",
        color: primary ? "#05070d" : "rgba(255,255,255,0.82)",
        border: primary ? "none" : `2px solid ${RULE}`,
      }}
    >
      {children}
    </button>
  );
}

export function AuctionBoard({
  format,
  state,
  onAction,
  onRestart,
}: {
  format: AuctionFormat;
  state: AuctionState;
  onAction: (action: AuctionAction) => void;
  onRestart: () => void;
}) {
  const act = onAction;
  const item = currentItem(state, format);
  const acting = toAct(state, format);
  const range = acting === null ? null : bidRange(state, format, acting);

  // Pre-filled to the smallest legal bid, and held per-turn so typing a
  // number does not survive into somebody else's turn.
  const [typed, setTyped] = useState<number | null>(null);
  const amount = typed ?? range?.min ?? 0;

  function bid(value: number) {
    if (acting === null || !range) return;
    act({ type: "bid", by: acting, amount: Math.max(range.min, Math.min(range.max, value)) });
    setTyped(null);
  }

  return (
    <div className="flex w-full flex-col">
      {/* ---- the graphic, exactly as the stream gets it ---- */}
      <div className="w-full">
        {/* Only the lot number - the graphic itself names the mode, in
            bigger type, two inches below this. */}
        <div className="mb-1 px-1">
          <span style={{ ...display(11, { letterSpacing: 3, color: "rgba(255,255,255,0.32)" }) }}>
            {state.phase === "done" ? `${state.history.length} LOTS SOLD` : `LOT ${state.history.length + 1}`}
          </span>
        </div>
        <OverlayStage state={state} format={format} mode="band" camTop={SITE_CAM} camBottom={SITE_CAM} />
      </div>

      {/* ---- and the only things you cannot do by looking ---- */}
      <div className="mt-2 border-t pt-5" style={{ borderColor: RULE }}>
        {state.phase === "done" && (
          <div className="flex flex-col items-center gap-3">
            <ActionButton onClick={onRestart}>NEW DRAFT</ActionButton>
          </div>
        )}

        {(state.phase === "ready" || state.phase === "spinning") && (
          <div className="flex flex-col gap-2">
            <ActionButton onClick={() => act({ type: "spin" })} disabled={state.phase === "spinning"} grow>
              {state.phase === "spinning" ? "SPINNING…" : "START"}
            </ActionButton>
            <p className="text-center text-[12px] text-white/35">
              {state.phase === "spinning" ? (
                "Bidding opens when it lands."
              ) : (
                <>
                  <span style={{ color: PLAYER_COLORS[state.opener] }}>{state.players[state.opener].name}</span> opens this one.
                </>
              )}
            </p>
          </div>
        )}

        {state.phase === "bidding" && acting !== null && range && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[acting], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {state.players[acting].name.toUpperCase()} TO {state.bid ? "ANSWER" : "OPEN"}
              </span>
              <span className="text-[12px] text-white/40">
                {state.bid ? `beat $${state.bid.amount}` : "an opening bid can be $0"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTyped(Math.max(range.min, amount - 1))}
                disabled={amount <= range.min}
                className="h-14 w-14 rounded-xl text-xl text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
                style={{ border: `2px solid ${RULE}` }}
              >
                &minus;
              </button>
              <div
                className="flex h-14 min-w-[6rem] items-center justify-center rounded-xl px-3"
                style={{ ...display(26, { color: MONEY, fontVariantNumeric: "tabular-nums" }), border: `2px solid ${RULE}` }}
              >
                ${amount}
              </div>
              <button
                onClick={() => setTyped(Math.min(range.max, amount + 1))}
                disabled={amount >= range.max}
                className="h-14 w-14 rounded-xl text-xl text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
                style={{ border: `2px solid ${RULE}` }}
              >
                +
              </button>

              <ActionButton onClick={() => bid(amount)} grow>
                BID ${amount}
              </ActionButton>

              {/* Only once somebody has opened - the opener has to bid,
                  even if it is nothing. Rule 2. */}
              {state.bid && (
                <ActionButton onClick={() => act({ type: "pass", by: acting })} tone="ghost">
                  PASS
                </ActionButton>
              )}
            </div>

            <p className="text-[11.5px] text-white/30">
              {range.max === 0
                ? "Out of money — can still open at $0 and win anything nobody wants."
                : `Anything from $${range.min} to $${range.max}.`}
            </p>
          </div>
        )}

        {state.phase === "assigning" && state.won && item && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[state.won.by], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {state.players[state.won.by].name.toUpperCase()} WINS AT ${state.won.price}
              </span>
              <span className="text-[12px] text-white/40">where does it go?</span>
            </div>

            <div className="flex flex-col gap-2">
              {slotsItemCanFill(item, openSlots(state.players[state.won.by])).map((slotKey) => {
                const slot = format.slots.find((s) => s.key === slotKey);
                return (
                  <button
                    key={slotKey}
                    onClick={() => act({ type: "assign", slotKey })}
                    className="flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-colors hover:bg-white/[0.06]"
                    style={{ border: `2px solid ${RULE}` }}
                  >
                    <span style={{ ...display(13, { letterSpacing: 2, color: "rgba(255,255,255,0.45)" }), width: 96, flexShrink: 0 }}>
                      {(slot?.label ?? slotKey).toUpperCase()}
                    </span>
                    {/* What you actually GET there - the whole point of
                        auctioning a team rather than a player. */}
                    <span className="min-w-0 flex-1 truncate" style={{ ...display(17, { color: PLAYER_COLORS[state.won!.by] }) }}>
                      {fillLabel(item, slotKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {state.history.length > 0 && state.phase !== "done" && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: RULE }}>
          <div style={{ ...display(10, { letterSpacing: 3, color: "rgba(255,255,255,0.3)" }) }}>SOLD</div>
          <div className="mt-2 flex flex-col gap-1">
            {state.history
              .slice()
              .reverse()
              .slice(0, 5)
              .map((h, i) => (
                <div key={`${h.itemId}-${i}`} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-white/55">{h.label}</span>
                  <span className="shrink-0" style={{ color: PLAYER_COLORS[h.by] }}>
                    {state.players[h.by].name}
                  </span>
                  <span className="w-10 shrink-0 text-right text-white/40" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${h.price}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
