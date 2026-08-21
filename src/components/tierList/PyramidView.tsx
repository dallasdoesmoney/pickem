"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { DraggableTierItem } from "./TierItemChip";
import { TIER_LABEL_FONT, tierLabelSize } from "./tierLabel";
import { CAPS, PyramidShape, RANKED, ROW_OF, slotRect } from "./pyramid";

// The board's other layout. It renders inside the editor's own DndContext
// and reports drops through it, so every control on the page - clear,
// reset, share, save, undo - keeps working while it is on screen. What it
// does NOT do is write to the tier list: see pyramid.ts.

const SLOT_ID = (slot: number) => `pyr:${slot}`;
export const POOL_ID = "pyr:pool";

// A slot's drop target. Drawn, unlike a tier's, because a pyramid HAS
// capacity - sixteen places, and an empty one is a place you can still
// take. That is the opposite of a tier row, which has no capacity and so
// has nothing empty to show.
function Slot({
  slot,
  shape,
  accent,
  armed,
  onTap,
  children,
}: {
  slot: number;
  shape: PyramidShape;
  accent: string;
  armed: boolean;
  onTap: () => void;
  // The mark that holds this place, rendered INSIDE the target rather
  // than beside it. A tap on a team has to reach the place it is sitting
  // in - beside it, the click stopped at the mark and tap-to-place could
  // only ever fill an empty square.
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SLOT_ID(slot) });
  const { x, y, size } = slotRect(shape, slot);
  return (
    <div
      ref={setNodeRef}
      onClick={armed ? onTap : undefined}
      // Placed with left/top, NOT a transform. dnd-kit measures a
      // droppable with transforms stripped out, so sixteen slots offset by
      // translate() all reported the container's own rect - every drop
      // fell through to the nearest thing that wasn't transformed, which
      // was the cut.
      className="absolute rounded-xl transition-[background,box-shadow] duration-150"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        cursor: armed ? "pointer" : undefined,
        background: isOver ? `${accent}2e` : undefined,
        boxShadow: isOver
          ? `inset 0 0 0 2px ${accent}`
          : children
            ? undefined
            : `inset 0 0 0 1px ${accent}40`,
      }}
    >
      {children}
    </div>
  );
}

export function PyramidView({
  template,
  shape,
  bands,
  slots,
  missed,
  selectedId,
  landedId,
  poolHot,
  onItemActivate,
  onPlaceSlot,
  onPlacePool,
}: {
  template: TierTemplate;
  shape: PyramidShape;
  bands: { label: string; accent: string }[];
  slots: (string | null)[];
  missed: string[];
  selectedId: string | null;
  landedId: string | null;
  poolHot: boolean;
  onItemActivate: (item: TierItem) => void;
  onPlaceSlot: (slot: number) => void;
  onPlacePool: () => void;
}) {
  const { w, T, apex, chip, height, leftEdgeAt } = shape;
  const { setNodeRef: poolRef } = useDroppable({ id: POOL_ID });
  const armed = !!selectedId;

  // The bands fold in from full width when the view arrives - bottom row
  // first, so the base settles and the rows close above it. A rectangle
  // and a trapezoid are the same four points, so this interpolates
  // without anything reflowing to make the shape.
  //
  // Mounting IS arriving: the tier list is the default view, so this
  // component only ever appears because somebody switched to it.
  const bandsRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ease = "cubic-bezier(.65,0,.35,1)";
    bandsRef.current?.querySelectorAll<HTMLElement>("[data-band]").forEach((el) => {
      const row = Number(el.dataset.band);
      const now = getComputedStyle(el);
      const from = el.dataset.flatClip
        ? { clipPath: el.dataset.flatClip }
        : { transform: el.dataset.flatTransform! };
      const to = el.dataset.flatClip ? { clipPath: now.clipPath } : { transform: now.transform };
      el.animate([from, to], {
        duration: 720,
        delay: (CAPS.length - 1 - row) * 80,
        easing: ease,
        fill: "backwards",
      });
    });
    // The silhouette can't fold with them - SVG points are not animatable
    // - and drawn at its final shape from the first frame it reads as two
    // diagonals slashing across a board that is still square. So it
    // arrives once the shape it outlines has finished forming.
    edgeRef.current?.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], {
      duration: 1000,
      easing: ease,
      fill: "backwards",
    });
  }, []);

  return (
    <>
      <div ref={bandsRef} className="relative mx-auto" style={{ width: w, height }}>
        {CAPS.map((_, row) => {
          const band = bands[row];
          const a = leftEdgeAt(row * shape.rowH);
          const b = leftEdgeAt((row + 1) * shape.rowH);
          return (
            <div
              key={row}
              data-band={row}
              data-flat-clip={`polygon(0px 0%, ${w}px 0%, ${w}px 100%, 0px 100%)`}
              className="absolute left-0 overflow-hidden"
              style={{
                top: row * shape.rowH,
                width: w,
                height: shape.rowH,
                background: "#000000",
                borderTop: row === 0 ? undefined : "1px solid rgba(255,255,255,0.09)",
                // A rectangle and a trapezoid are the same four points, so
                // the row keeps its full width in the DOM and only its
                // silhouette changes - nothing reflows to make the shape.
                clipPath: `polygon(${a}px 0%, ${w - a}px 0%, ${w - b}px 100%, ${b}px 100%)`,
              }}
            >
              <span
                aria-hidden
                data-band={row}
                data-flat-clip={`polygon(0px 0%, ${T}px 0%, ${T}px 100%, 0px 100%)`}
                className="absolute inset-0"
                style={{
                  background: band.accent,
                  clipPath: `polygon(${a}px 0%, ${a + T}px 0%, ${b + T}px 100%, ${b}px 100%)`,
                }}
              >
                {/* Inside the band, so the band's own clip cuts it: the
                    band is a parallelogram, and a name tall enough to wrap
                    reaches past its slanted edges. */}
                <span
                  data-band={row}
                  data-flat-transform={`translate(${T / 2}px, -50%) translateX(-50%)`}
                  className="absolute top-1/2 text-center leading-[1.18] break-words uppercase"
                  style={{
                    ...TIER_LABEL_FONT,
                    left: 0,
                    width: T - 12,
                    transform: `translate(${leftEdgeAt(row * shape.rowH + shape.rowH / 2) + T / 2}px, -50%) translateX(-50%)`,
                    fontSize: tierLabelSize(band.label, T - 12, chip + 20, 3),
                  }}
                >
                  {band.label}
                </span>
              </span>
            </div>
          );
        })}

        {/* The silhouette. Pure black on this ground has almost no
            contrast, so without it the shape has no visible boundary at
            all. Both slopes are straight lines from the apex to the base,
            so the whole outline is four points. */}
        <svg ref={edgeRef} aria-hidden className="pointer-events-none absolute left-0 top-0" width={w} height={height}>
          <polygon
            points={`${(w - apex) / 2},0 ${(w + apex) / 2},0 ${w},${height} 0,${height}`}
            fill="none"
            stroke="rgba(255,255,255,0.17)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>

        {Array.from({ length: RANKED }, (_, slot) => {
          const id = slots[slot];
          return (
            <Slot
              key={slot}
              slot={slot}
              shape={shape}
              accent={bands[ROW_OF[slot]].accent}
              armed={armed}
              onTap={() => onPlaceSlot(slot)}
            >
              {id && (
                <DraggableTierItem
                  item={resolveItem(template, id)}
                  style={template.itemStyle}
                  size={chip}
                  selected={selectedId === id}
                  landed={landedId === id}
                  onActivate={() => onItemActivate(resolveItem(template, id))}
                />
              )}
            </Slot>
          );
        })}
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h2 className="text-sm text-white/70 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            MISSED THE CUT <span className="text-white/35">({missed.length})</span>
          </h2>
        </div>
        <div
          ref={poolRef}
          onClick={armed ? onPlacePool : undefined}
          className="rounded-2xl border p-2.5 flex flex-wrap gap-1.5 content-start transition-[background,border-color,box-shadow] duration-150"
          style={{
            minHeight: chip + 20,
            borderColor: poolHot ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)",
            background: poolHot ? "#141414" : "#000000",
            boxShadow: poolHot
              ? "0 0 0 2px rgba(255,255,255,0.5), 0 10px 30px -12px rgba(0,0,0,0.9)"
              : undefined,
            cursor: armed ? "pointer" : undefined,
          }}
        >
          {missed.map((id) => (
            <DraggableTierItem
              key={id}
              item={resolveItem(template, id)}
              style={template.itemStyle}
              size={chip}
              selected={selectedId === id}
              landed={landedId === id}
              onActivate={() => onItemActivate(resolveItem(template, id))}
            />
          ))}
          {missed.length === 0 && (
            <span className="self-center text-[11px] tracking-wide text-white/30 px-1">
              EVERY {template.itemNoun[0].toUpperCase()} MADE THE CUT
            </span>
          )}
        </div>
      </section>
    </>
  );
}

