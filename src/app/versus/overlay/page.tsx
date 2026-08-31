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
          // Stand-ins for the two face cams, behind the graphic. Nothing
          // here ships to OBS - it is the wallpaper that makes the
          // transparent parts legible on a monitor.
          <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: -1 }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: STAGE_W, height: camTop, background: "linear-gradient(160deg,#6b4f3a,#c8a882)" }} />
            <div style={{ position: "absolute", top: camTop, left: 0, width: STAGE_W, height: STAGE_H - camTop - camBottom, background: "#101a2e" }} />
            <div style={{ position: "absolute", top: STAGE_H - camBottom, left: 0, width: STAGE_W, height: camBottom, background: "linear-gradient(160deg,#33506b,#7fa8c8)" }} />
            <div style={{ position: "absolute", top: camTop - 1, left: 0, width: STAGE_W, height: 2, background: "rgba(255,255,255,0.25)" }} />
            <div style={{ position: "absolute", top: STAGE_H - camBottom - 1, left: 0, width: STAGE_W, height: 2, background: "rgba(255,255,255,0.25)" }} />
          </div>
        )}
        <OverlayBoard state={state} format={format} camTop={camTop} camBottom={camBottom} />
      </div>
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
