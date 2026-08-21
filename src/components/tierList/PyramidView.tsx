"use client";

import { useDroppable } from "@dnd-kit/core";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { DraggableTierItem } from "./TierItemChip";
import { TIER_LABEL_FONT, pickTierLabelSize } from "./tierLabel";
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

  return (
    <>
      <div className="relative mx-auto" style={{ width: w, height }}>
        {CAPS.map((_, row) => {
          const band = bands[row];
          const a = leftEdgeAt(row * shape.rowH);
          const b = leftEdgeAt((row + 1) * shape.rowH);
          return (
            <div
              key={row}
              data-prow={row}
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
                data-pband
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
                  data-plabel
                  className="absolute top-1/2 text-center leading-[1.18] uppercase [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
                  style={{
                    ...TIER_LABEL_FONT,
                    left: 0,
                    width: T - 12,
                    transform: `translate(${leftEdgeAt(row * shape.rowH + shape.rowH / 2) + T / 2}px, -50%) translateX(-50%)`,
                    fontSize: pickTierLabelSize(band.label),
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
        <svg data-pedge aria-hidden className="pointer-events-none absolute left-0 top-0" width={w} height={height}>
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
        {/* Same seam, same mark - the pyramid's cut is the tier list's
            pool wearing a different name, and a logo that showed up in one
            view but not the other would read as a bug when you toggle.
            The empty span balances the heading so the mark sits centred
            on the row rather than centred on what is left of it. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-2 px-0.5 min-h-[44px]">
          <h2 className="shrink-0 whitespace-nowrap text-sm text-white/70 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            MISSED THE CUT <span className="text-white/35">({missed.length})</span>
          </h2>
          <img
              src="/header-logo.png"
              alt=""
              aria-hidden
              draggable={false}
            // 44 where there is room for it, 28 on a phone: at 44 the mark,
          // the heading and the shuffle do not all fit a 358px row, and
          // what gives way is the heading - "UNRANKED" on one line and
          // "(3)" on the next.
          className="h-[28px] sm:h-[44px] w-auto max-w-full justify-self-center select-none"
          />
          <span aria-hidden />
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

