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
// row is capped at its tier's capacity and centred in the track, so the
// marks form the triangle while the board itself stays the board.
export const CAPS = [1, 3, 5, 7] as const;
export const RANKED = CAPS.reduce((a, b) => a + b, 0);
const WIDEST = CAPS[CAPS.length - 1];
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

// The board's own solver, with one substitution: the real board wraps, so
// it picks a per-row count from the viewport. A pyramid cannot wrap - a
// wrapped row is a different shape - so the widest tier's capacity IS the
// per-row count, and the chip solves down to whatever makes seven fit.
function solveSize(viewportWidth: number) {
  const content = Math.min(viewportWidth, 1056) - 32;
  const base = viewportWidth < 768 ? 86 : 136;
  const gap = viewportWidth < 768 ? 4 : 6;
  // p-2 either side of the marks, exactly as a tier row, plus the row's
  // own 1px side borders - which are part of its width now that each row
  // is its own object, and left out of the budget put a phone 1px over.
  const pad = 16 + 2;

  // Rows are sized to their own capacity now, so the bottom row is the
  // whole board's width and everything solves backwards from it.
  const solve = (rails: number) => {
    const track = content - base * rails - pad;
    return Math.max(22, Math.min(80, Math.floor((track - (WIDEST - 1) * gap) / WIDEST)));
  };

  // The rail sits on the left, so without something the same width on the
  // right the marks sit right of the row's own centre - the silhouette
  // and the marks end up as two triangles on different axes. Paying for
  // the rail twice is worth it while the mark stays big; on a phone it
  // costs more than half the mark, which is not.
  const mirrored = solve(2) >= 40;
  const chipSize = mirrored ? solve(2) : solve(1);
  // Same derivation as the board. In practice this lands on `base` at
  // every size the pyramid solves to, so a row's rail is the board's rail.
  const railWidth = Math.max(base, Math.round((chipSize + 16) * 1.28));
  return { chipSize, railWidth, gap, mirrored };
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

  const { chipSize, railWidth, gap, mirrored } = solveSize(viewportWidth);
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
      {/* Still the board - pure black, the chevron rail, a hairline between
          tiers, the outer corners rounded - but each row is only as wide as
          its own tier holds, and they stack dead centre with no gap. Every
          row is wider than the one above by exactly two marks, so the sides
          step out evenly and the stack itself is the pyramid. */}
      <div className="flex flex-col items-center">
        {rows.map(({ tier, from, cap }) => (
          <div
            key={tier}
            className="flex items-stretch overflow-hidden"
            style={{
              // Pure black, exactly as TierRow: the highest-contrast ground
              // the marks can sit on.
              background: "#000000",
              // The sides are the pyramid's edge, so they carry the board's
              // border; the top of each row is the hairline that separates
              // it from the tier above, and where the row sticks out past
              // that tier the same hairline reads as the step's edge.
              borderLeft: "1px solid rgba(255,255,255,0.10)",
              borderRight: "1px solid rgba(255,255,255,0.10)",
              borderTop: tier === 0 ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(255,255,255,0.09)",
              borderBottom: tier === CAPS.length - 1 ? "1px solid rgba(255,255,255,0.10)" : undefined,
              borderTopLeftRadius: tier === 0 ? 16 : undefined,
              borderTopRightRadius: tier === 0 ? 16 : undefined,
              borderBottomLeftRadius: tier === CAPS.length - 1 ? 16 : undefined,
              borderBottomRightRadius: tier === CAPS.length - 1 ? 16 : undefined,
            }}
          >
            <div
              className="flex shrink-0 items-center justify-center"
              style={{
                width: railWidth,
                background: accents[tier],
                clipPath: "polygon(0 0, 84% 0, 100% 50%, 84% 100%, 0 100%)",
                paddingRight: 14,
                paddingLeft: 4,
              }}
            >
              <span
                className="w-full min-w-0 text-center leading-[1.12]"
                style={{ fontFamily: "var(--font-display)", color: "#0c1830", fontSize: 30 }}
              >
                {LABELS[tier]}
              </span>
            </div>

            {/* Same padding and min-height as a tier row. The row is sized
                to exactly this tier's capacity, so there is nothing to
                centre within - the slots ARE the row. */}
            <div
              className="flex items-center p-2"
              style={{ gap, minHeight: chipSize + 16 }}
            >
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

            {/* Black, so it is simply more row. Its only job is to put the
                marks on the same centre line as the silhouette. */}
            {mirrored && <span aria-hidden className="shrink-0" style={{ width: railWidth }} />}
          </div>
        ))}
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
