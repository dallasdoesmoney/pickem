"use client";

import { useEffect, useRef } from "react";
import type { WavelengthState, WavelengthAction } from "@/lib/wavelength/engine";
import { other, potMax } from "@/lib/wavelength/engine";
import { PLAYER_COLORS, MONEY, outlined, display } from "@/components/versus/style";
import { WaveStage } from "./WaveStage";
import { COVER_MS } from "./Dial";

// THE CONTROL SCREEN, which is the overlay plus buttons - the same
// arrangement the draft settled on. The graphic is the page, full width,
// and underneath it are only the things you cannot do by looking.
//
// THE DIAL IS NOT UNDER HERE. It is the graphic itself: the guess is made
// by dragging the needle on the same face the stream is watching, and the
// target is uncovered by lifting the lid on that same face. A slider under
// the picture and a second little dial off to one side were two people
// describing a game nobody could actually see happening.
//
// AND THE MIRROR IS EXACTLY THE OVERLAY AGAIN. It briefly was not: the
// lid was a flag this screen kept to itself, so it had to redact its own
// copy of the state to hide the wedge from itself. The lid is part of the
// game now - everybody sees it open - so there is nothing left to hide
// differently and this page draws the state as it is.

const RULE = "rgba(255,255,255,0.10)";

function ActionButton({
  onClick,
  disabled,
  children,
  tone = "primary",
  grow = false,
  color,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
  grow?: boolean;
  color?: string;
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
        background: primary ? (color ?? MONEY) : "transparent",
        color: primary ? "#05070d" : "rgba(255,255,255,0.82)",
        border: primary ? "none" : `2px solid ${RULE}`,
      }}
    >
      {children}
    </button>
  );
}

export function WavelengthBoard({
  state,
  deckTitle,
  onAction,
  onUndo,
  canUndo,
  onRestart,
}: {
  state: WavelengthState;
  deckTitle: string;
  // `record` is what separates a move somebody MADE from a knob being
  // turned. Every keystroke of a clue and every degree of the dial is an
  // action, and recording them would make UNDO mean "delete one letter".
  onAction: (action: WavelengthAction, record?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRestart: () => void;
}) {
  const psychic = state.teams[state.psychic];
  const guessing = state.teams[other(state.psychic)];
  const coop = state.mode === "coop";
  // LIVE FROM THE START OF THE ROUND. It used to wait for a clue to be
  // typed, which is a toll gate on a game whose clue is SAID out loud -
  // everybody in the room and on the stream already heard it. Typing it in
  // is for putting it on the graphic, not for unlocking the dial.
  const dialLive = state.phase === "clue" || state.phase === "guess";
  const placed = state.guess !== null;

  // THE PEEK, which is now a move like any other.
  //
  // It used to be a flag this screen kept to itself, because the target
  // was nobody else's business. It is everybody's business now - the
  // stream and the join link both show the dial open - so it goes through
  // the reducer and rides the wire with the rest of the game. Not recorded
  // on the undo stack: looking at something is not a move.
  //
  // Still a HOLD rather than a toggle. A toggle gets left on, and this one
  // now leaves the answer on three screens when it is.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracked outside React as well: a pointer-up and a blur both fire on
  // the same release, and the second must not start a second timer.
  const held = useRef(false);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function hold() {
    if (held.current) return;
    held.current = true;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    onAction({ type: "peek", at: "open" }, false);
  }

  function release() {
    if (!held.current) return;
    held.current = false;
    // "closing" keeps the target in the message while the shutter travels;
    // without it the wedge blinks out from under a lid still moving.
    onAction({ type: "peek", at: "closing" }, false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => onAction({ type: "peek", at: "shut" }, false), COVER_MS + 80);
  }

  const peek = state.peek === "open";

  return (
    <div className="flex w-full flex-col">
      {/* ---- the graphic, exactly as the stream gets it ---- */}
      <div className="w-full">
        {/* The DECK, and only the deck. The round, the score, the target
            and the clue are all on the graphic below this, and printing
            any of them again here is one more thing that can end up
            disagreeing with the copy the viewers are watching. */}
        <div className="mb-0.5 px-1">
          <span style={{ ...display(11, { letterSpacing: 3, color: "rgba(255,255,255,0.32)" }) }}>
            {deckTitle.toUpperCase()}
          </span>
        </div>
        {/* THE SAME STATE EVERYBODY ELSE GETS. It used to be redacted
            here too, separately, so this screen could hide the wedge from
            itself; with the lid in the game there is nothing left to hide
            differently and the mirror is exactly the overlay again. */}
        <WaveStage
          state={state}
          onScrub={dialLive ? (value) => onAction({ type: "guess", value }, false) : undefined}
        />
      </div>

      {/* ---- and the only things you cannot do by looking ---- */}
      <div className="mt-1 flex flex-col gap-3 border-t pt-4" style={{ borderColor: RULE }}>
        {state.phase === "clue" && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {psychic.name.toUpperCase()} IS THE PSYCHIC
              </span>
              <span className="text-[12px] text-white/40">nobody else looks</span>
            </div>

            <button
              type="button"
              onPointerDown={hold}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              onBlur={release}
              onContextMenu={(e) => e.preventDefault()}
              className="w-full rounded-xl py-4"
              style={{
                ...display(14, { letterSpacing: 2, color: peek ? "#05070d" : PLAYER_COLORS[state.psychic] }),
                background: peek ? PLAYER_COLORS[state.psychic] : "transparent",
                border: `2px dashed ${peek ? PLAYER_COLORS[state.psychic] : RULE}`,
                // A long press on a touch screen otherwise selects text or
                // pops the browser's own menu over the answer.
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              {peek ? "LET GO TO CLOSE IT" : "HOLD TO OPEN THE DIAL"}
            </button>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.16em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
                THE CLUE
              </span>
              <input
                type="text"
                value={state.clue}
                onChange={(e) => onAction({ type: "clue", text: e.target.value }, false)}
                placeholder="One word, ideally"
                maxLength={60}
                className="rounded-xl border-2 bg-white/[0.04] px-3 py-3 text-[15px] outline-none transition-colors focus:border-white/45"
                style={{ borderColor: RULE }}
              />
            </label>

            <p className="text-[11.5px] leading-relaxed text-white/35">
              Optional &mdash; say it out loud and skip the box if you like; this is only
              for getting it onto the overlay. Either way,{" "}
              <span className="text-white/60">{coop ? guessing.name : `${psychic.name}'s team`}</span> drags the
              needle on the dial above.
            </p>
          </>
        )}

        {dialLive && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(16, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }) }}>
                DRAG THE NEEDLE
              </span>
              <span style={{ ...display(22, { color: "rgba(255,255,255,0.75)", fontVariantNumeric: "tabular-nums" }) }}>
                {state.guess === null ? "—" : state.guess.toFixed(1)}
              </span>
            </div>

            {!placed ? (
              <p className="text-[11.5px] text-white/35">
                Anywhere on the dial. {state.card.left} is hard left, {state.card.right} is hard right.
              </p>
            ) : coop ? (
              // No other side of the table to call it, so a co-op round is
              // two presses: put the needle somewhere, open the dial.
              <ActionButton onClick={() => onAction({ type: "reveal" })} grow>
                OPEN THE DIAL
              </ActionButton>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <span style={{ ...display(16, { color: PLAYER_COLORS[other(state.psychic)], letterSpacing: 1 }) }}>
                    {guessing.name.toUpperCase()} CALLS THE SIDE
                  </span>
                  <span className="text-[12px] text-white/40">+1 if they are right</span>
                </div>
                <div className="flex gap-2">
                  <ActionButton onClick={() => onAction({ type: "steal", side: "left" })} color={PLAYER_COLORS[other(state.psychic)]} grow>
                    &larr; LEFT
                  </ActionButton>
                  <ActionButton onClick={() => onAction({ type: "steal", side: "right" })} color={PLAYER_COLORS[other(state.psychic)]} grow>
                    RIGHT &rarr;
                  </ActionButton>
                </div>
                {/* SKIPPABLE. The call is a real part of the game, but so
                    is not bothering with it - and being made to press one
                    of two buttons you did not want turns a two-press round
                    into a four-press one. */}
                <button
                  onClick={() => onAction({ type: "reveal" })}
                  className="self-center rounded-lg px-4 py-2 transition-colors"
                  style={{ ...display(11, { letterSpacing: 2, color: "rgba(255,255,255,0.5)" }), border: `2px solid ${RULE}` }}
                >
                  SKIP THE CALL &mdash; OPEN THE DIAL
                </button>
              </>
            )}
          </div>
        )}

        {state.phase === "steal" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[other(state.psychic)], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {guessing.name.toUpperCase()} SAYS {state.steal === "left" ? "LEFT" : "RIGHT"}
              </span>
              <span className="text-[12px] text-white/40">everyone in?</span>
            </div>
            <ActionButton onClick={() => onAction({ type: "reveal" })} grow>
              OPEN THE DIAL
            </ActionButton>
          </div>
        )}

        {(state.phase === "reveal" || state.phase === "done") && state.scored && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {state.scored.band > 0
                  ? `${coop ? "TOGETHER" : psychic.name.toUpperCase()} +${state.scored.band}`
                  : `${coop ? "TOGETHER" : psychic.name.toUpperCase()} MISSED`}
              </span>
              {!coop && state.scored.stolen && (
                <span style={{ ...display(15, { color: PLAYER_COLORS[other(state.psychic)] }) }}>
                  {guessing.name.toUpperCase()} +1
                </span>
              )}
              {coop && <span className="text-[12px] text-white/40">{state.pot} so far</span>}
            </div>
            {state.phase === "done" ? (
              <ActionButton onClick={onRestart} grow>
                {coop ? `${state.pot} OF ${potMax(state.runLength)} — GO AGAIN` : "NEW GAME"}
              </ActionButton>
            ) : (
              <ActionButton onClick={() => onAction({ type: "next" })} grow>
                NEXT ROUND &mdash; {guessing.name.toUpperCase()} IS PSYCHIC
              </ActionButton>
            )}
          </div>
        )}
      </div>

      {/* UNDO, kept away from the buttons it exists to reverse - a reveal
          is final for the round and a mis-tapped side hands the other
          team a point, in front of an audience. */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-lg px-4 py-2.5 transition-colors disabled:opacity-30"
          style={{ ...display(11, { letterSpacing: 2, color: "rgba(255,255,255,0.6)" }), border: `2px solid ${RULE}` }}
        >
          ↶ UNDO LAST MOVE
        </button>
      </div>
    </div>
  );
}
