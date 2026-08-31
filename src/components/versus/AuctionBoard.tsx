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

// Same vocabulary as the overlay - see style.ts. The panels stay, because
// this is a page somebody sits and reads rather than a graphic over a
// face cam, but the lettering, the colours and the money match what a
// viewer is looking at on the stream.
const CARD = "#101d38";
const RULE = "rgba(255,255,255,0.12)";

function Money({ amount, size = 34, color = MONEY }: { amount: number; size?: number; color?: string }) {
  return (
    <span style={{ ...display(size, { color, fontVariantNumeric: "tabular-nums" }), ...outlined(size, "soft") }}>
      ${amount}
    </span>
  );
}

// One player's column: what they have left, and what they have filled.
function PlayerPanel({
  state,
  format,
  who,
  active,
}: {
  state: AuctionState;
  format: AuctionFormat;
  who: number;
  active: boolean;
}) {
  const player = state.players[who];
  const color = PLAYER_COLORS[who] ?? "#ffffff";
  return (
    <div
      // Marked so a test can read the rosters specifically. It used to
      // scan the whole page for an em dash to find an unfilled slot,
      // which quietly became wrong the moment any other copy on the page
      // contained one.
      data-roster={who}
      className="flex flex-col rounded-2xl border p-4 transition-colors"
      style={{ background: CARD, borderColor: active ? `${color}99` : RULE }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate" style={{ ...display(26, { color }), ...outlined(26, "soft") }}>
          {player.name.toUpperCase()}
        </span>
        <Money amount={player.budget} size={32} />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {format.slots.map((slot) => {
          const entry = player.roster[slot.key];
          return (
            <div key={slot.key} className="flex items-center gap-2 text-[12.5px]">
              <span className="w-20 shrink-0 text-[10px] tracking-[0.14em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
                {slot.label.toUpperCase()}
              </span>
              {entry ? (
                <>
                  <span className="min-w-0 flex-1 truncate" style={{ color }}>
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-white/45" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${entry.price}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-white/20">&mdash;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CONTROLLED. The game used to live in here, which was fine while this
// was the only screen it appeared on. Now the page also broadcasts it to
// an OBS overlay, and a game the page cannot see is a game it cannot
// send - so the state moved up and this draws what it is given.
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

  if (state.phase === "done") {
    const totals = state.players.map((p) => format.slots.length - openSlots(p).length);
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border p-5 text-center" style={{ background: CARD, borderColor: RULE }}>
          <div className="text-[11px] tracking-[0.22em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
            DRAFT COMPLETE
          </div>
          <p className="mt-2 text-sm text-white/55">
            {state.history.length} lots sold. {totals.join(" and ")} slots filled.
          </p>
          <button
            onClick={onRestart}
            className="mt-4 rounded-full border border-white/20 px-5 py-2 text-xs tracking-[0.18em] text-white/80 transition-colors hover:bg-white/10"
            style={{ fontFamily: "var(--font-display)" }}
          >
            NEW DRAFT
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {state.players.map((_, i) => (
            <PlayerPanel key={i} state={state} format={format} who={i} active={false} />
          ))}
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- what the stream is looking at, right now ----

           This used to be a lot card of its own: the same team, drawn a
           second way, from the same state. Two versions of one thing is
           how the board and the overlay drifted apart in the first place,
           so the card is gone and this is the actual overlay, scaled. */}
      <div className="rounded-2xl border p-3" style={{ background: CARD, borderColor: RULE }}>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <span className="text-[10px] tracking-[0.22em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
            LOT {state.history.length + 1}
          </span>
          <span className="text-[10px] tracking-[0.18em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
            {format.title.toUpperCase()}
          </span>
        </div>
        <div className="mx-auto w-full max-w-[380px]">
          <OverlayStage state={state} format={format} />
        </div>
      </div>

      {/* ---- start the lot ---- */}
      {(state.phase === "ready" || state.phase === "spinning") && (
        <div className="rounded-2xl border p-5 text-center" style={{ background: CARD, borderColor: RULE }}>
          <button
            onClick={() => act({ type: "spin" })}
            disabled={state.phase === "spinning"}
            className="w-full rounded-xl px-5 py-4 text-[15px] tracking-[0.18em] text-[#05070d] transition-transform active:scale-[0.99] disabled:opacity-45"
            style={{ fontFamily: "var(--font-display)", background: MONEY }}
          >
            {state.phase === "spinning" ? "SPINNING…" : "START"}
          </button>
          <p className="mt-2.5 text-[11px] text-white/35">
            {state.phase === "spinning"
              ? "Bidding opens when it lands."
              : `${state.players[state.opener].name} opens this one.`}
          </p>
        </div>
      )}

      {/* ---- bidding, or choosing a slot ---- */}
      {state.phase === "bidding" && acting !== null && range && (
        <div className="rounded-2xl border p-5" style={{ background: CARD, borderColor: RULE }}>
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ ...display(15, { color: PLAYER_COLORS[acting], letterSpacing: 1 }), ...outlined(15, "soft") }}>
              {state.players[acting].name.toUpperCase()} TO {state.bid ? "ANSWER" : "OPEN"}
            </span>
            {state.bid ? (
              <span className="text-[12px] text-white/50">
                standing bid <Money amount={state.bid.amount} size={18} /> from {state.players[state.bid.by].name}
              </span>
            ) : (
              <span className="text-[12px] text-white/40">opening bid can be $0</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTyped(Math.max(range.min, amount - 1))}
              disabled={amount <= range.min}
              className="h-11 w-11 rounded-xl border border-white/15 text-lg text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              &minus;
            </button>
            <div
              className="flex h-11 min-w-[5rem] items-center justify-center rounded-xl border border-white/15 px-3"
              style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
            >
              ${amount}
            </div>
            <button
              onClick={() => setTyped(Math.min(range.max, amount + 1))}
              disabled={amount >= range.max}
              className="h-11 w-11 rounded-xl border border-white/15 text-lg text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              +
            </button>

            <button
              onClick={() => bid(amount)}
              className="h-11 flex-1 rounded-xl px-5 text-[13px] tracking-[0.14em] text-[#05070d] transition-transform active:scale-[0.98]"
              style={{ fontFamily: "var(--font-display)", background: MONEY }}
            >
              BID ${amount}
            </button>

            {/* Only once somebody has opened - the opener has to bid, even
                if it is nothing. Rule 2. */}
            {state.bid && (
              <button
                onClick={() => act({ type: "pass", by: acting })}
                className="h-11 rounded-xl border border-white/20 px-5 text-[13px] tracking-[0.14em] text-white/70 transition-colors hover:bg-white/10"
                style={{ fontFamily: "var(--font-display)" }}
              >
                PASS
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] text-white/35">
            {range.max === 0
              ? "Out of money - can still open at $0 and win anything nobody wants."
              : `Anything from $${range.min} to $${range.max}.`}
          </p>
        </div>
      )}

      {state.phase === "assigning" && state.won && (
        <div className="rounded-2xl border p-5" style={{ background: CARD, borderColor: "rgba(62,203,120,0.5)" }}>
          <div className="text-[12px] tracking-[0.16em] text-white/70" style={{ fontFamily: "var(--font-display)" }}>
            {state.players[state.won.by].name.toUpperCase()} WINS AT ${state.won.price}
          </div>
          <p className="mt-1 text-[12px] text-white/45">Where does it go?</p>

          <div className="mt-3 flex flex-col gap-2">
            {slotsItemCanFill(item, openSlots(state.players[state.won.by])).map((slotKey) => {
              const slot = format.slots.find((s) => s.key === slotKey);
              return (
                <button
                  key={slotKey}
                  onClick={() => act({ type: "assign", slotKey })}
                  className="flex items-center gap-3 rounded-xl border border-white/15 px-4 py-3 text-left transition-colors hover:border-white/40 hover:bg-white/[0.06]"
                >
                  <span
                    className="w-24 shrink-0 text-[10px] tracking-[0.14em] text-white/45"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {(slot?.label ?? slotKey).toUpperCase()}
                  </span>
                  {/* What you actually GET there - the whole point of
                      auctioning a team rather than a player. */}
                  <span className="min-w-0 flex-1 truncate text-[14px] text-white/85">{fillLabel(item, slotKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {state.players.map((_, i) => (
          <PlayerPanel key={i} state={state} format={format} who={i} active={acting === i || state.won?.by === i} />
        ))}
      </div>

      {state.history.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ background: CARD, borderColor: RULE }}>
          <div className="text-[10px] tracking-[0.2em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
            SOLD
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {state.history
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={`${h.itemId}-${i}`} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-white/70">{h.label}</span>
                  <span className="shrink-0" style={{ color: PLAYER_COLORS[h.by] }}>
                    {state.players[h.by].name}
                  </span>
                  <span className="w-10 shrink-0 text-right text-white/55" style={{ fontVariantNumeric: "tabular-nums" }}>
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
