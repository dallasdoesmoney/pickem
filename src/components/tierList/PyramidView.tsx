"use client";

import { useDroppable } from "@dnd-kit/core";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { MAX_TIER_LABEL } from "@/lib/tierList";
import { DraggableTierItem } from "./TierItemChip";
import { TIER_LABEL_FONT, pickTierLabelSize } from "./tierLabel";
import {
  MAX_PYRAMID_ROWS,
  MIN_PYRAMID_ROWS,
  PyramidBand,
  PyramidShape,
  canBump,
  rankedIn,
  rowClip,
  rowsOf,
  silhouettePoints,
  slotRect,
} from "./pyramid";

// The width kept clear down the right for a row's own minus and plus.
// Reserved rather than borrowed, because there is no dead space inside
// the shape to put them in: a row's teams run right up to both slopes,
// and on a diamond they do it at the bottom as well as the top.
//
// It is pinned to the BOARD's right edge, not the shape's. The shape's
// width changes every time a row does, so buttons parked beside it slid
// left and right under your finger - you had to find the button again
// after every press. Against the board they do not move at all.
export const ROW_CTL_W = 52;

// The spacing under a board before its add/remove pair, shared so the
// tier list and the pyramid sit the buttons at the same distance.
export const ROW_BUTTON_GAP = "mt-2";

// The board's other layout. It renders inside the editor's own DndContext
// and reports drops through it, so every control on the page - clear,
// reset, share, save, undo - keeps working while it is on screen. What it
// does NOT do is write to the tier list: see pyramid.ts.

const SLOT_ID = (slot: number) => `pyr:${slot}`;
export const POOL_ID = "pyr:pool";

// A slot's drop target. Drawn, unlike a tier's, because a pyramid HAS
// capacity - a fixed number of places, and an empty one is a place you
// can still take. That is the opposite of a tier row, which has no
// capacity and so has nothing empty to show.
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

// A row's own minus and plus, parked in a fixed column down the right of
// the board. Minus and plus walk the row between three states: the same
// as the row above, two more, two fewer.
function RowStepper({
  caps,
  row,
  onBump,
}: {
  caps: readonly number[];
  row: number;
  onBump: (by: 1 | -1) => void;
}) {
  const btn =
    "h-[24px] w-[24px] rounded-full text-[15px] leading-none text-white/65 transition-colors " +
    "enabled:hover:bg-white/12 enabled:hover:text-white disabled:opacity-25";
  // The top row moves by one and every other row by two - see pyramid.ts.
  const jump = row === 0 ? "one" : "two";
  return (
    <span className="flex items-center rounded-full border border-white/15 bg-black/70 p-px backdrop-blur-[2px]">
      <button
        type="button"
        aria-label={`${jump === "one" ? "One" : "Two"} fewer places in this row`}
        disabled={!canBump(caps, row, -1)}
        onClick={() => onBump(-1)}
        className={btn}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`${jump === "one" ? "One" : "Two"} more places in this row`}
        disabled={!canBump(caps, row, 1)}
        onClick={() => onBump(1)}
        className={btn}
      >
        +
      </button>
    </span>
  );
}

// The pair under the board. Exported because the tier list wants the
// same two, so adding a row is the same gesture in either layout.
export function RowButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-dashed border-white/20 px-4 py-1.5 text-[10px] tracking-[0.1em] text-white/45 transition-colors enabled:hover:border-emerald-400/60 enabled:hover:text-emerald-300 disabled:opacity-35"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {label}
    </button>
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
  onBumpRow,
  onAddRow,
  onRemoveRow,
  editing,
  onRename,
  onCommitRename,
  onActivateBand,
  frameWidth,
  swap,
}: {
  template: TierTemplate;
  shape: PyramidShape;
  bands: PyramidBand[];
  slots: (string | null)[];
  missed: string[];
  selectedId: string | null;
  landedId: string | null;
  poolHot: boolean;
  onItemActivate: (item: TierItem) => void;
  onPlaceSlot: (slot: number) => void;
  onPlacePool: () => void;
  // Absent on a shared snapshot, which is somebody else's board.
  onBumpRow?: (row: number, by: 1 | -1) => void;
  onAddRow?: () => void;
  onRemoveRow?: () => void;
  // EDIT TIERS, without leaving the pyramid.
  editing?: boolean;
  onRename?: (tierId: string, label: string) => void;
  onCommitRename?: () => void;
  onActivateBand?: (tierId: string) => void;
  // The board's full width. The shape is only as wide as its widest row,
  // so this is what the row buttons are pinned to.
  frameWidth?: number;
  // A trade that just happened: the team now sitting in `to` came from
  // `from`, and slides across from it so the exchange is something you
  // watch rather than something you notice afterwards. The token re-arms
  // it when the same two places trade twice in a row.
  swap?: { from: number; to: number; token: number } | null;
}) {
  const { w, T, chip, height, leftEdgeAt } = shape;
  const rowOf = rowsOf(shape.caps);
  const gutter = onBumpRow ? ROW_CTL_W : 0;
  const frame = Math.max(w + gutter, frameWidth ?? w + gutter);
  const shapeLeft = Math.max(0, (frame - gutter - w) / 2);
  const { setNodeRef: poolRef } = useDroppable({ id: POOL_ID });
  const armed = !!selectedId;

  return (
    <>
      {/* The frame is the BOARD's width and never changes; the shape sits
          centred inside what the button column leaves. Sizing the frame
          to the shape instead made the whole thing shuffle sideways every
          time a row changed. */}
      <div
        className="relative mx-auto"
        style={{ width: frame, height }}
      >
      <div className="absolute top-0" style={{ left: shapeLeft, width: w, height }}>
        {shape.caps.map((_, row) => {
          const band = bands[row];
          const clip = rowClip(shape, row);
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
                // A rectangle and any six-point shape are the same six
                // points, so the row keeps its full width in the DOM and
                // only its silhouette changes - nothing reflows to make
                // the shape, and the two ends still interpolate when the
                // board folds.
                clipPath: clip.row,
              }}
            >
              <span
                aria-hidden
                data-pband
                className="absolute inset-0"
                style={{ background: band.accent, clipPath: clip.band }}
              >
                {/* Inside the band, so the band's own clip cuts it: the
                    band is a parallelogram, and a name tall enough to wrap
                    reaches past its slanted edges. */}
                {editing && band.id && onRename ? (
                  // Renamed where it sits, so EDIT TIERS does not have to
                  // throw you back to the tier list to change a name. Same
                  // font, same box, same clip as the label it replaces -
                  // the only difference is that you can type in it.
                  //
                  // UNCONTROLLED, seeded from the tier's raw label, which
                  // is exactly what the tier list's own field does and is
                  // the whole bug that was here. Bound to `band.label`
                  // instead, every keystroke round-tripped through
                  // tierLabelFor - `label.trim() || "TIER n"` - so
                  // emptying the box refilled it with "TIER 1" and a
                  // space on the end was trimmed off before it could be
                  // typed. The DOM holds the text; React only reads it.
                  <textarea
                    data-plabel
                    defaultValue={band.raw}
                    onChange={(e) => onRename(band.id!, e.target.value)}
                    onFocus={(e) => {
                      onActivateBand?.(band.id!);
                      const end = e.currentTarget.value.length;
                      e.currentTarget.setSelectionRange(end, end);
                    }}
                    onKeyDown={(e) => {
                      // A tier name is one line of text however many
                      // lines it wraps to, so Enter commits rather than
                      // inserting a break - same as the tier list.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                        onCommitRename?.();
                      }
                      if (e.key === "Escape") e.currentTarget.blur();
                    }}
                    rows={1}
                    maxLength={MAX_TIER_LABEL}
                    spellCheck={false}
                    aria-label="Rename this tier"
                    className="absolute top-1/2 resize-none overflow-hidden bg-transparent text-center leading-[1.18] uppercase outline-none rounded-[3px] ring-1 ring-dashed ring-black/25 focus:ring-black/60 [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
                    style={{
                      ...TIER_LABEL_FONT,
                      left: 0,
                      width: T - 12,
                      transform: `translate(${leftEdgeAt(row * shape.rowH + shape.rowH / 2) + T / 2}px, -50%) translateX(-50%)`,
                      // Sized off what is READ, not what is stored, so an
                      // empty box keeps the size "TIER 1" will be drawn at
                      // rather than jumping when the first letter lands.
                      fontSize: pickTierLabelSize(band.label, true),
                      caretColor: TIER_LABEL_FONT.color,
                    }}
                  />
                ) : (
                  <span
                    data-plabel
                    className="absolute top-1/2 text-center leading-[1.18] uppercase [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
                    style={{
                      ...TIER_LABEL_FONT,
                      left: 0,
                      width: T - 12,
                      transform: `translate(${leftEdgeAt(row * shape.rowH + shape.rowH / 2) + T / 2}px, -50%) translateX(-50%)`,
                      fontSize: pickTierLabelSize(band.label, true),
                    }}
                  >
                    {band.label}
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {/* The silhouette. Pure black on this ground has almost no
            contrast, so without it the shape has no visible boundary at
            all. One point per seam, plus one halfway down any row that
            turns - which is what puts the point on a diamond. */}
        <svg data-pedge aria-hidden className="pointer-events-none absolute left-0 top-0" width={w} height={height}>
          <polygon
            points={silhouettePoints(shape)}
            fill="none"
            stroke="rgba(255,255,255,0.17)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>

        {Array.from({ length: rankedIn(shape.caps) }, (_, slot) => {
          const id = slots[slot];
          // The displaced team starts drawn at the place it came from and
          // runs home. The offset is arithmetic, not a measurement: both
          // squares' rects come straight out of the shape, so there is
          // nothing to read off the DOM and nothing to get wrong on the
          // frame the board happens to re-render.
          const travelling = swap && swap.to === slot;
          const glide = travelling
            ? (() => {
                const here = slotRect(shape, swap.to);
                const there = slotRect(shape, swap.from);
                return { dx: there.x - here.x, dy: there.y - here.y };
              })()
            : null;
          return (
            <Slot
              key={slot}
              slot={slot}
              shape={shape}
              accent={bands[rowOf[slot]].accent}
              armed={armed}
              onTap={() => onPlaceSlot(slot)}
            >
              {id &&
                (() => {
                  const mark = (
                    <DraggableTierItem
                      item={resolveItem(template, id)}
                      style={template.itemStyle}
                      size={chip}
                      selected={selectedId === id}
                      landed={landedId === id}
                      onActivate={() => onItemActivate(resolveItem(template, id))}
                    />
                  );
                  // Wrapped ONLY while it is travelling. A slot centres
                  // nothing - the mark is the slot's only child and sized
                  // to it - so a wrapper left in place the rest of the
                  // time would put the mark in a line box and nudge it
                  // down by the leading.
                  if (!glide) return mark;
                  return (
                    <span
                      // Keyed on the token so re-swapping the same pair
                      // restarts the run rather than the browser deciding
                      // this animation has already been played.
                      key={`swap-${swap!.token}`}
                      className="tier-anim-swap"
                      style={
                        { ["--swap-dx"]: `${glide.dx}px`, ["--swap-dy"]: `${glide.dy}px` } as React.CSSProperties
                      }
                    >
                      {mark}
                    </span>
                  );
                })()}
            </Slot>
          );
        })}

      </div>

        {onBumpRow &&
          shape.caps.map((_, row) => (
            <div
              key={`ctl-${row}`}
              className="absolute"
              style={{ left: frame - ROW_CTL_W, top: row * shape.rowH + (shape.rowH - 24) / 2 }}
            >
              <RowStepper caps={shape.caps} row={row} onBump={(by) => onBumpRow(row, by)} />
            </div>
          ))}
      </div>

      {(onAddRow || onRemoveRow) && (
        <div className={`flex justify-center gap-2 ${ROW_BUTTON_GAP}`}>
          {onRemoveRow && (
            <RowButton
              onClick={onRemoveRow}
              disabled={shape.caps.length <= MIN_PYRAMID_ROWS}
              label="− REMOVE ROW"
            />
          )}
          {onAddRow && (
            <RowButton
              onClick={onAddRow}
              disabled={shape.caps.length >= MAX_PYRAMID_ROWS}
              label="+ ADD ROW"
            />
          )}
        </div>
      )}

      <section className="mt-6">
        {/* Same seam, same mark - the pyramid's cut is the tier list's
            pool wearing a different name, and a logo that showed up in one
            view but not the other would read as a bug when you toggle.
            The empty span balances the heading so the mark sits centred
            on the row rather than centred on what is left of it. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-2 px-0.5 min-h-[56px]">
          <h2 className="shrink-0 whitespace-nowrap text-sm text-white/70 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            MISSED THE CUT <span className="text-white/35">({missed.length})</span>
          </h2>
          <img
              src="/header-logo.png"
              alt=""
              aria-hidden
              draggable={false}
            // 56 where there is room for it, 32 on a phone: at 56 the mark,
          // the heading and the shuffle do not all fit a 358px row, and
          // what gives way is the heading - "UNRANKED" on one line and
          // "(3)" on the next.
          className="h-[32px] sm:h-[56px] w-auto max-w-full justify-self-center select-none"
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

