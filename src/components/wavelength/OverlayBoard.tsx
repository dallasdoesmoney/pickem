"use client";

import type { WavelengthState } from "@/lib/wavelength/engine";
import { WIN_SCORE, COOP_MAX } from "@/lib/wavelength/engine";
import { PLAYER_COLORS, MONEY, INK, outlined } from "@/components/versus/style";
import { Dial, COVER_MS, DEFAULT_BANDS, type BandPalette } from "./Dial";

// THE GRAPHIC, on the same 1080 x 1920 transparent stage the draft uses,
// with the same two cam bands clear at the top and the bottom. Everything
// about the vocabulary is borrowed on purpose - the display face, the ink
// outline, the two player colours, the money green - because two games on
// one channel should look like one show.
export const STAGE_W = 1080;
export const STAGE_H = 1920;

// The press, the same block of ink the draft's picks wear.
const PRESS = `4px 5px 0 ${INK}`;

// EVERY MOVING PART, in one place.
//
// This is a graphic on a live stream, so nothing here is decoration: a
// number that changes without moving is a number nobody notices, and the
// whole reveal is a piece of theatre. Keyframes rather than a library -
// the overlay is a browser source that must not throw, and the smallest
// thing that can go wrong is the best thing to ship.
//
// Everything is driven off state through React keys, so a re-render mid
// stream replays an animation rather than getting stuck half way through
// one.
export function WaveStyles() {
  return (
    <style>{`
      /* The lid. A 180deg sector clipped to the top half, so swinging it
         round simply puts it in the half that is clipped away. */
      .wl-cover { transition: transform ${COVER_MS}ms cubic-bezier(.22,.7,.28,1); }
      /* Negative, so the shutter travels away to the left and the face
         uncovers the way the spectrum reads - the left word first. */
      .wl-cover.wl-open { transform: rotate(-180deg); }

      /* The needle glides. On the board that is the drag having weight;
         on the overlay it is the difference between the guess moving and
         the guess teleporting. */
      .wl-needle { transition: transform 170ms cubic-bezier(.2,.75,.3,1); }
      /* Except while somebody is dragging it, when easing is just lag. */
      .wl-needle.wl-dragging { transition: none; }

      .wl-pulse { animation: wl-pulse 780ms ease-in-out 2 both; }
      @keyframes wl-pulse { 0%,100% { opacity: .96 } 50% { opacity: .38 } }

      /* A new card arriving. */
      .wl-in { animation: wl-in 440ms cubic-bezier(.2,.8,.3,1) both; }
      @keyframes wl-in {
        from { opacity: 0; transform: translateY(18px) scale(.965) }
        to   { opacity: 1; transform: none }
      }

      /* A number that just changed, or a line that just appeared. */
      .wl-pop { animation: wl-pop 520ms cubic-bezier(.34,1.45,.5,1) both; }
      @keyframes wl-pop {
        0%   { opacity: 0; transform: scale(.72) }
        58%  { opacity: 1; transform: scale(1.09) }
        100% { opacity: 1; transform: scale(1) }
      }

      /* The points, leaving the scoreboard on their way up. */
      .wl-float { animation: wl-float 1700ms cubic-bezier(.2,.7,.3,1) both; }
      @keyframes wl-float {
        0%   { opacity: 0; transform: translateY(14px) scale(.7) }
        16%  { opacity: 1; transform: translateY(0) scale(1.15) }
        72%  { opacity: 1; transform: translateY(-34px) scale(1) }
        100% { opacity: 0; transform: translateY(-64px) scale(1) }
      }

      /* Nobody has to watch any of this. */
      @media (prefers-reduced-motion: reduce) {
        .wl-cover, .wl-needle { transition: none }
        .wl-pulse, .wl-in, .wl-pop, .wl-float { animation: none }
      }
    `}</style>
  );
}

// TWO NUMBERS AND A PILL. The names came off: on a stream the two people
// are on camera and being addressed by name out loud, so printing "TEAM 1"
// over the top of them was the caption telling you what you are looking
// at. Which side is which is carried by the colour, the same two colours
// the draft uses, and by the pill on whoever is holding the card.
function Score({ state, who, align }: { state: WavelengthState; who: 0 | 1; align: "left" | "right" }) {
  const team = state.teams[who];
  const isPsychic = state.psychic === who;
  const scored = state.scored;
  // What this team just took off the round, so it can be thrown up out of
  // their own score rather than printed in a corner.
  const gained =
    scored === null
      ? 0
      : isPsychic
        ? scored.band
        : scored.stolen
          ? 1
          : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "left" ? "row" : "row-reverse",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* WHO IS HOLDING THE CARD. Without it a viewer joining mid-round
          has no idea which side is guessing and which is about to call
          left or right - and with the names gone it is the only thing
          left that says so. Keyed on the psychic so it pops across on the
          swap instead of silently reappearing on the other side. */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          // Reserved whether or not the pill is there, so the two sides of
          // the scoreboard sit on the same line all game.
          minHeight: 30,
          minWidth: 96,
          justifyContent: align === "left" ? "flex-start" : "flex-end",
        }}
      >
        <span>
          {isPsychic && (
            <span
              key={state.psychic}
              className="wl-pop"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-display)",
                fontSize: 19,
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
        </span>
      </span>

      <span style={{ position: "relative", display: "block" }}>
        {/* Keyed on the score, so the digits pop the moment they change
            and sit still the rest of the time. */}
        <span
          key={team.score}
          className="wl-pop"
          style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 72, lineHeight: 1, color: PLAYER_COLORS[who], ...outlined(72) }}
        >
          {team.score}
        </span>
        {gained > 0 && (
          <span
            key={`${state.round}-${gained}`}
            className="wl-float"
            style={{
              position: "absolute",
              top: -4,
              [align === "left" ? "left" : "right"]: -10,
              fontFamily: "var(--font-display)",
              fontSize: 36,
              lineHeight: 1,
              whiteSpace: "nowrap",
              color: MONEY,
              ...outlined(36),
            }}
          >
            +{gained}
          </span>
        )}
      </span>
    </div>
  );
}

// CO-OP, WHICH IS ONE SCORE AND TWO PEOPLE. The team scoreboard says who
// is beating whom, and here nobody is - so it says the only two things
// that matter instead: whose turn it is to be psychic, and the pile.
function CoopScore({ state }: { state: WavelengthState }) {
  const gained = state.scored ? state.scored.band : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ display: "flex", alignItems: "center", minHeight: 30, minWidth: 96 }}>
        <span
          key={state.psychic}
          className="wl-pop"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-display)",
            fontSize: 19,
            letterSpacing: 3,
            color: INK,
            background: PLAYER_COLORS[state.psychic],
            padding: "5px 12px",
            borderRadius: 999,
            boxShadow: PRESS,
          }}
        >
          PSYCHIC
        </span>
      </span>

      <span style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          key={state.pot}
          className="wl-pop"
          style={{ fontFamily: "var(--font-display)", fontSize: 72, lineHeight: 1, color: "#ffffff", ...outlined(72) }}
        >
          {state.pot}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1, color: "rgba(255,255,255,0.45)", ...outlined(26) }}>
          / {COOP_MAX}
        </span>
        {gained > 0 && (
          <span
            key={`${state.round}-${gained}`}
            className="wl-float"
            style={{
              position: "absolute",
              top: -4,
              right: -10,
              fontFamily: "var(--font-display)",
              fontSize: 36,
              lineHeight: 1,
              whiteSpace: "nowrap",
              color: MONEY,
              ...outlined(36),
            }}
          >
            +{gained}
          </span>
        )}
      </span>
    </div>
  );
}

export function OverlayBoard({
  state,
  camTop = 560,
  camBottom = 560,
  // Handed in only by the board, which is what makes the dial a control
  // there and a picture everywhere else.
  onScrub,
  bands = DEFAULT_BANDS,
}: {
  state: WavelengthState;
  camTop?: number;
  camBottom?: number;
  onScrub?: (value: number) => void;
  bands?: BandPalette;
}) {
  const bandHeight = STAGE_H - camTop - camBottom;
  const reveal = state.phase === "reveal" || state.phase === "done";
  const dialW = 860;

  // What the big line says. One place, so the graphic never has two
  // opinions about what moment it is.
  const coop = state.mode === "coop";
  // ONE LINE, AT THE END. Everything else this used to say - who is
  // thinking, who is turning, who calls it, what the round scored - is on
  // the board screen for the person running the game, and was noise on a
  // stream where both of them are talking anyway.
  const ending = coop
    ? { text: `${state.pot} OUT OF ${COOP_MAX}`, color: MONEY }
    : (() => {
        const winner = state.teams[0].score >= WIN_SCORE ? 0 : 1;
        return { text: `${state.teams[winner].name.toUpperCase()} WINS`, color: PLAYER_COLORS[winner] };
      })();

  return (
    <div style={{ width: STAGE_W, height: STAGE_H, position: "relative", overflow: "hidden" }}>
      <WaveStyles />
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
          gap: 16,
          padding: "0 40px",
        }}
      >
        {/* NOTHING BUT THE GAME.
            
            This layer used to narrate itself - the round, whose turn it
            was, what it was waiting for. All of that is on the board
            screen, where the person running it needs it, and none of it is
            on the stream, where two people are already saying it out loud.
            What is left is the three things a viewer cannot get any other
            way: the score, the dial, and the clue if one was typed. */}
        {coop ? (
          <CoopScore state={state} />
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
            <Score state={state} who={0} align="left" />
            <Score state={state} who={1} align="right" />
          </div>
        )}

        {/* KEYED ON THE CARD, so a new round is a new dial arriving rather
            than the old one's words changing under a lid that is halfway
            through closing. */}
        <div key={`${state.round}-${state.card.id}`} className="wl-in" style={{ display: "flex", justifyContent: "center" }}>
          <Dial
            width={dialW}
            left={state.card.left}
            right={state.card.right}
            // NOT DRAWN UNLESS IT IS MEANT TO BE SEEN, which is a
            // separate question from whether the lid is open: the wedge
            // has to outlive the shutter on the way down. Passing null
            // rather than hiding it under the lid keeps the rendered
            // graphic honest - if the wedge is in the page, it is because
            // somebody is allowed to look at it.
            target={reveal || state.peek !== "shut" ? state.target : null}
            guess={state.guess}
            // OFF THE STATE, so the lid is the same lid on every screen -
            // the board, the stream and the join link all draw whatever
            // the game says, rather than each keeping its own idea of it.
            open={reveal || state.peek === "open"}
            pulse={reveal}
            bands={bands}
            onScrub={onScrub}
          />
        </div>

        {/* THE CLUE, when there is one. The room is empty rather than
            captioned when there is not - but it is still RESERVED, because
            a graphic that jumps up forty pixels the moment somebody starts
            typing is worse than a graphic with a gap in it. */}
        <div style={{ minHeight: 84, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
          {state.clue.trim() !== "" && (
            // Not keyed on the text: this pops when the clue first lands
            // and then updates letter by letter as it is typed, which is
            // the point of carrying it live.
            <span
              className="wl-pop"
              style={{
                fontFamily: "var(--font-display)",
                // Long clues shrink rather than wrap: two lines here
                // would push the dial into a cam band.
                fontSize: state.clue.length > 18 ? 52 : 74,
                lineHeight: 1,
                color: "#ffffff",
                textAlign: "center",
                ...outlined(state.clue.length > 18 ? 52 : 74),
              }}
            >
              &ldquo;{state.clue.toUpperCase()}&rdquo;
            </span>
          )}
        </div>

        {/* THE ONE LINE THAT SURVIVED, and only at the very end. A game
            that simply stops is a strange thing to watch. */}
        {state.phase === "done" && (
          <span
            key={ending.text}
            className="wl-in"
            style={{ fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: 3, color: ending.color, ...outlined(44) }}
          >
            {ending.text}
          </span>
        )}
      </div>
    </div>
  );
}
