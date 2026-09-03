"use client";

import type { AuctionFormat } from "@/lib/auction/format";
import { AuctionState } from "@/lib/auction/engine";
import { PLAYER_COLORS } from "./style";
import { LAYOUTS, type LayoutKey } from "./layouts";

export { PLAYER_COLORS };

// THE OBS LAYER. Not a web page that happens to be on a stream - a
// graphic, sitting on a transparent background, over two face cams.
//
// Which means it is built to different rules than the rest of the site.
// The site is quiet, dark panels and thin type on a dark ground. This is
// the opposite: heavy outlined lettering that survives being composited
// over a moving camera feed, money in a green you can read across a room,
// and one number bigger than everything else on screen. It should look
// like the caption layer on a TikTok gaming clip, because that is what it
// is competing with.
//
// A FIXED 1080 x 1920 STAGE. Point the OBS browser source at exactly that
// size and every position here is the position you get. Anything else
// letterboxes rather than reflowing, which is the right trade for a
// graphic: a layout that rearranges itself mid-stream is worse than one
// that is the wrong size once, at setup.
//
// This file is now only the frame - the band the graphic lives in
// between the two cameras. The arrangement inside that band lives in
// layouts.tsx.

export const STAGE_W = 1080;
export const STAGE_H = 1920;
export const DEFAULT_LAYOUT: LayoutKey = "s1";

export function OverlayBoard({
  state,
  format,
  camTop,
  camBottom,
  layout = DEFAULT_LAYOUT,
}: {
  state: AuctionState;
  format: AuctionFormat;
  camTop: number;
  camBottom: number;
  layout?: LayoutKey;
}) {
  const bandHeight = STAGE_H - camTop - camBottom;
  const Layout = (LAYOUTS[layout] ?? LAYOUTS[DEFAULT_LAYOUT]).Component;

  return (
    <div style={{ width: STAGE_W, height: STAGE_H, position: "relative", overflow: "hidden" }}>
      {/* The band between the two cameras. Everything lives in here; the
          space above and below stays empty so the cams show through.
          CENTRED, not stretched - a layout takes the height it needs and
          the rest of the band stays clear, which is the whole point of
          making them short. */}
      <div
        // Marked so OverlayStage can measure it. Cropping the graphic out
        // of the stage means knowing how tall the graphic actually is,
        // and every layout is a different height - guessing produced a
        // band that cut "DEFENSE" off the bottom.
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
        }}
      >
        <Layout state={state} format={format} />
      </div>
    </div>
  );
}
