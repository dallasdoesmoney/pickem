"use client";

import { useEffect, useRef, useState } from "react";
import type { WavelengthState } from "@/lib/wavelength/engine";
import { OverlayBoard, STAGE_W, STAGE_H } from "./OverlayBoard";

// THE MIRROR, same idea as the draft's: the exact graphic OBS is drawing,
// on the page you play on. Not a second rendering that happens to look
// similar - the same component, from the same state, at the same
// 1080 x 1920, scaled down and cropped to the strip it occupies.
//
// Cropping rather than showing the whole stage, because the stage is
// mostly two empty rectangles where somebody's face goes, and squeezing
// the graphic into the middle third of a phone screen makes it unreadable
// on the one device it is being played on.
//
// The height is MEASURED rather than assumed. The graphic grows and
// shrinks with the clue, the headline and the steal line, and a guessed
// crop cut the bottom line off.
export function WaveStage({
  state,
  // The mirror is not a picture of the graphic, it is the graphic - so
  // the dial you drag is the one on the stream, not a second control
  // beside it. The lid needs no prop: it is part of the game now.
  onScrub,
  // HOW TALL IT IS ALLOWED TO GET, and it needs a ceiling: scaled purely
  // to the width, a 900px-wide column drew the graphic 750px tall and the
  // controls under it were below the fold on a laptop - the game was
  // unplayable without scrolling to reach the buttons. Above this the
  // graphic stops growing and centres instead.
  maxHeight = 430,
}: {
  state: WavelengthState;
  onScrub?: (value: number) => void;
  maxHeight?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [content, setContent] = useState(0);

  // Everything about the state that can change how TALL the graphic is.
  // Deliberately not the guess: see the measuring effect below.
  const layoutKey = [
    state.round,
    state.card.id,
    state.phase,
    state.clue,
    state.scored ? `${state.scored.band}-${state.scored.stolen}` : "",
    state.peek,
    state.teams.map((t) => `${t.name}:${t.score}`).join(","),
  ].join("|");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = inner.current?.querySelector<HTMLElement>("[data-band]");
    if (!el) return;
    const measure = () => {
      // offsetTop/offsetHeight are pre-transform, so these are stage
      // pixels whatever the scale happens to be.
      // offsetTop/offsetHeight exist on HTMLElement only. Anything else
      // in the band - a bare <svg>, say - answers undefined, and one
      // undefined turns the whole measurement into NaN. Skipping them
      // rather than trusting them means a mis-built band crops slightly
      // wrong instead of falling back to the entire empty 1920 stage.
      const kids = (Array.from(el.children) as HTMLElement[]).filter((k) => Number.isFinite(k.offsetHeight));
      if (kids.length === 0) return;
      const top = Math.min(...kids.map((k) => k.offsetTop));
      const bottom = Math.max(...kids.map((k) => k.offsetTop + k.offsetHeight));
      setContent(bottom - top);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const k of Array.from(el.children)) ro.observe(k);
    return () => ro.disconnect();
    // KEYED ON WHAT CHANGES THE LAYOUT, not on the whole state. The guess
    // changes on every pointer move while somebody is dragging the needle,
    // and with `state` in here that tore down the observer, rebuilt it,
    // re-observed six children and forced a synchronous re-measure of the
    // whole 1080x1920 tree - sixty-two times in one drag, measured. The
    // needle lives inside a fixed-size SVG and moves nothing, so it has no
    // business in this dependency list.
  }, [width, layoutKey]);

  // No cameras on a web page, so the graphic centres in the whole stage
  // and gets cropped to whatever it measured, with a little air around it.
  const PAD = 24;
  const cropped = content > 0 ? content + PAD * 2 : STAGE_H;
  // Whichever runs out first, the width of the column or the height it is
  // allowed. Then centred in whatever width is left over, so a capped
  // graphic sits in the middle of the page rather than off to one side.
  const scale = Math.min(width / STAGE_W, maxHeight / cropped);
  const cropTop = content > 0 ? (STAGE_H - content) / 2 - PAD : 0;
  const drawn = STAGE_W * scale;

  return (
    <div ref={box} style={{ width: "100%", height: width ? cropped * scale : 0, position: "relative", overflow: "hidden" }}>
      <div ref={inner} style={{ display: "contents" }}>
        {width > 0 && (
          <div
            style={{
              position: "absolute",
              top: -cropTop * scale,
              left: (width - drawn) / 2,
              width: STAGE_W,
              height: STAGE_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <OverlayBoard state={state} camTop={0} camBottom={0} onScrub={onScrub} />
          </div>
        )}
      </div>
    </div>
  );
}
