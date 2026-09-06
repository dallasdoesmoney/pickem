"use client";

import { useState } from "react";
import type { WavelengthState, WavelengthAction } from "@/lib/wavelength/engine";
import { other } from "@/lib/wavelength/engine";
import { PLAYER_COLORS, MONEY, outlined, display } from "@/components/versus/style";
import { WaveStage } from "./WaveStage";
import { Dial } from "./Dial";

// THE CONTROL SCREEN, which is the overlay plus buttons - the same
// arrangement the draft settled on. The graphic is the page, full width,
// and underneath it are only the things you cannot do by looking: see the
// target, type the clue, turn the dial, call the side, reveal.
//
// One screen, in a room, passed around. Which is the whole reason for the
// HOLD button below.

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

// THE ONE PLACE THE TARGET IS SEEN, and it has to be held down.
//
// Everybody is looking at the same screen, which is exactly the problem:
// the psychic needs the answer and nobody else may have it. A button that
// toggles gets left on. A button that has to be held is only ever showing
// the target while somebody is holding the phone, which is the same
// gesture as picking up the physical screen and tilting it away - and it
// puts itself back the instant they let go, including if they drop it,
// switch apps, or hand it over.
function PeekAtTarget({ state }: { state: WavelengthState }) {
  const [held, setHeld] = useState(false);
  const release = () => setHeld(false);

  return (
    <div>
      <button
        type="button"
        onPointerDown={() => setHeld(true)}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full rounded-xl py-4"
        style={{
          ...display(14, { letterSpacing: 2, color: held ? "#05070d" : PLAYER_COLORS[state.psychic] }),
          background: held ? PLAYER_COLORS[state.psychic] : "transparent",
          border: `2px dashed ${held ? PLAYER_COLORS[state.psychic] : RULE}`,
          // A long press on a touch screen otherwise selects text or pops
          // the browser's own menu over the answer.
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        {held ? "LET GO TO HIDE IT" : "HOLD TO SEE THE TARGET"}
      </button>

      {held && state.target !== null && (
        <div data-peek className="mt-3 flex justify-center rounded-xl py-4" style={{ border: `2px solid ${RULE}` }}>
          <Dial
            width={300}
            left={state.card.left}
            right={state.card.right}
            target={state.target}
            guess={null}
            team={state.psychic}
            showTarget
          />
        </div>
      )}
    </div>
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
  // turned. Every keystroke of a clue and every pixel of the dial is an
  // action, and recording them would make UNDO mean "delete one letter".
  onAction: (action: WavelengthAction, record?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRestart: () => void;
}) {
  const psychic = state.teams[state.psychic];
  const guessing = state.teams[other(state.psychic)];
  const hasClue = state.clue.trim() !== "";
  // The dial is live from the moment there is a clue on the board, and
  // locked once the other team has called a side.
  const dialLive = (state.phase === "clue" && hasClue) || state.phase === "guess";

  return (
    <div className="flex w-full flex-col">
      {/* ---- the graphic, exactly as the stream gets it ---- */}
      <div className="w-full">
        {/* The DECK, and only the deck. The round, the score, the target
            and the clue are all on the graphic two inches below this, and
            printing any of them again here is one more thing that can end
            up disagreeing with the copy the viewers are watching. */}
        <div className="mb-1 px-1">
          <span style={{ ...display(11, { letterSpacing: 3, color: "rgba(255,255,255,0.32)" }) }}>
            {deckTitle.toUpperCase()}
          </span>
        </div>
        <WaveStage state={state} />
      </div>

      {/* ---- and the only things you cannot do by looking ---- */}
      <div className="mt-2 flex flex-col gap-4 border-t pt-5" style={{ borderColor: RULE }}>
        {state.phase === "clue" && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {psychic.name.toUpperCase()} IS THE PSYCHIC
              </span>
              <span className="text-[12px] text-white/40">nobody else looks</span>
            </div>

            <PeekAtTarget state={state} />

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
              Say it out loud as well &mdash; it goes straight onto the overlay. Then{" "}
              <span className="text-white/60">{psychic.name}&rsquo;s team</span> turns the dial.
            </p>
          </>
        )}

        {dialLive && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(16, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }) }}>
                TURN THE DIAL
              </span>
              <span style={{ ...display(22, { color: "rgba(255,255,255,0.75)", fontVariantNumeric: "tabular-nums" }) }}>
                {state.guess === null ? "—" : state.guess.toFixed(1)}
              </span>
            </div>

            {/* The two ends, named, because a bare 0-100 slider says
                nothing about which way round the card is. */}
            <div className="flex items-center justify-between gap-3 text-[11.5px] text-white/45">
              <span className="min-w-0 truncate">{state.card.left}</span>
              <span className="min-w-0 truncate text-right">{state.card.right}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={state.guess ?? 50}
              onChange={(e) => onAction({ type: "guess", value: Number(e.target.value) }, false)}
              aria-label="Where the target is"
              className="h-8 w-full"
              style={{ accentColor: PLAYER_COLORS[state.psychic] }}
            />

            {state.guess !== null && (
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
              REVEAL THE TARGET
            </ActionButton>
          </div>
        )}

        {(state.phase === "reveal" || state.phase === "done") && state.scored && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(20, { color: PLAYER_COLORS[state.psychic], letterSpacing: 1 }), ...outlined(20, "soft") }}>
                {state.scored.band > 0 ? `${psychic.name.toUpperCase()} +${state.scored.band}` : `${psychic.name.toUpperCase()} MISSED`}
              </span>
              {state.scored.stolen && (
                <span style={{ ...display(15, { color: PLAYER_COLORS[other(state.psychic)] }) }}>
                  {guessing.name.toUpperCase()} +1
                </span>
              )}
            </div>
            {state.phase === "done" ? (
              <ActionButton onClick={onRestart} grow>
                NEW GAME
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
      <div className="mt-4 flex justify-center">
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
