"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useNow } from "@/hooks/useNow";
import { deck, DECKS, type DeckKey } from "@/lib/wavelength/spectrums";
import { startGame, reduce, lidFor, COOP_ROUNDS, type Mode, type WavelengthState } from "@/lib/wavelength/engine";
import { isRoomCode } from "@/lib/wavelength/room";
import { useWaveRoomState } from "@/components/wavelength/useWaveRoom";
import { OverlayBoard, STAGE_W, STAGE_H } from "@/components/wavelength/OverlayBoard";
import { DEFAULT_BANDS, isBandPalette } from "@/components/wavelength/Dial";

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
//   ?mode=coop        draw the DEMO as a co-op run rather than two teams
//   ?bands=sea        which scoring-band palette - see Dial.tsx. This one
//                     applies in a room too, so an OBS source can be set
//                     to a palette without a deploy
//   ?peek=open        draw the DEMO mid-peek - the moment the psychic
//                     lifts the lid to look. This is the frame that went
//                     missing from a recording, so it is worth being able
//                     to look at it without setting up a room
//   ?debug=1          a small readout: which build is drawing, whether the
//                     socket is up, what has arrived, and what the lid is
//                     doing. CHECK THIS BEFORE RECORDING - a stale OBS
//                     cache looks exactly like a broken game.

// A deterministic mid-round position, so the graphic can be judged with
// something in it rather than four em dashes. Demo only - in a room every
// one of these numbers comes off the wire, and the target does not arrive
// at all until the reveal.
function demoState(deckKey: DeckKey, names: string[], phase: string | null, target: number | null, mode: Mode, peek: WavelengthState["peek"]): WavelengthState {
  const DEMO_SEED = "overlay-demo";
  let state = startGame(deck(deckKey), deckKey, names, DEMO_SEED, mode);
  state =
    mode === "coop"
      ? { ...state, pot: 11, round: 4, runLength: COOP_ROUNDS }
      : { ...state, teams: state.teams.map((t, i) => ({ ...t, score: i === 0 ? 6 : 4 })), round: 5 };
  // The wedge can sit anywhere on the dial now, including mostly off the
  // bottom of either end, and those are exactly the positions that are
  // awkward to reach by playing. Demo only.
  if (target !== null) state = { ...state, target };
  // Set on the state rather than passed to the graphic, so the demo goes
  // through lidFor() exactly the way a real board's message does - a demo
  // that took a shortcut here would happily draw a peek the live path
  // cannot.
  if (peek !== "shut") state = { ...state, peek };
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

// WHAT TO CHECK BEFORE YOU HIT RECORD.
//
// The reveal went missing from a whole recording once, and the reason it
// was only discovered in the edit is that all three ways it can fail look
// identical on screen - a dial that never opens:
//
//   1. OBS is serving a stale bundle. The likeliest one by far, because
//      OBS caches a browser source hard and an old overlay ACCEPTS a new
//      board's message perfectly happily; it just does not draw the part
//      it has never heard of. `build` is what catches this.
//   2. The socket is not connected, or nothing is arriving. `socket` and
//      `heard` catch that.
//   3. Messages arrive and are thrown out by the validator. Invisible
//      before now, because a dropped message leaves the last good state on
//      screen. `dropped` catches it.
//
// Behind ?debug=1, never on by accident, and it reads state rather than
// deciding anything - turning it on cannot change what the graphic draws.
function Readout({
  live,
  seen,
  dropped,
  at,
  state,
  room,
}: {
  live: boolean;
  seen: number;
  dropped: number;
  at: number;
  state: WavelengthState | null;
  room: string | null;
}) {
  const lid = state ? lidFor(state) : null;
  // The same ticking clock the pick'em board locks on. Date.now() straight
  // in the render is impure and would freeze at whatever the last render
  // happened to see - which for a readout whose job is "is anything still
  // arriving" is the one thing it must not do.
  const now = useNow();
  const ago = at && now ? `${Math.round((now - at) / 1000)}s ago` : at ? "just now" : "never";
  const rows: [string, string, boolean][] = [
    ["build", process.env.NEXT_PUBLIC_BUILD_REF ?? "?", true],
    ["room", room ?? "none (demo)", !!room],
    ["socket", live ? "connected" : "not connected", live],
    ["heard", `${seen} · ${ago}`, seen > 0],
    ["dropped", String(dropped), dropped === 0],
    ["peek", state ? state.peek : "-", true],
    ["lid", lid ? `${lid.open ? "open" : "shut"} · wedge ${lid.wedge ? "on" : "off"}` : "-", true],
  ];
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 20,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(5,7,13,0.9)",
        border: "1px solid rgba(255,255,255,0.18)",
        font: "12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {rows.map(([label, value, good]) => (
        <div key={label} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
          <span style={{ color: good ? "#7cf0a8" : "#ff8f6b" }}>{value}</span>
        </div>
      ))}
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
  const { message, live, seen, dropped, at } = useWaveRoomState(room);

  const camTop = Number(params.get("top") ?? 560);
  const camBottom = Number(params.get("bottom") ?? 560);
  const preview = params.get("preview") === "1";
  const bandsParam = params.get("bands");
  const bands = isBandPalette(bandsParam) ? bandsParam : DEFAULT_BANDS;
  const coopDemo = params.get("mode") === "coop";

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
          coopDemo ? [params.get("t1") ?? "Dallas", params.get("t2") ?? "Noah"] : [params.get("t1") ?? "Team 1", params.get("t2") ?? "Team 2"],
          params.get("phase"),
          params.has("target") ? Number(params.get("target")) : null,
          coopDemo ? "coop" : "teams",
          params.get("peek") === "open" ? "open" : params.get("peek") === "closing" ? "closing" : "shut",
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
          <OverlayBoard state={state} camTop={camTop} camBottom={camBottom} bands={bands} />
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

      {params.get("debug") === "1" && <Readout live={live} seen={seen} dropped={dropped} at={at} state={state} room={room} />}

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
