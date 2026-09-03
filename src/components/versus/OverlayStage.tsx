"use client";

import { useEffect, useRef, useState } from "react";
import type { AuctionFormat } from "@/lib/auction/format";
import type { AuctionState } from "@/lib/auction/engine";
import { OverlayBoard, STAGE_W, STAGE_H, DEFAULT_LAYOUT } from "./OverlayBoard";
import { type LayoutKey } from "./layouts";
import { DEFAULT_TURN, type TurnKey } from "./turnIdeas";

// THE MIRROR. The exact graphic OBS is drawing, on the page you play on.
//
// Not a second rendering of the game that happens to look similar - the
// same component, from the same state, at the same 1080 x 1920, scaled.
// Anything that changes about the overlay shows up here without anybody
// remembering to change it twice, which is the entire point: the two
// screens cannot drift if there is only one of them.
//
// TWO MODES, and the difference matters more than it sounds:
//
//   "stage" is the whole 1080 x 1920 browser source, cameras and all.
//           For judging an OBS setup - where the bands fall, how much
//           room the graphic has between them.
//
//   "band"  is only the strip the graphic actually occupies. For PLAYING
//           on. The stage mode on a web page is mostly two empty
//           rectangles where somebody's face would be, which squeezed the
//           graphic into a thin line in the middle and made the whole
//           thing look like a postage stamp on a card. Cropping to the
//           band gives the graphic the entire width of the page.
export type StageMode = "stage" | "band";

export function OverlayStage({
  state,
  format,
  camTop = 560,
  camBottom = 560,
  mode = "stage",
  showCamBands = true,
  layout = DEFAULT_LAYOUT,
  turn = DEFAULT_TURN,
}: {
  state: AuctionState;
  format: AuctionFormat;
  camTop?: number;
  camBottom?: number;
  mode?: StageMode;
  showCamBands?: boolean;
  layout?: LayoutKey;
  turn?: TurnKey;
}) {
  // Measured rather than assumed, so this is right on a phone and on a
  // desktop without a breakpoint deciding for it.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // In band mode the cameras are irrelevant - there are none - so the
  // graphic is centred in the full stage and then cropped to whatever it
  // measured. Measuring rather than assuming, because every layout is a
  // different height and the guess cut the bottom row off.
  const inner = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(0);
  useEffect(() => {
    const el = inner.current?.querySelector<HTMLElement>("[data-band]");
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // offsetHeight is pre-transform, so this is in stage pixels
      // whatever the scale happens to be.
      const kids = Array.from(el.children) as HTMLElement[];
      if (kids.length === 0) return;
      const top = Math.min(...kids.map((k) => k.offsetTop));
      const bottom = Math.max(...kids.map((k) => k.offsetTop + k.offsetHeight));
      setContent(bottom - top);
    });
    ro.observe(el);
    for (const k of Array.from(el.children)) ro.observe(k);
    return () => ro.disconnect();
  }, [width, state, layout, format]);

  const scale = width / STAGE_W;
  const band = mode === "band";
  const PAD = 46;
  const bandTop = band ? camTop : 0;
  const bandBottom = band ? camBottom : 0;
  const visibleHeight = band ? (content > 0 ? content + PAD * 2 : STAGE_H - bandTop - bandBottom) : STAGE_H;
  // Where the graphic starts, given OverlayBoard centres it in its band.
  const cropTop = band
    ? content > 0
      ? bandTop + (STAGE_H - bandTop - bandBottom - content) / 2 - PAD
      : bandTop
    : 0;

  return (
    <div
      ref={box}
      style={{
        width: "100%",
        height: width ? visibleHeight * scale : 0,
        position: "relative",
        overflow: "hidden",
        // NO GROUND OF ITS OWN in band mode. The overlay is transparent;
        // painting a rectangle behind it here put a second background on
        // the page underneath a third one on the card around it, and the
        // graphic ended up looking like a screenshot of itself.
        background: band ? "transparent" : "#070e1c",
        borderRadius: band ? 0 : 14,
      }}
    >
      <div ref={inner} style={{ display: "contents" }}>
      {width > 0 && (
        // `relative` matters: the cam guides below are absolute, and
        // without a positioned ancestor here they lay themselves out
        // against the little unscaled box instead of the 1080x1920 stage
        // - a 560px band inside a 675px box, covering half the mirror.
        //
        // The negative top is the crop: it lifts the stage so the top of
        // the band sits at the top of the box.
        <div
          style={{
            position: "absolute",
            top: band ? -cropTop * scale : 0,
            left: 0,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {!band && showCamBands && (
            // Where the cams go. Faint, and only on this screen - the
            // stream sees straight through those bands.
            <div aria-hidden style={{ position: "absolute", inset: 0 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: STAGE_W, height: camTop, background: "rgba(255,255,255,0.035)" }} />
              <div style={{ position: "absolute", top: STAGE_H - camBottom, left: 0, width: STAGE_W, height: camBottom, background: "rgba(255,255,255,0.035)" }} />
            </div>
          )}
          <OverlayBoard state={state} format={format} camTop={camTop} camBottom={camBottom} layout={layout} turn={turn} />
        </div>
      )}
      </div>
    </div>
  );
}
