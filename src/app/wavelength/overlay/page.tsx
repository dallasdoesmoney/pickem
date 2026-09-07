"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { deck, DECKS, type DeckKey } from "@/lib/wavelength/spectrums";
import { startGame, reduce, type WavelengthState } from "@/lib/wavelength/engine";
import { isRoomCode } from "@/lib/wavelength/room";
import { useWaveRoomState } from "@/components/wavelength/useWaveRoom";
import { OverlayBoard, STAGE_W, STAGE_H } from "@/components/wavelength/OverlayBoard";

// THE OBS BROWSER SOURCE, the twin of /versus/overlay.
//
// Point a browser source at this URL, set it to 1080 x 1920, and it draws
// the game over a transparent background with the top and bottom left
// clear for two face cams.
//
//   ?room=k7m2xq...   follow a live board. Without it, a demo round.
//   ?top=560          pixels reserved for the top cam
//   ?bottom=560       pixels reserved for the bottom cam
//   ?preview=1        look at it WITHOUT OBS
//   ?deck=football    which deck the DEMO draws from (ignored in a room)
//   ?phase=clue|guess|steal|reveal   which moment the DEMO holds on
//   ?t1=Us&t2=Them    names on the DEMO scores (ignored in a room)
//   ?target=2.5       put the DEMO's wedge at an exact spot, for looking
//                     at the extremes without playing forty rounds

// A deterministic mid-round position, so the graphic can be judged with
// something in it rather than four em dashes. Demo only - in a room every
// one of these numbers comes off the wire, and the target does not arrive
// at all until the reveal.
function demoState(deckKey: DeckKey, names: string[], phase: string | null, target: number | null): WavelengthState {
  const DEMO_SEED = "overlay-demo";
  let state = startGame(deck(deckKey), deckKey, names, DEMO_SEED);
  state = { ...state, teams: state.teams.map((t, i) => ({ ...t, score: i === 0 ? 6 : 4 })), round: 5 };
  // The wedge can sit anywhere on the dial now, including mostly off the
  // bottom of either end, and those are exactly the positions that are
  // awkward to reach by playing. Demo only.
  if (target !== null) state = { ...state, target };
  if (phase === "clue" || phase === null) return { ...state, clue: "Coffee" };
  state = reduce(state, { type: "clue", text: "Coffee" }, deck(deckKey), DEMO_SEED);
  state = reduce(state, { type: "guess", value: 61.5 }, deck(deckKey), DEMO_SEED);
  if (phase === "guess") return state;
  state = reduce(state, { type: "steal", side: "right" }, deck(deckKey), DEMO_SEED);
  if (phase === "steal") return state;
  return reduce(state, { type: "reveal" }, deck(deckKey), DEMO_SEED);
}

// A cam band in preview: a translucent tint over the checkerboard, not a
// solid block. Solid reads as "the overlay draws here", which is the one
// thing it must not say - these bands are the emptiest part of the layer.
function CamStandIn({ top, height, tint, label }: { top: number; height: number; tint: string; label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        width: STAGE_W,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${tint}44`,
        borderTop: "2px dashed rgba(255,255,255,0.35)",
        borderBottom: "2px dashed rgba(255,255,255,0.35)",
        fontFamily: "var(--font-display)",
        fontSize: 42,
        letterSpacing: 6,
        color: "rgba(255,255,255,0.65)",
      }}
    >
      {label}
    </div>
  );
}

function OverlayInner() {
  const params = useSearchParams();

  // A room turns this from a demo into a mirror of a live board. Checked
  // for shape before it is used, so a mangled URL opens a demo rather
  // than subscribing to a channel named after somebody's typo.
  const roomParam = params.get("room");
  const room = roomParam && isRoomCode(roomParam) ? roomParam : null;
  const { message } = useWaveRoomState(room);

  const camTop = Number(params.get("top") ?? 560);
  const camBottom = Number(params.get("bottom") ?? 560);
  const preview = params.get("preview") === "1";

  const deckParam = params.get("deck");
  const demoDeck: DeckKey = DECKS.some((d) => d.key === deckParam) ? (deckParam as DeckKey) : DECKS[0].key;

  // In a room, nothing is drawn until the board has said something. The
  // alternative - falling back to the demo - would put two invented team
  // names and a fake clue on a live stream when a connection hiccups.
  const state = message
    ? message.state
    : room
      ? null
      : demoState(
          demoDeck,
          [params.get("t1") ?? "Team 1", params.get("t2") ?? "Team 2"],
          params.get("phase"),
          params.has("target") ? Number(params.get("target")) : null,
        );

  return (
    <>
      {/* The page is a graphic, not a document. The site's tiled backdrop
          and its dark ground both live in the root layout, so they are
          turned off here rather than by restructuring the app around one
          route. NavShell skips its chrome for this path on its own. */}
      <style>{`
        html, body { background: ${preview ? "#0a0f1a" : "transparent"} !important; }
        body > svg[aria-hidden="true"] { display: none !important; }
        body { overflow: hidden; }
        ${preview ? `.obs-void { background: repeating-conic-gradient(#59617a 0% 25%, #444b60 0% 50%) 50% / 64px 64px; }` : ""}
      `}</style>

      {preview && (
        // Sets --stage-scale from the window size. A script rather than a
        // resize effect in React: it runs before hydration, so the stage
        // is the right size on the first paint rather than after a jump.
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function f(){document.documentElement.style.setProperty("--stage-scale",Math.min(innerWidth/${STAGE_W},innerHeight/${STAGE_H}));}f();addEventListener("resize",f);})();`,
          }}
        />
      )}

      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          position: "fixed",
          top: 0,
          left: preview ? "50%" : 0,
          transform: preview ? "translateX(-50%) scale(var(--stage-scale, 0.4))" : undefined,
          transformOrigin: "top center",
        }}
      >
        {preview && (
          // Stand-ins, behind the graphic. Nothing here ships to OBS.
          <div aria-hidden className="obs-void" style={{ position: "absolute", inset: 0, zIndex: -1 }}>
            <CamStandIn top={0} height={camTop} tint="#c8a882" label="TOP CAM" />
            <CamStandIn top={STAGE_H - camBottom} height={camBottom} tint="#7fa8c8" label="BOTTOM CAM" />
          </div>
        )}

        {state ? (
          <OverlayBoard state={state} camTop={camTop} camBottom={camBottom} />
        ) : (
          // Small and dim on purpose. If this ever does appear on a live
          // stream it should read as a status light, not an error page.
          <div
            style={{
              position: "absolute",
              top: camTop,
              left: 0,
              width: STAGE_W,
              height: STAGE_H - camTop - camBottom,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: 26,
              letterSpacing: 5,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            WAITING FOR THE BOARD
          </div>
        )}
      </div>

      {preview && (
        // Outside the stage, so it is not scaled with the graphic and
        // never gets mistaken for part of it.
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: 10,
            maxWidth: 340,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(5,7,13,0.82)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.72)",
            font: "12px/1.45 system-ui, sans-serif",
          }}
        >
          Preview only. The checkerboard and the two cam blocks are not in the
          graphic &mdash; in OBS every one of those pixels is transparent and
          your cameras show through. Drop <code>&amp;preview=1</code> for the
          real browser source.
        </div>
      )}
    </>
  );
}

export default function WavelengthOverlayPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
