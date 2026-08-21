"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// Two views of the same sixteen. ROWS is the tier board's own shape -
// full-width bands, the rail down the left, marks packed from the left
// edge. PYRAMID clips each band to the slope and centres the marks. The
// data does not move between them; only the drawing does, which is what
// makes the switch a view rather than a mode.
//
// The morph works because a rectangle and a trapezoid are the same four
// points. Nothing resizes and nothing reflows - each band keeps its full
// width the whole time and only its clip-path interpolates, and the
// marks ride on transforms the compositor can handle. See the animation
// block further down for the choreography.
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
//   T    - the colour band's thickness, measured horizontally. It is
//          also the rows view's rail width, so the two states are the
//          same shape at different angles and the morph is honest.
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
  motion,
  children,
  onTap,
}: {
  index: number;
  size: number;
  accent: string;
  armed: boolean;
  // Where this slot sits in the current view, and how it should travel
  // there. Absolute + transform rather than flex, so moving sixteen of
  // them costs the compositor about what moving one does.
  motion: { x: number; y: number; transition: string };
  children?: React.ReactNode;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${index}` });
  const empty = !children;
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className="absolute left-0 top-0 grid place-items-center rounded-xl"
      style={{
        width: size,
        height: size,
        transform: `translate(${motion.x}px, ${motion.y}px)`,
        transition: `${motion.transition}, background 150ms, box-shadow 150ms`,
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

// ------------------------------------------------------------- motion
//
// "Cascade": the bands narrow from the bottom up, the marks travel with
// their own band rather than after it, and the cut line arrives last.
// Slower and heavier than a snap - it reads as the board folding itself
// rather than as a control being flipped.
const CASCADE = {
  duration: 900,
  ease: "cubic-bezier(.65,0,.35,1)",
  bezier: [0.65, 0, 0.35, 1] as const,
  rowStagger: 95,
  markStagger: 22,
};

// The outline cannot be a CSS transition - SVG points are not
// animatable - but it must not re-time the animation either. Staggering
// the rows and separately easing one polygon put the two out of register
// mid-flight, with the outline wider than the row it was supposed to be
// tracing.
//
// So it traces instead of predicting: every frame it reads each row's
// CURRENT computed clip-path and stitches the silhouette out of those
// corners. Whatever the rows are doing, the edge is doing, by
// construction - including the steps between rows that the stagger
// creates, which are the cascade rather than a defect.
function readClipXs(el: HTMLElement): [number, number, number, number] | null {
  const m = getComputedStyle(el).clipPath.match(/-?[\d.]+px/g);
  if (!m || m.length < 4) return null;
  const [a, b, c, d] = m.slice(0, 4).map(parseFloat);
  return [a, b, c, d];
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
  const [view, setView] = useState<"rows" | "pyramid">("pyramid");
  // False on the first paint: the board should arrive in its shape, not
  // assemble itself every time the page loads.
  const [animate, setAnimate] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Sixteen marks flying across the screen is exactly the motion the OS
  // setting exists for, so honour it: the switch still works, it just
  // cuts straight to the end state.
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const { w, T, chipSize, gap, rowH, H, leftEdgeAt } = solveShape(viewportWidth);
  const { setNodeRef: poolRef, isOver: overPool } = useDroppable({ id: "pool" });
  const draggingItem = dragging ? byId.get(dragging) : null;

  // Where every piece sits in each view. Both are pure functions of the
  // solved shape, so the two states can never disagree about geometry -
  // which is what lets them be interpolated rather than cross-faded.
  const layout = useMemo(() => {
    const rowsOf = (view: "rows" | "pyramid") => {
      let at = 0;
      return CAPS.map((cap, tier) => {
        const from = at;
        at += cap;
        const yTop = tier * rowH;
        const yBot = yTop + rowH;
        const a = leftEdgeAt(yTop);
        const b = leftEdgeAt(yBot);
        const total = cap * chipSize + (cap - 1) * gap;
        // ROWS packs from the left edge, past the rail, exactly as a tier
        // row does. PYRAMID centres in what the band leaves - both bounds
        // move with the slope by the same amount, so the marks land on
        // the same x for every tier.
        const startX = view === "rows" ? T + 12 : (w + T) / 2 - total / 2;
        return {
          tier,
          from,
          cap,
          yTop,
          // A rectangle and a trapezoid are the same four points.
          rowClip:
            view === "rows"
              ? `polygon(0px 0%, ${w}px 0%, ${w}px 100%, 0px 100%)`
              : `polygon(${a}px 0%, ${w - a}px 0%, ${w - b}px 100%, ${b}px 100%)`,
          // The rail is a band standing straight up; the pyramid's is the
          // same band lying along the slope.
          bandClip:
            view === "rows"
              ? `polygon(0px 0%, ${T}px 0%, ${T}px 100%, 0px 100%)`
              : `polygon(${a}px 0%, ${a + T}px 0%, ${b + T}px 100%, ${b}px 100%)`,
          letterX: view === "rows" ? T / 2 : leftEdgeAt(yTop + rowH / 2) + T / 2,
          slotX: (k: number) => startX + k * (chipSize + gap),
          slotY: yTop + (rowH - chipSize) / 2,
        };
      });
    };
    return { rows: rowsOf("rows"), pyramid: rowsOf("pyramid") };
  }, [w, T, chipSize, gap, rowH, leftEdgeAt]);

  const shown = layout[view];

  // Redrawn from the rows themselves, every frame while anything is
  // moving, and once whenever the solved shape changes.
  const edgeRef = useRef<SVGPolygonElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const traceEdge = useCallback(() => {
    const poly = edgeRef.current;
    if (!poly) return;
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < CAPS.length; i++) {
      const el = rowRefs.current[i];
      if (!el) return;
      const xs = readClipXs(el);
      if (!xs) return;
      const [topL, topR, botR, botL] = xs;
      const yTop = i * rowH;
      const yBot = yTop + rowH;
      left.push(`${topL},${yTop}`, `${botL},${yBot}`);
      right.unshift(`${topR},${yTop}`, `${botR},${yBot}`);
    }
    poly.setAttribute("points", [...left, ...right].join(" "));
  }, [rowH]);

  useEffect(() => {
    let raf = 0;
    // Long enough to cover the last row's delay plus its duration.
    const until =
      performance.now() +
      (animate && !reduced ? CASCADE.duration + CAPS.length * CASCADE.rowStagger + 60 : 0);
    const step = () => {
      traceEdge();
      if (performance.now() < until) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [view, animate, reduced, traceEdge, w, H]);

  const dur = animate && !reduced ? CASCADE.duration : 0;
  // Bottom row first: the base settles and the tiers fold in above it.
  const rowDelay = (tier: number) => (dur ? (CAPS.length - 1 - tier) * CASCADE.rowStagger : 0);

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
      <div className="mb-5 flex justify-center">
        <div className="flex gap-1 rounded-full border border-white/12 bg-black/40 p-1">
          {(["rows", "pyramid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                if (v === view) return;
                setAnimate(true);
                setView(v);
              }}
              className={`rounded-full px-5 py-2 text-[11px] transition-colors ${
                view === v ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {v === "rows" ? "ROWS" : "PYRAMID"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto" style={{ width: w, height: H }}>
        {shown.map(({ tier, yTop, rowClip, bandClip, letterX }) => {
          const d = rowDelay(tier);
          return (
            <div
              key={tier}
              ref={(el) => {
                rowRefs.current[tier] = el;
              }}
              className="absolute left-0"
              style={{
                top: yTop,
                width: w,
                height: rowH,
                background: "#000000",
                borderTop: tier === 0 ? undefined : "1px solid rgba(255,255,255,0.09)",
                clipPath: rowClip,
                transition: `clip-path ${dur}ms ${CASCADE.ease} ${d}ms`,
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: accents[tier],
                  clipPath: bandClip,
                  transition: `clip-path ${dur}ms ${CASCADE.ease} ${d}ms`,
                }}
              />
              <span
                aria-hidden
                className="absolute top-1/2"
                style={{
                  left: 0,
                  transform: `translate(${letterX}px, -50%) translateX(-50%)`,
                  transition: `transform ${dur}ms ${CASCADE.ease} ${d}ms`,
                  fontFamily: "var(--font-display)",
                  fontSize: Math.max(13, Math.round(chipSize * 0.42)),
                  color: "#0c1830",
                  lineHeight: 1,
                }}
              >
                {LABELS[tier]}
              </span>
            </div>
          );
        })}

        {/* Slots live above the bands rather than inside them: a clipped
            row would cut a mark in half mid-flight, and a drop target you
            cannot see is a drop target you cannot hit. */}
        {shown.map(({ tier, from, cap, slotX, slotY }) =>
          Array.from({ length: cap }, (_, k) => {
            const index = from + k;
            const id = slots[index];
            const item = id ? byId.get(id) : null;
            const d = dur ? rowDelay(tier) + index * CASCADE.markStagger : 0;
            return (
              <Slot
                key={index}
                index={index}
                size={chipSize}
                accent={accents[tier]}
                armed={!!selected}
                motion={{ x: slotX(k), y: slotY, transition: `transform ${dur}ms ${CASCADE.ease} ${d}ms` }}
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
          }),
        )}

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
            ref={edgeRef}
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
