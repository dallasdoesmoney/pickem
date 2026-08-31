"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AUCTION_FORMATS } from "@/lib/auction/formats";
import { startAuction, reduce, AuctionState } from "@/lib/auction/engine";
import { OverlayBoard, STAGE_W, STAGE_H } from "@/components/versus/OverlayBoard";

// THE OBS BROWSER SOURCE.
//
// Point a browser source at this URL, set it to 1080 x 1920, and it draws
// the draft over a transparent background with the top and bottom left
// clear for two face cams.
//
//   ?format=nfl-teams   which mode to draw
//   ?top=560            pixels reserved for the top cam
//   ?bottom=560         pixels reserved for the bottom cam
//   ?p1=Noah&p2=Ben     names on the rails
//   ?preview=1          look at it WITHOUT OBS - see below
//
// The cam bands are query parameters rather than constants because they
// are the thing that gets adjusted while looking at the actual shot, and
// waiting on a deploy to nudge a graphic down forty pixels is no way to
// set up a stream.
//
// STILL DRIVEN BY A DEMO STATE. The live wiring - a room code, and the
// control page broadcasting its state to this one over Supabase Realtime
// - is the next step. This exists first so the graphic can be looked at
// in OBS, over the real cams, and argued about before any of that is
// built: the layout is the part that needs eyes on it, and it is also the
// part that costs nothing to change.

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
  const slug = params.get("format") ?? "nfl-teams";
  const format = AUCTION_FORMATS[slug] ?? Object.values(AUCTION_FORMATS)[0];

  const camTop = Number(params.get("top") ?? 560);
  const camBottom = Number(params.get("bottom") ?? 560);
  const names = [params.get("p1") ?? "Player 1", params.get("p2") ?? "Player 2"];
  // How far into a demo draft to be. Lets a still be taken of an empty
  // board, a half-full one, or the moment something sells.
  const lots = Number(params.get("lots") ?? 3);
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

  if (!format) return null;

  // A deterministic mid-draft position, so the graphic can be judged with
  // real names in the rails rather than five em dashes.
  let state: AuctionState = startAuction(format, names, params.get("seed") ?? "overlay-demo");
  for (let i = 0; i < lots && state.phase !== "done"; i++) {
    const who = state.opener;
    state = reduce(state, { type: "bid", by: who, amount: (i * 3) % 7 }, format);
    if (state.phase === "bidding") state = reduce(state, { type: "pass", by: (who + 1) % 2 }, format);
    if (state.phase === "assigning") {
      const open = format.slots.filter((s) => state.players[state.won!.by].roster[s.key] === null);
      const item = format.items.find((it) => it.id === state.order[state.index]);
      const slot = open.find((s) => !item?.fills || s.key in item.fills);
      if (slot) state = reduce(state, { type: "assign", slotKey: slot.key }, format);
    }
  }
  // Stop one action short so the "X BIDS $n" line has something in it.
  if (state.phase === "bidding") state = reduce(state, { type: "bid", by: state.opener, amount: 4 }, format);

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
        <OverlayBoard state={state} format={format} camTop={camTop} camBottom={camBottom} />
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
