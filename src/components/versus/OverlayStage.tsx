"use client";

import { useEffect, useRef, useState } from "react";
import type { AuctionFormat } from "@/lib/auction/format";
import type { AuctionState } from "@/lib/auction/engine";
import { OverlayBoard, STAGE_W, STAGE_H } from "./OverlayBoard";

// THE MIRROR. The exact graphic OBS is drawing, shrunk to fit on the page
// you are playing on.
//
// Not a second rendering of the game that happens to look similar - the
// same component, from the same state, at the same 1080 x 1920, scaled.
// Anything that changes about the overlay shows up here without anybody
// remembering to change it twice, which is the entire point: the two
// screens cannot drift if there is only one of them.

export function OverlayStage({
  state,
  format,
  camTop = 560,
  camBottom = 560,
  showCamBands = true,
}: {
  state: AuctionState;
  format: AuctionFormat;
  camTop?: number;
  camBottom?: number;
  showCamBands?: boolean;
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

  const scale = width / STAGE_W;

  return (
    <div ref={box} style={{ width: "100%", height: width ? STAGE_H * scale : 0, position: "relative", overflow: "hidden", borderRadius: 14, background: "#070e1c" }}>
      {width > 0 && (
        // `relative` matters: the cam guides below are absolute, and
        // without a positioned ancestor here they lay themselves out
        // against the little unscaled box instead of the 1080x1920 stage
        // - a 560px band inside a 675px box, covering half the mirror.
        <div style={{ position: "relative", width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {showCamBands && (
            // Where the cams go. Faint, and only on this screen - the
            // stream sees straight through those bands.
            <div aria-hidden style={{ position: "absolute", inset: 0 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: STAGE_W, height: camTop, background: "rgba(255,255,255,0.035)" }} />
              <div style={{ position: "absolute", top: STAGE_H - camBottom, left: 0, width: STAGE_W, height: camBottom, background: "rgba(255,255,255,0.035)" }} />
            </div>
          )}
          <OverlayBoard state={state} format={format} camTop={camTop} camBottom={camBottom} />
        </div>
      )}
    </div>
  );
}
