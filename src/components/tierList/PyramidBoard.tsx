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
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { tierLabelFor } from "@/lib/tierList";
import { useTierList } from "@/hooks/useTierList";
import { TierItemChip } from "./TierItemChip";

// Two boards, one animation layer.
//
// TIER LIST is the real thing - the user's own tiers, however many they
// have made, items packed from the left edge, no capacity and therefore
// no empty squares. It is the actual draft from useTierList, so what is
// here is what is in the editor.
//
// PYRAMID is a different ranking with its own rules: sixteen places in
// four rows, 1 + 3 + 5 + 7, everything else below a cut.
//
// Keeping them separate is the point. A pyramid cannot represent six
// free-form tiers, so deriving each from the other would lose work every
// time you switched. Instead neither writes to the other: the pyramid is
// seeded once from the board's reading order, and toggling back returns
// the tier list exactly as it was - extra tiers, empty tiers and all.
export const CAPS = [1, 3, 5, 7] as const;
export const RANKED = CAPS.reduce((a, b) => a + b, 0);

const storageKey = (slug: string) => `pickem:pyramid:${slug}`;

function readSlots(slug: string, valid: Set<string>): (string | null)[] | null {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return null;
    const seen = new Set<string>();
    return Array.from({ length: RANKED }, (_, i) => {
      const id = saved[i];
      // Never let one id hold two places, and drop anything that is not
      // an item of this template - a stale value must not be able to
      // duplicate a mark.
      if (typeof id !== "string" || !valid.has(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- shape
//
// Every proportion is a fraction of the width, so the triangle looks the
// same at any size and only the mark changes.
//
//   T    - the colour band's thickness. It is also the tier list's rail
//          width, so the two states are the same shape at different
//          angles and the morph between them is honest.
//   top  - the flat width at the apex. Not a style choice: a band thick
//          enough to carry its own letter needs T + mark + padding of
//          clear width at the apex row's mid height, and that height is
//          only an eighth of the base.
function solveShape(viewportWidth: number) {
  const w = Math.min(viewportWidth, 1056) - 32;
  const T = Math.round(w * 0.12);
  const top = Math.round(w * 0.1375);
  // The pyramid's base row binds: seven marks between the band and the
  // right-hand slope, where the slope has already taken 0.108w per side.
  const chip = Math.max(22, Math.min(80, Math.floor(w * 0.082)));
  const gap = Math.max(4, Math.round(chip * 0.13));
  const pyrRowH = chip + 24;
  const H = pyrRowH * CAPS.length;
  const leftEdgeAt = (Y: number) => ((w - top) / 2) * (1 - Y / H);
  return { w, T, top, chip, gap, pyrRowH, H, leftEdgeAt };
}

// "Cascade": bands narrow from the bottom up, marks travel with their own
// band rather than after it. Slower and heavier than a snap - it reads as
// the board folding itself rather than a control being flipped.
const CASCADE = {
  duration: 900,
  ease: "cubic-bezier(.65,0,.35,1)",
  rowStagger: 95,
  markStagger: 16,
};

// --------------------------------------------------------------- pieces

function Draggable({
  item,
  style,
  size,
  selected,
  x,
  y,
  transition,
  onActivate,
}: {
  item: TierItem;
  style?: TierTemplate["itemStyle"];
  size: number;
  selected: boolean;
  x: number;
  y: number;
  transition: string;
  onActivate: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="absolute left-0 top-0"
      style={{
        width: size,
        height: size,
        // Absolute + transform rather than flex: moving thirty-two marks
        // costs the compositor about what moving one does, and nothing
        // reflows while they travel.
        transform: `translate(${x}px, ${y}px)`,
        transition,
        touchAction: "none",
        opacity: isDragging ? 0.25 : 1,
        zIndex: isDragging ? 30 : 2,
      }}
    >
      <TierItemChip item={item} style={style} size={size} selected={selected} onActivate={onActivate} />
    </div>
  );
}

// An invisible drop target. In the pyramid these are the sixteen places;
// in the tier list there is one per tier, covering it. Never drawn: a
// tier list has no capacity, so it has no empty squares to show. The
// only feedback is the zone lighting up under a drag.
function Zone({
  id,
  x,
  y,
  w,
  h,
  accent,
  armed,
  onTap,
}: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
  armed: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className="absolute left-0 top-0 rounded-xl transition-[background,box-shadow] duration-150"
      style={{
        width: w,
        height: h,
        transform: `translate(${x}px, ${y}px)`,
        cursor: armed ? "pointer" : undefined,
        background: isOver ? `${accent}2e` : undefined,
        boxShadow: isOver ? `inset 0 0 0 2px ${accent}` : undefined,
        zIndex: 1,
      }}
    />
  );
}

function PoolBox({
  height,
  width,
  armed,
  onTap,
}: {
  height: number;
  width: number;
  armed: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className="rounded-2xl border transition-[background,border-color] duration-150"
      style={{
        width,
        height,
        borderColor: isOver ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)",
        background: isOver ? "#141414" : "#000000",
        cursor: armed ? "pointer" : undefined,
      }}
    />
  );
}

// ---------------------------------------------------------------- board

export function PyramidBoard({ template }: { template: TierTemplate }) {
  // The real draft, shared with the editor. The tier list view IS the
  // tier list - not a copy of it, and not a four-tier stand-in.
  const { state, loaded: boardLoaded, dispatch } = useTierList(template);

  const byId = useMemo(() => new Map(template.items.map((i) => [i.id, i])), [template]);
  const validIds = useMemo(() => new Set(template.items.map((i) => i.id)), [template]);

  const [slots, setSlots] = useState<(string | null)[]>(() => Array<string | null>(RANKED).fill(null));
  const [pyrLoaded, setPyrLoaded] = useState(false);
  const [view, setView] = useState<"rows" | "pyramid">("rows");
  // False on the first paint: the board should arrive in its shape, not
  // assemble itself on every page load.
  const [animate, setAnimate] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(390);

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

  // Reading order: top tier first, then left to right inside it. It is
  // the only ranking a free-form board already contains, so it is what
  // seeds the pyramid.
  const readingOrder = useMemo(
    () => state.tiers.flatMap((t) => state.placements[t.id] ?? []),
    [state],
  );
  // Held in a ref so seeding and refilling can read the board's current
  // order without either of them re-running every time the board changes.
  const readingRef = useRef(readingOrder);
  useEffect(() => {
    readingRef.current = readingOrder;
  }, [readingOrder]);

  // Seeded once, then independent. Read after mount, never during render:
  // the server has no local storage and seeding from it during render
  // tears on hydration.
  const seeded = useRef(false);
  useEffect(() => {
    if (!boardLoaded || seeded.current) return;
    seeded.current = true;
    const saved = readSlots(template.slug, validIds);
    setSlots(saved ?? Array.from({ length: RANKED }, (_, i) => readingRef.current[i] ?? null));
    setPyrLoaded(true);
  }, [boardLoaded, template.slug, validIds]);

  useEffect(() => {
    if (!pyrLoaded) return;
    try {
      localStorage.setItem(storageKey(template.slug), JSON.stringify(slots));
    } catch {
      /* private mode - it works, it just won't survive a reload */
    }
  }, [slots, pyrLoaded, template.slug]);

  const placed = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const pyrPool = useMemo(
    () => template.items.filter((i) => !placed.has(i.id)),
    [template.items, placed],
  );

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

  const toPyrPool = useCallback((itemId: string) => {
    setSlots((prev) => prev.map((id) => (id === itemId ? null : id)));
    setSelected(null);
  }, []);

  const reseed = useCallback(() => {
    setSlots(Array.from({ length: RANKED }, (_, i) => readingRef.current[i] ?? null));
    setSelected(null);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (view === "pyramid") {
      if (over === "pool") toPyrPool(id);
      else if (over.startsWith("slot:")) place(id, Number(over.slice(5)));
      return;
    }
    // The tier list view edits the real board, exactly as the editor does.
    if (over === "pool") dispatch({ type: "moveItem", itemId: id, toTier: null, toIndex: null });
    else if (over.startsWith("tier:"))
      dispatch({ type: "moveItem", itemId: id, toTier: over.slice(5), toIndex: null });
  }

  // ------------------------------------------------------------ layout
  const { w, T, chip, gap, pyrRowH, H, leftEdgeAt } = solveShape(viewportWidth);
  const PAD = 10;
  const perRow = Math.max(1, Math.floor((w - T - PAD * 2 + gap) / (chip + gap)));
  const poolPerRow = Math.max(1, Math.floor((w - PAD * 2 + gap) / (chip + gap)));

  const layout = useMemo(() => {
    const cell = chip + gap;
    const boxH = (n: number) => Math.max(1, n) * cell - gap + PAD * 2;

    // ---- the tier list: tiers of whatever height they need ----
    const rowsTiers: { top: number; height: number }[] = [];
    const rowsPos = new Map<string, { x: number; y: number }>();
    let y = 0;
    state.tiers.forEach((tier) => {
      const ids = state.placements[tier.id] ?? [];
      const height = boxH(Math.ceil(ids.length / perRow));
      ids.forEach((id, k) => {
        rowsPos.set(id, {
          x: T + PAD + (k % perRow) * cell,
          y: y + PAD + Math.floor(k / perRow) * cell,
        });
      });
      rowsTiers.push({ top: y, height });
      y += height;
    });
    const rowsPoolY = y + 46;
    const rowsPoolH = boxH(Math.ceil(state.unranked.length / poolPerRow));
    state.unranked.forEach((id, k) => {
      rowsPos.set(id, {
        x: PAD + (k % poolPerRow) * cell,
        y: rowsPoolY + PAD + Math.floor(k / poolPerRow) * cell,
      });
    });

    // ---- the pyramid: four fixed rows, then the cut ----
    const pyrPos = new Map<string, { x: number; y: number }>();
    const pyrTiers: { top: number; height: number }[] = [];
    let at = 0;
    CAPS.forEach((cap, tier) => {
      const yTop = tier * pyrRowH;
      pyrTiers.push({ top: yTop, height: pyrRowH });
      const total = cap * chip + (cap - 1) * gap;
      const startX = (w + T) / 2 - total / 2;
      for (let k = 0; k < cap; k++) {
        const id = slots[at + k];
        if (id) pyrPos.set(id, { x: startX + k * cell, y: yTop + (pyrRowH - chip) / 2 });
      }
      at += cap;
    });
    const pyrPoolY = H + 46;
    const pyrPoolH = boxH(Math.ceil(pyrPool.length / poolPerRow));
    pyrPool.forEach((item, k) => {
      pyrPos.set(item.id, {
        x: PAD + (k % poolPerRow) * cell,
        y: pyrPoolY + PAD + Math.floor(k / poolPerRow) * cell,
      });
    });

    return {
      rows: { tiers: rowsTiers, pos: rowsPos, poolY: rowsPoolY, poolH: rowsPoolH, height: rowsPoolY + rowsPoolH },
      pyramid: { tiers: pyrTiers, pos: pyrPos, poolY: pyrPoolY, poolH: pyrPoolH, height: pyrPoolY + pyrPoolH },
    };
  }, [state, slots, pyrPool, w, T, chip, gap, perRow, poolPerRow, pyrRowH, H]);

  const L = layout[view];
  const dur = animate && !reduced ? CASCADE.duration : 0;
  // Bottom row first: the base settles and the tiers fold in above it.
  const rowDelay = (tier: number) =>
    dur ? Math.max(0, Math.min(CAPS.length - 1, CAPS.length - 1 - tier)) * CASCADE.rowStagger : 0;
  const ease = CASCADE.ease;

  // ------------------------------------------------------- the outline
  //
  // SVG points are not CSS-animatable, and easing one polygon alongside
  // staggered rows put the two out of register mid-flight. So it traces
  // rather than predicts: every frame it reads each tier's CURRENT
  // computed clip-path and stitches the silhouette from those corners.
  const edgeRef = useRef<SVGPolygonElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const traceEdge = useCallback(() => {
    const poly = edgeRef.current;
    if (!poly) return;
    const left: string[] = [];
    const right: string[] = [];
    let base: [string, string] | null = null;
    for (let i = 0; i < state.tiers.length; i++) {
      const el = rowRefs.current[i];
      // A tier collapsed out of the pyramid has no edge to contribute.
      // It still measures 1px, because its own separator is a border.
      if (!el || el.offsetHeight < 2) continue;
      const m = getComputedStyle(el).clipPath.match(/-?[\d.]+px/g);
      if (!m || m.length < 4) continue;
      const [topL, topR, botR, botL] = m.slice(0, 4).map(parseFloat);
      const yTop = el.offsetTop;
      const yBot = yTop + el.offsetHeight;
      // One corner per row on the way down, one on the way back up, and
      // the last row's bottom closes it. Taking both corners of every row
      // instead drew a kink wherever a row's bottom and the next row's
      // top were mid-transition and a pixel out of step - staggered rows
      // are never in register while they are moving.
      left.push(`${topL},${yTop}`);
      right.unshift(`${topR},${yTop}`);
      base = [`${botL},${yBot}`, `${botR},${yBot}`];
    }
    if (base) {
      left.push(base[0]);
      right.unshift(base[1]);
    }
    poly.setAttribute("points", [...left, ...right].join(" "));
  }, [state.tiers.length]);

  useEffect(() => {
    let raf = 0;
    const until = performance.now() + (dur ? dur + state.tiers.length * CASCADE.rowStagger + 60 : 0);
    const step = () => {
      traceEdge();
      if (performance.now() < until) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [view, dur, traceEdge, w, L.height, state.tiers.length]);

  const draggingItem = dragging ? byId.get(dragging) : null;
  const poolLabel = view === "pyramid" ? "MISSED THE CUT" : "UNRANKED";
  const poolCount = view === "pyramid" ? pyrPool.length : state.unranked.length;

  // Nothing to draw until the draft has been read; rendering the default
  // board first and swapping would flash somebody else's ranking.
  if (!boardLoaded) return <div style={{ height: 420 }} />;

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
      <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
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
              {v === "rows" ? "TIER LIST" : "PYRAMID"}
            </button>
          ))}
        </div>
        {view === "pyramid" && (
          <button
            type="button"
            onClick={reseed}
            className="rounded-full border border-white/15 px-4 py-2 text-[10px] text-white/50 transition-colors hover:border-white/35 hover:text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            REFILL FROM TIER LIST
          </button>
        )}
      </div>

      <div
        className="relative mx-auto"
        style={{ width: w, height: L.height, transition: `height ${dur}ms ${ease}` }}
      >
        {/* Every tier the board has. The pyramid only has room for four,
            so the rest collapse to nothing - and come straight back when
            you switch away, because the board was never edited. */}
        {state.tiers.map((tier, i) => {
          const inPyramid = i < CAPS.length;
          const pyr = view === "pyramid";
          const geo = pyr && inPyramid ? layout.pyramid.tiers[i] : layout.rows.tiers[i];
          const height = pyr && !inPyramid ? 0 : geo.height;
          const topPx = pyr && !inPyramid ? H : geo.top;
          const a = inPyramid ? leftEdgeAt(i * pyrRowH) : 0;
          const b = inPyramid ? leftEdgeAt((i + 1) * pyrRowH) : 0;
          const d = rowDelay(i);
          const shaped = pyr && inPyramid;
          return (
            <div
              key={tier.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="absolute left-0 overflow-hidden"
              style={{
                top: topPx,
                width: w,
                height,
                opacity: height === 0 ? 0 : 1,
                background: "#000000",
                borderTop: i === 0 ? undefined : "1px solid rgba(255,255,255,0.09)",
                clipPath: shaped
                  ? `polygon(${a}px 0%, ${w - a}px 0%, ${w - b}px 100%, ${b}px 100%)`
                  : `polygon(0px 0%, ${w}px 0%, ${w}px 100%, 0px 100%)`,
                transition: `clip-path ${dur}ms ${ease} ${d}ms, top ${dur}ms ${ease} ${d}ms, height ${dur}ms ${ease} ${d}ms, opacity ${dur}ms ${ease} ${d}ms`,
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: tier.accent,
                  clipPath: shaped
                    ? `polygon(${a}px 0%, ${a + T}px 0%, ${b + T}px 100%, ${b}px 100%)`
                    : `polygon(0px 0%, ${T}px 0%, ${T}px 100%, 0px 100%)`,
                  transition: `clip-path ${dur}ms ${ease} ${d}ms`,
                }}
              />
              <span
                aria-hidden
                className="absolute top-1/2 whitespace-nowrap"
                style={{
                  left: 0,
                  transform: `translate(${
                    shaped ? leftEdgeAt(i * pyrRowH + pyrRowH / 2) + T / 2 : T / 2
                  }px, -50%) translateX(-50%)`,
                  transition: `transform ${dur}ms ${ease} ${d}ms`,
                  fontFamily: "var(--font-display)",
                  fontSize: Math.max(13, Math.round(chip * 0.42)),
                  color: "#0c1830",
                  lineHeight: 1,
                }}
              >
                {tierLabelFor(tier, i)}
              </span>
            </div>
          );
        })}

        {/* The silhouette. #000 on this ground has almost no contrast, so
            without it the shape has no visible boundary at all. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          width={w}
          height={L.height}
          style={{ zIndex: 3 }}
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

        {/* The pool, in the board's own treatment. */}
        <div
          className="absolute left-0"
          style={{
            top: 0,
            transform: `translateY(${L.poolY}px)`,
            width: w,
            transition: `transform ${dur}ms ${ease}`,
            zIndex: 1,
          }}
        >
          <div className="flex items-center gap-3 px-0.5" style={{ height: 34, marginTop: -34 }}>
            <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.55)_0_6px,transparent_6px_12px)]" />
            <h2
              className="shrink-0 text-sm tracking-wide text-white/70"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {poolLabel} <span className="text-white/35">({poolCount})</span>
            </h2>
            <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.55)_0_6px,transparent_6px_12px)]" />
          </div>
          <PoolBox
            width={w}
            height={L.poolH}
            armed={!!selected}
            onTap={() => {
              if (!selected) return;
              if (view === "pyramid") toPyrPool(selected);
              else dispatch({ type: "moveItem", itemId: selected, toTier: null, toIndex: null });
              setSelected(null);
            }}
          />
        </div>

        {/* Drop targets, never drawn. */}
        {view === "pyramid"
          ? (() => {
              let at = 0;
              return CAPS.flatMap((cap, tier) => {
                const total = cap * chip + (cap - 1) * gap;
                const startX = (w + T) / 2 - total / 2;
                const yTop = tier * pyrRowH + (pyrRowH - chip) / 2;
                const zones = Array.from({ length: cap }, (_, k) => {
                  const index = at + k;
                  return (
                    <Zone
                      key={index}
                      id={`slot:${index}`}
                      x={startX + k * (chip + gap)}
                      y={yTop}
                      w={chip}
                      h={chip}
                      accent={state.tiers[tier]?.accent ?? "#ffffff"}
                      armed={!!selected}
                      onTap={() => selected && place(selected, index)}
                    />
                  );
                });
                at += cap;
                return zones;
              });
            })()
          : state.tiers.map((tier, i) => (
              <Zone
                key={tier.id}
                id={`tier:${tier.id}`}
                x={T}
                y={layout.rows.tiers[i].top}
                w={w - T}
                h={layout.rows.tiers[i].height}
                accent={tier.accent}
                armed={!!selected}
                onTap={() => {
                  if (!selected) return;
                  dispatch({ type: "moveItem", itemId: selected, toTier: tier.id, toIndex: null });
                  setSelected(null);
                }}
              />
            ))}

        {/* Every mark, present in both views. */}
        {template.items.map((item, n) => {
          const p = L.pos.get(item.id);
          if (!p) return null;
          // Staggered by where it is going, so a tier's marks travel with
          // their own band rather than in template order.
          const tierOf = Math.min(CAPS.length - 1, Math.floor(p.y / Math.max(1, pyrRowH)));
          const d = dur ? rowDelay(tierOf) + (n % 12) * CASCADE.markStagger : 0;
          return (
            <Draggable
              key={item.id}
              item={item}
              style={template.itemStyle}
              size={chip}
              selected={selected === item.id}
              x={p.x}
              y={p.y}
              transition={`transform ${dur}ms ${ease} ${d}ms`}
              onActivate={() => setSelected((s) => (s === item.id ? null : item.id))}
            />
          );
        })}
      </div>

      {selected && (
        <p className="mt-4 text-center text-xs text-white/50">
          Now tap {view === "pyramid" ? "a slot" : "a tier"} to drop{" "}
          <span className="text-white/80">{resolveItem(template, selected).label}</span> in — or tap it
          again to cancel.
        </p>
      )}

      <DragOverlay dropAnimation={null}>
        {draggingItem ? (
          <TierItemChip item={draggingItem} style={template.itemStyle} size={chip * 1.15} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
