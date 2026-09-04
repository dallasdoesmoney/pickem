"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, openLot, reduce, toAct, AuctionState } from "@/lib/auction/engine";
import type { AuctionFormat } from "@/lib/auction/format";
import { isRoomCode } from "@/lib/auction/room";
import { useRoomState } from "@/components/versus/useRoom";
import { OverlayBoard, STAGE_W, STAGE_H, DEFAULT_LAYOUT } from "@/components/versus/OverlayBoard";
import { isLayoutKey } from "@/components/versus/layouts";
import type { AnimKey } from "@/components/versus/anims";

// THE OBS BROWSER SOURCE.
//
// Point a browser source at this URL, set it to 1080 x 1920, and it draws
// the draft over a transparent background with the top and bottom left
// clear for two face cams.
//
//   ?room=k7m2xq...   follow a live board. Without it, a demo draft.
//   ?top=560          pixels reserved for the top cam
//   ?bottom=560       pixels reserved for the bottom cam
//   ?preview=1        look at it WITHOUT OBS - see below
//   ?format=nfl-teams which mode the DEMO draws (ignored in a room)
//   ?phase=ready|spinning|open  which moment of a lot the DEMO holds on
//   ?layout=a..e      which arrangement - see layouts.tsx
//   ?anims=bump,sold,land,drain   which of the new beats to play
//   ?p1=Noah&p2=Ben   names on the DEMO rails (ignored in a room)
//
// The cam bands are query parameters rather than constants because they
// are the thing that gets adjusted while looking at the actual shot, and
// waiting on a deploy to nudge a graphic down forty pixels is no way to
// set up a stream.

// A deterministic mid-draft position, so the graphic can be judged with
// real names in the rails rather than five em dashes. Demo only - in a
// room every one of these numbers comes off the wire.
function demoState(format: AuctionFormat, names: string[], seed: string, lots: number, phase: string | null): AuctionState {
  let state = startAuction(format, names, seed);
  for (let i = 0; i < lots && state.phase !== "done"; i++) {
    const who = state.opener;
    state = openLot(state, format);
    // At least a dollar: the floor belongs to whoever is on the clock,
    // so $0 is not a legal opening bid any more.
    state = reduce(state, { type: "bid", by: who, amount: 1 + ((i * 3) % 6) }, format);
    if (state.phase === "bidding") state = reduce(state, { type: "pass", by: (who + 1) % 2 }, format);
    if (state.phase === "assigning") {
      const open = format.slots.filter((s) => state.players[state.won!.by].roster[s.key] === null);
      const item = format.items.find((it) => it.id === state.order[state.index]);
      const slot = open.find((s) => !item?.fills || s.key in item.fills);
      if (slot) state = reduce(state, { type: "assign", slotKey: slot.key }, format);
    }
  }
  // Which moment of a lot to hold on. The reel and the not-yet-started
  // card are two thirds of what is on screen during a draft, so they have
  // to be lookable-at without playing a game to reach them.
  if (phase === "ready") return state;
  state = reduce(state, { type: "spin" }, format);
  if (phase === "spinning") return state;
  state = reduce(state, { type: "reveal" }, format);
  // The opening move, before anybody has bid - the only moment the turn
  // indicator is up, so the only moment it can be looked at.
  if (phase === "open") return state;
  // Stop one action short so the "X BIDS $n" line has something in it.
  if (state.phase === "bidding") state = reduce(state, { type: "bid", by: toAct(state, format) ?? state.opener, amount: 4 }, format);
  return state;
}

// A cam band in preview: a translucent tint over the checkerboard, not a
// solid block. Solid read as "the overlay draws here", which is the one
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
  const { message } = useRoomState(room);

  const camTop = Number(params.get("top") ?? 560);
  const camBottom = Number(params.get("bottom") ?? 560);
  // WITHOUT OBS. The graphic is a 1080x1920 transparent layer, which in a
  // normal browser tab is a cropped mess on a white page - so there is no
  // way to judge it, or to check a change, without setting up streaming
  // software first.
  //
  // preview=1 shrinks the whole stage to fit the window and paints stand-
  // ins where the two cams will be. It is the same graphic, composited
  // the same way; only the surroundings are fake.
  //
  // Everything behind the graphic in preview is a CHECKERBOARD, the one
  // pattern everybody already reads as "nothing is here". The first
  // version painted the cam bands as flat colour and the middle band as
  // flat dark, which looked exactly like a graphic with a dark background
  // - the opposite of what the preview exists to show.
  const preview = params.get("preview") === "1";
  const layoutParam = params.get("layout");
  const layout = isLayoutKey(layoutParam) ? layoutParam : DEFAULT_LAYOUT;
  // Off unless asked for, so the live browser source is untouched while
  // these are being chosen between.
  const ANIM_KEYS: AnimKey[] = ["bump", "sold", "land", "drain"];
  const anims = (params.get("anims") ?? "").split(",").filter((k): k is AnimKey => (ANIM_KEYS as string[]).includes(k));

  const demoFormat = AUCTION_FORMATS[params.get("format") ?? "nfl-teams"] ?? Object.values(AUCTION_FORMATS)[0];
  const format = message ? AUCTION_FORMATS[message.slug] : demoFormat;

  // In a room, nothing is drawn until the board has said something. The
  // alternative - falling back to the demo - would put two invented names
  // and a fake $4 bid on a live stream when a connection hiccups.
  const state = message
    ? message.state
    : room
      ? null
      : format
        ? demoState(
            format,
            [params.get("p1") ?? "Player 1", params.get("p2") ?? "Player 2"],
            params.get("seed") ?? "overlay-demo",
            Number(params.get("lots") ?? 3),
            params.get("phase"),
          )
        : null;

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
        ${
          preview
            ? `.obs-void { background: repeating-conic-gradient(#59617a 0% 25%, #444b60 0% 50%) 50% / 64px 64px; }`
            : ""
        }
      `}</style>

      {preview && (
        // Sets --stage-scale from the window size. A script rather than a
        // resize effect in React: it runs before hydration, so the stage
        // is the right size on the first paint rather than after a jump,
        // and it holds no state to get out of step.
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
          //
          // The whole stage is checkerboard, because the whole stage IS
          // transparent - top to bottom, cam bands included. The two cam
          // blocks are drawn as translucent tint over that checker rather
          // than solid colour, so it stays readable as "the overlay puts
          // nothing here; your camera does".
          <div aria-hidden className="obs-void" style={{ position: "absolute", inset: 0, zIndex: -1 }}>
            <CamStandIn top={0} height={camTop} tint="#c8a882" label="TOP CAM" />
            <CamStandIn top={STAGE_H - camBottom} height={camBottom} tint="#7fa8c8" label="BOTTOM CAM" />
          </div>
        )}

        {format && state ? (
          <OverlayBoard state={state} format={format} camTop={camTop} camBottom={camBottom} layout={layout} anims={anims} />
        ) : room ? (
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
        ) : null}
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

export default function OverlayPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
