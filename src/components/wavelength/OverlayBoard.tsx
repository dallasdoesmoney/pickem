"use client";

import type { WavelengthState } from "@/lib/wavelength/engine";
import { WIN_SCORE, other } from "@/lib/wavelength/engine";
import { PLAYER_COLORS, MONEY, INK, outlined } from "@/components/versus/style";
import { Dial } from "./Dial";

// THE GRAPHIC, on the same 1080 x 1920 transparent stage the draft uses,
// with the same two cam bands clear at the top and the bottom. Everything
// about the vocabulary is borrowed on purpose - the display face, the ink
// outline, the two player colours, the money green - because two games on
// one channel should look like one show.
export const STAGE_W = 1080;
export const STAGE_H = 1920;

// The press, the same block of ink the draft's picks wear.
const PRESS = `4px 5px 0 ${INK}`;

function Score({ state, who, align }: { state: WavelengthState; who: 0 | 1; align: "left" | "right" }) {
  const team = state.teams[who];
  const isPsychic = state.psychic === who;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 40, lineHeight: 1, color: PLAYER_COLORS[who], ...outlined(40) }}>
        {team.name.toUpperCase()}
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, color: "#ffffff", ...outlined(64) }}>
        {team.score}
      </span>
      {/* WHO IS HOLDING THE CARD. Without it a viewer joining mid-round
          has no idea which side is guessing and which is about to call
          left or right. */}
      {isPsychic && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            letterSpacing: 3,
            color: INK,
            background: PLAYER_COLORS[who],
            padding: "5px 12px",
            borderRadius: 999,
            boxShadow: PRESS,
          }}
        >
          PSYCHIC
        </span>
      )}
    </div>
  );
}

export function OverlayBoard({
  state,
  camTop = 560,
  camBottom = 560,
}: {
  state: WavelengthState;
  camTop?: number;
  camBottom?: number;
}) {
  const bandHeight = STAGE_H - camTop - camBottom;
  const reveal = state.phase === "reveal" || state.phase === "done";
  const dialW = 760;

  // What the big line says. One place, so the graphic never has two
  // opinions about what moment it is.
  const headline = (() => {
    if (state.phase === "done") {
      const winner = state.teams[0].score >= WIN_SCORE ? 0 : 1;
      return { text: `${state.teams[winner].name.toUpperCase()} WINS`, color: PLAYER_COLORS[winner] };
    }
    if (reveal && state.scored) {
      const band = state.scored.band;
      return {
        text: band > 0 ? `+${band}` : "MISSED",
        color: band > 0 ? MONEY : "rgba(255,255,255,0.7)",
      };
    }
    if (state.phase === "steal") {
      const caller = other(state.psychic);
      return { text: `${state.teams[caller].name.toUpperCase()} CALLS IT`, color: PLAYER_COLORS[caller] };
    }
    if (state.phase === "guess") {
      return { text: `${state.teams[state.psychic].name.toUpperCase()} IS TURNING`, color: PLAYER_COLORS[state.psychic] };
    }
    return { text: `${state.teams[state.psychic].name.toUpperCase()} IS THINKING`, color: PLAYER_COLORS[state.psychic] };
  })();

  return (
    <div style={{ width: STAGE_W, height: STAGE_H, position: "relative", overflow: "hidden" }}>
      <div
        // Marked so WaveStage can measure it: cropping the graphic out of
        // the stage means knowing how tall the graphic actually is, and
        // that changes with the clue, the headline and the steal line.
        data-band
        style={{
          position: "absolute",
          top: camTop,
          left: 0,
          width: STAGE_W,
          height: bandHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: "0 40px",
        }}
      >
        {/* Round and the target score, small, so a clip that starts here
            still says what is being played. */}
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.45)", ...outlined(22) }}>
          ROUND {state.round} &middot; FIRST TO {WIN_SCORE}
        </span>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
          <Score state={state} who={0} align="left" />
          <Score state={state} who={1} align="right" />
        </div>

        {/* WRAPPED IN A DIV, and it has to be. An <svg> is an SVGElement,
            not an HTMLElement, so it has no offsetTop or offsetHeight -
            and WaveStage measures this band's children through exactly
            those two properties. Left bare, the measurement came back
            NaN, the mirror silently fell back to drawing the whole 1920
            stage, and a third of the control screen was empty. */}
        <div>
          <Dial
            width={dialW}
            left={state.card.left}
            right={state.card.right}
            target={state.target}
            guess={state.guess}
            team={state.psychic}
            showTarget={reveal}
          />
        </div>

        {/* THE CLUE, which is the whole round in one word. Biggest thing
            on the graphic after the dial, and empty until the psychic has
            actually said it. */}
        <div style={{ minHeight: 92, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
          {state.clue.trim() === "" ? (
            <span style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: 4, color: "rgba(255,255,255,0.3)", ...outlined(34) }}>
              WAITING FOR THE CLUE
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-display)",
                // Long clues shrink rather than wrap: two lines here
                // would push the dial into a cam band.
                fontSize: state.clue.length > 18 ? 52 : 76,
                lineHeight: 1,
                color: "#ffffff",
                textAlign: "center",
                ...outlined(state.clue.length > 18 ? 52 : 76),
              }}
            >
              &ldquo;{state.clue.toUpperCase()}&rdquo;
            </span>
          )}
        </div>

        <span style={{ fontFamily: "var(--font-display)", fontSize: 40, letterSpacing: 3, color: headline.color, ...outlined(40) }}>
          {headline.text}
        </span>

        {/* The catch-up point, only once it has been decided. */}
        {reveal && state.scored?.stolen && (
          <span style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 3, color: PLAYER_COLORS[other(state.psychic)], ...outlined(26) }}>
            {state.teams[other(state.psychic)].name.toUpperCase()} CALLED THE SIDE &middot; +1
          </span>
        )}
      </div>
    </div>
  );
}
