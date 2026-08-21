"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TierItem, TierTemplate } from "@/data/tierTemplates";
import { createInitialState } from "@/lib/tierList";
import { TierItemChip } from "./TierItemChip";

// The pyramid: sixteen ranked in four rows, everything else below a cut
// line. 1 + 3 + 5 + 7 is the only four-row triangle that lands on exactly
// sixteen, so the shape IS the rule - there is no separate "top 16"
// setting that could disagree with the rows on screen.
//
// Everything about how this is DRAWN is the tier board's, not this
// file's: one black surface with a rounded border and clipped corners,
// rows butted straight into each other with a hairline between, the
// chevron rail on the left, the same chip solver, the same pool
// underneath. The only thing that differs is where the marks sit - each
// row is capped at its tier's capacity and ends at its last slot, so the
// rows themselves step out into the triangle.
export const CAPS = [1, 3, 5, 7] as const;
export const RANKED = CAPS.reduce((a, b) => a + b, 0);
const LABELS = ["S", "A", "B", "C"] as const;

const storageKey = (slug: string) => `pickem:pyramid:${slug}`;

function readSlots(slug: string, valid: Set<string>): (string | null)[] {
  const empty = Array<string | null>(RANKED).fill(null);
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return empty;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return empty;
    const seen = new Set<string>();
    return empty.map((_, i) => {
      const id = saved[i];
      // Drop anything that isn't a real item of this template, and never
      // let one id hold two slots - a stale or hand-edited value must not
      // be able to duplicate a mark.
      if (typeof id !== "string" || !valid.has(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  } catch {
    return empty;
  }
}

// The shape, solved from the width available.
//
// Every proportion is a fraction of the base, so the triangle looks
// identical at any size and only the marks change:
//
//   T    - the colour band's thickness, measured horizontally
//   top  - the flat width at the apex
//
// `top` is not a style choice. A band thick enough to carry its own
// letter needs T + chip + padding of clear width at the apex row's mid
// height, and on a straight slope that height is only an eighth of the
// base. Solving it gives top >= 0.1 * w; below that the triangle would
// have to get dramatically wider to keep the same band.
const BAND_FRACTION = 0.12;
const TIP_FRACTION = 0.1375;

function solveShape(viewportWidth: number) {
  const w = Math.min(viewportWidth, 1056) - 32;
  const T = Math.round(w * BAND_FRACTION);
  const top = Math.round(w * TIP_FRACTION);
  // The base row binds: seven marks have to sit between the band and the
  // right-hand slope, and at that height the slope has taken 0.108w off
  // each side. Working it through leaves the marks 0.664w, which at ~7.8
  // mark-widths across is 0.085w each. 0.082 keeps a little slack.
  const chipSize = Math.max(22, Math.min(80, Math.floor(w * 0.082)));
  const gap = Math.max(4, Math.round(chipSize * 0.13));
  const rowH = chipSize + 24;
  const H = rowH * CAPS.length;
  // Where the triangle's left edge sits at height Y. Every band corner
  // comes out of this, so the two edges are parallel by construction
  // rather than by arithmetic that could drift.
  const leftEdgeAt = (Y: number) => ((w - top) / 2) * (1 - Y / H);
  return { w, T, top, chipSize, gap, rowH, H, leftEdgeAt };
}

// --------------------------------------------------------------- pieces

function Draggable({
  item,
  style,
  size,
  selected,
  onActivate,
}: {
  item: TierItem;
  style?: TierTemplate["itemStyle"];
  size: number;
  selected: boolean;
  onActivate: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: "none", opacity: isDragging ? 0.25 : 1 }}
    >
      <TierItemChip item={item} style={style} size={size} selected={selected} onActivate={onActivate} />
    </div>
  );
}

// An empty slot is the drop target, so the triangle keeps its shape on a
// board nobody has finished and the gaps say where things go. Sized and
// cornered like a chip, so a filled row and an empty one are the same
// grid.
function Slot({
  index,
  size,
  accent,
  armed,
  children,
  onTap,
}: {
  index: number;
  size: number;
  accent: string;
  armed: boolean;
  children?: React.ReactNode;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${index}` });
  const empty = !children;
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className="grid shrink-0 place-items-center rounded-xl transition-[background,box-shadow] duration-150"
      style={{
        width: size,
        height: size,
        cursor: armed ? "pointer" : undefined,
        background: isOver ? `${accent}2e` : empty ? "rgba(255,255,255,0.04)" : undefined,
        boxShadow: isOver
          ? `inset 0 0 0 2px ${accent}`
          : empty
            ? `inset 0 0 0 1px ${armed ? `${accent}88` : "rgba(255,255,255,0.09)"}`
            : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- board

export function PyramidBoard({ template }: { template: TierTemplate }) {
  const byId = useMemo(() => new Map(template.items.map((i) => [i.id, i])), [template]);
  const validIds = useMemo(() => new Set(template.items.map((i) => i.id)), [template]);

  // Accents come from the engine's own default tiers rather than a copy,
  // so retuning the palette in levels.ts moves this with it.
  const accents = useMemo(
    () => createInitialState(template).tiers.slice(0, CAPS.length).map((t) => t.accent),
    [template],
  );

  const [slots, setSlots] = useState<(string | null)[]>(() => Array<string | null>(RANKED).fill(null));
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(390);

  useEffect(() => {
    const measure = () => setViewportWidth(window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Read after mount, never during render: the server has no local
  // storage and seeding from it directly tears on hydration.
  useEffect(() => {
    setSlots(readSlots(template.slug, validIds));
    setLoaded(true);
    setSelected(null);
  }, [template.slug, validIds]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(template.slug), JSON.stringify(slots));
    } catch {
      /* private mode - the board works, it just won't survive a reload */
    }
  }, [slots, loaded, template.slug]);

  const placed = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const pool = useMemo(() => template.items.filter((i) => !placed.has(i.id)), [template.items, placed]);

  // Put an item in a slot. Whatever was there goes back to the pool -
  // unless the item came from another slot, in which case the two trade
  // places, which is what a drag onto an occupied slot obviously means.
  const place = useCallback((itemId: string, slot: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const from = prev.indexOf(itemId);
      const evicted = next[slot];
      next[slot] = itemId;
      if (from >= 0 && from !== slot) next[from] = evicted ?? null;
      return next;
    });
    setSelected(null);
  }, []);

  const toPool = useCallback((itemId: string) => {
    setSlots((prev) => prev.map((id) => (id === itemId ? null : id)));
    setSelected(null);
  }, []);

  const clear = useCallback(() => {
    setSlots(Array<string | null>(RANKED).fill(null));
    setSelected(null);
  }, []);

  // Fills the sixteen from the pool in order - a fast way to get a full
  // board to look at without dragging sixteen things.
  const fill = useCallback(() => {
    setSlots((prev) => {
      const next = [...prev];
      const taken = new Set(next.filter(Boolean) as string[]);
      const rest = template.items.filter((i) => !taken.has(i.id));
      let p = 0;
      for (let i = 0; i < next.length && p < rest.length; i++) if (!next[i]) next[i] = rest[p++].id;
      return next;
    });
    setSelected(null);
  }, [template.items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (over === "pool") toPool(id);
    else if (over.startsWith("slot:")) place(id, Number(over.slice(5)));
  }

  const { w, T, top, chipSize, gap, rowH, H, leftEdgeAt } = solveShape(viewportWidth);
  const { setNodeRef: poolRef, isOver: overPool } = useDroppable({ id: "pool" });
  const draggingItem = dragging ? byId.get(dragging) : null;

  let at = 0;
  const rows = CAPS.map((cap, tier) => {
    const from = at;
    at += cap;
    return { tier, from, cap };
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => {
        setDragging(String(e.active.id));
        setSelected(null);
      }}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      {/* One shape, sliced into tiers. The clip is what makes the edges
          true diagonals rather than a staircase: each tier is a full-width
          band and the shape cuts it to whatever the slope allows at that
          height, so the corners fill themselves with the row's own black. */}
      <div className="relative mx-auto" style={{ width: w, height: H }}>
        <div
          className="absolute inset-0"
          style={{
            clipPath: `polygon(${(w - top) / 2}px 0, ${(w + top) / 2}px 0, ${w}px ${H}px, 0 ${H}px)`,
          }}
        >
          {rows.map(({ tier, from, cap }) => {
            const yTop = tier * rowH;
            const x1 = leftEdgeAt(yTop);
            const x4 = leftEdgeAt(yTop + rowH);
            const mid = leftEdgeAt(yTop + rowH / 2);
            return (
              <div
                key={tier}
                className="absolute left-0 flex items-center justify-center"
                style={{
                  top: yTop,
                  width: w,
                  height: rowH,
                  // Pure black, exactly as TierRow: the highest-contrast
                  // ground the marks can sit on.
                  background: "#000000",
                  borderTop: tier === 0 ? undefined : "1px solid rgba(255,255,255,0.09)",
                  // Centres the marks in what the band leaves rather than
                  // in the whole row. Both bounds move with the slope by
                  // the same amount, so this lands on the same x for every
                  // tier and the marks stay a symmetric triangle.
                  paddingLeft: T,
                  gap,
                }}
              >
                {/* The tier's colour, cut at the slope's angle on BOTH
                    sides - a band lying along the triangle's edge rather
                    than a wedge that thickens as it falls. */}
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: accents[tier],
                    clipPath: `polygon(${x1}px 0, ${x1 + T}px 0, ${x4 + T}px 100%, ${x4}px 100%)`,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute"
                  style={{
                    left: mid + T / 2,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    fontFamily: "var(--font-display)",
                    fontSize: Math.max(13, Math.round(chipSize * 0.42)),
                    color: "#0c1830",
                    lineHeight: 1,
                  }}
                >
                  {LABELS[tier]}
                </span>

                {Array.from({ length: cap }, (_, k) => {
                  const index = from + k;
                  const id = slots[index];
                  const item = id ? byId.get(id) : null;
                  return (
                    <Slot
                      key={index}
                      index={index}
                      size={chipSize}
                      accent={accents[tier]}
                      armed={!!selected}
                      onTap={() => selected && place(selected, index)}
                    >
                      {item && (
                        <Draggable
                          item={item}
                          style={template.itemStyle}
                          size={chipSize}
                          selected={selected === item.id}
                          onActivate={() => setSelected((s) => (s === item.id ? null : item.id))}
                        />
                      )}
                    </Slot>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* The shape's own edge. #000 on the page's ground is almost no
            contrast, so without this the triangle has no visible boundary
            at all. One polygon rather than four borders, so each diagonal
            is a single unbroken line. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
        >
          <polygon
            points={`${(w - top) / 2},0 ${(w + top) / 2},0 ${w},${H} 0,${H}`}
            fill="none"
            stroke="rgba(255,255,255,0.17)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* The pool, in the board's own treatment - same black, same radius,
          same border, same heading shape as UNRANKED. The dashed rule is
          the one addition: it says the line these missed, which "unranked"
          never had to. */}
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-3 px-0.5">
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.55)_0_6px,transparent_6px_12px)]" />
          <h2
            className="shrink-0 text-sm tracking-wide text-white/70"
            style={{ fontFamily: "var(--font-display)" }}
          >
            MISSED THE CUT <span className="text-white/35">({pool.length})</span>
          </h2>
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.55)_0_6px,transparent_6px_12px)]" />
        </div>

        <div
          ref={poolRef}
          onClick={() => selected && toPool(selected)}
          className="flex flex-wrap content-start gap-1.5 rounded-2xl border p-2.5 transition-[background,border-color,box-shadow] duration-150"
          style={{
            minHeight: chipSize + 20,
            borderColor: overPool ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)",
            background: overPool ? "#141414" : "#000000",
            boxShadow: overPool
              ? "0 0 0 2px rgba(255,255,255,0.5), 0 10px 30px -12px rgba(0,0,0,0.9)"
              : undefined,
            cursor: selected ? "pointer" : undefined,
          }}
        >
          {pool.map((item) => (
            <Draggable
              key={item.id}
              item={item}
              style={template.itemStyle}
              size={chipSize}
              selected={selected === item.id}
              onActivate={() => setSelected((s) => (s === item.id ? null : item.id))}
            />
          ))}
          {pool.length === 0 && (
            <span className="self-center px-1 text-[11px] tracking-wide text-white/30">
              EVERY {template.itemNoun[0].toUpperCase()} MADE THE CUT
            </span>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={fill}
          className="rounded-full border border-white/15 px-5 py-2 text-[11px] text-white/60 transition-colors hover:border-white/30 hover:text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          FILL FROM POOL
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-full border border-white/15 px-5 py-2 text-[11px] text-white/60 transition-colors hover:border-red-300/50 hover:text-red-200"
          style={{ fontFamily: "var(--font-display)" }}
        >
          CLEAR
        </button>
      </div>

      {selected && (
        <p className="mt-3 text-center text-xs text-white/50">
          Now tap a slot to drop <span className="text-white/80">{byId.get(selected)?.label}</span> in —
          or tap it again to cancel.
        </p>
      )}

      <DragOverlay dropAnimation={null}>
        {draggingItem ? (
          <TierItemChip item={draggingItem} style={template.itemStyle} size={chipSize * 1.15} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
