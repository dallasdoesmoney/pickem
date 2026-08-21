"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
export const CAPS = [1, 3, 5, 7] as const;
export const RANKED = CAPS.reduce((a, b) => a + b, 0);
const LABELS = ["S", "A", "B", "C"] as const;

// Where a slot index falls. Slot 0 is the apex, 1-3 the second row, and
// so on, so the whole board is one flat array and "which tier is this"
// is arithmetic rather than bookkeeping.
function tierOf(slot: number): number {
  let at = 0;
  for (let t = 0; t < CAPS.length; t++) {
    if (slot < at + CAPS[t]) return t;
    at += CAPS[t];
  }
  return CAPS.length - 1;
}

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
      // let one id occupy two slots - a hand-edited or stale value must
      // not be able to duplicate a chip.
      if (typeof id !== "string" || !valid.has(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  } catch {
    return empty;
  }
}

// --------------------------------------------------------------- pieces

function Draggable({
  item,
  style,
  size,
  selected,
  dim,
  onActivate,
}: {
  item: TierItem;
  style?: TierTemplate["itemStyle"];
  size: number;
  selected: boolean;
  dim?: boolean;
  onActivate: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        touchAction: "none",
        opacity: isDragging ? 0.25 : dim ? 0.72 : 1,
        filter: dim && !isDragging ? "grayscale(0.3)" : undefined,
        transition: "opacity 120ms, filter 120ms",
      }}
    >
      <TierItemChip item={item} style={style} size={size} selected={selected} onActivate={onActivate} />
    </div>
  );
}

// An empty slot is also the drop target, so the triangle holds its shape
// on a board nobody has finished and the gaps say where things go.
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
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        borderRadius: Math.round(size * 0.26),
        flex: "none",
        cursor: armed ? "pointer" : undefined,
        border: empty || isOver ? `1.5px dashed ${isOver ? accent : "rgba(255,255,255,0.16)"}` : undefined,
        background: isOver ? `${accent}26` : undefined,
        boxShadow: armed && empty ? `0 0 0 1px ${accent}55` : undefined,
        transition: "background 120ms, border-color 120ms, box-shadow 120ms",
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
      /* private mode - the board still works, it just won't survive a reload */
    }
  }, [slots, loaded, template.slug]);

  const placed = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const bucket = useMemo(() => template.items.filter((i) => !placed.has(i.id)), [template.items, placed]);

  // Put an item in a slot. Whatever was there goes back to the bucket,
  // unless the item came from another slot - then the two trade places,
  // which is what a drag onto an occupied slot obviously means.
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

  const toBucket = useCallback((itemId: string) => {
    setSlots((prev) => prev.map((id) => (id === itemId ? null : id)));
    setSelected(null);
  }, []);

  const clear = useCallback(() => {
    setSlots(Array<string | null>(RANKED).fill(null));
    setSelected(null);
  }, []);

  // Fill the pyramid from the bucket in template order - a fast way to
  // get a full board to look at without dragging sixteen things.
  const fill = useCallback(() => {
    setSlots((prev) => {
      const next = [...prev];
      const taken = new Set(next.filter(Boolean) as string[]);
      const pool = template.items.filter((i) => !taken.has(i.id));
      let p = 0;
      for (let i = 0; i < next.length && p < pool.length; i++) if (!next[i]) next[i] = pool[p++].id;
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
    if (over === "bucket") toBucket(id);
    else if (over.startsWith("slot:")) place(id, Number(over.slice(5)));
  }

  // --- sizing ---------------------------------------------------------
  //
  // The widest row is seven chips plus a rail either side. Solved from
  // the measured width rather than a breakpoint, so it fills a desktop
  // and still holds the triangle on a phone instead of wrapping - a
  // wrapped row is a different shape, which would defeat the whole thing.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wide = CAPS[CAPS.length - 1];
  const gap = width < 420 ? 5 : 8;
  const rail = width < 420 ? 30 : 46;
  const size = Math.max(
    24,
    Math.min(56, Math.floor((width - rail * 2 - gap * (wide - 1) - 26) / wide)),
  );
  const bucketSize = Math.max(22, Math.round(size * 0.72));

  const { setNodeRef: bucketRef, isOver: overBucket } = useDroppable({ id: "bucket" });
  const draggingItem = dragging ? byId.get(dragging) : null;

  let slotAt = 0;
  const rows = CAPS.map((cap, tier) => {
    const from = slotAt;
    slotAt += cap;
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
      <div ref={wrapRef} className="w-full">
        {/* the triangle */}
        <div className="flex flex-col items-center gap-2">
          {rows.map(({ tier, from, cap }) => (
            <div key={tier} className="flex items-center justify-center">
              <div
                className="inline-flex items-center overflow-hidden rounded-[13px] border"
                style={{ gap, borderColor: accents[tier], background: "rgba(255,255,255,0.045)" }}
              >
                <span
                  className="grid shrink-0 place-items-center self-stretch"
                  style={{
                    width: rail,
                    background: accents[tier],
                    color: "#0b1220",
                    fontFamily: "var(--font-display)",
                    fontSize: Math.max(11, Math.round(size * 0.34)),
                    // The chevron cut, exactly as TierRow draws it - the
                    // point is the edge, so no border-right.
                    clipPath: "polygon(0 0, 84% 0, 100% 50%, 84% 100%, 0 100%)",
                    paddingRight: Math.round(rail * 0.26),
                  }}
                >
                  {LABELS[tier]}
                </span>
                <span className="flex items-center" style={{ gap }}>
                  {Array.from({ length: cap }, (_, k) => {
                    const index = from + k;
                    const id = slots[index];
                    const item = id ? byId.get(id) : null;
                    return (
                      <Slot
                        key={index}
                        index={index}
                        size={size}
                        accent={accents[tier]}
                        armed={!!selected}
                        onTap={() => selected && place(selected, index)}
                      >
                        {item && (
                          <Draggable
                            item={item}
                            style={template.itemStyle}
                            size={size}
                            selected={selected === item.id}
                            onActivate={() => setSelected((s) => (s === item.id ? null : item.id))}
                          />
                        )}
                      </Slot>
                    );
                  })}
                </span>
                {/* Mirrors the rail so the shelf is symmetric about its
                    chips. Without it every row grew further right than
                    left and the "perfect triangle" leaned. Tinted and
                    chevroned back the other way rather than left blank:
                    an empty box of the rail's width read as unfinished
                    space, where a faded bookend reads as the shelf
                    closing. */}
                <span
                  aria-hidden
                  className="shrink-0 self-stretch"
                  style={{
                    width: rail,
                    background: accents[tier],
                    opacity: 0.22,
                    clipPath: "polygon(16% 0, 100% 0, 100% 100%, 16% 100%, 0 50%)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* the cut */}
        <div
          className="mt-5 mb-3 flex items-center gap-3 text-[10px] tracking-[0.16em] text-slate-400"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#94a3b8_0_6px,transparent_6px_12px)] opacity-60" />
          <span className="whitespace-nowrap">MISSED THE CUT · {bucket.length}</span>
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#94a3b8_0_6px,transparent_6px_12px)] opacity-60" />
        </div>

        <div
          ref={bucketRef}
          className="flex flex-wrap justify-center rounded-xl p-2 transition-colors"
          style={{
            gap,
            background: overBucket ? "rgba(148,163,184,0.12)" : "transparent",
            outline: overBucket ? "1.5px dashed rgba(148,163,184,0.5)" : "1.5px dashed transparent",
          }}
          onClick={() => selected && toBucket(selected)}
        >
          {bucket.length === 0 ? (
            <p className="py-3 text-xs text-white/35">Everything is ranked.</p>
          ) : (
            bucket.map((item) => (
              <Draggable
                key={item.id}
                item={item}
                style={template.itemStyle}
                size={bucketSize}
                selected={selected === item.id}
                dim
                onActivate={() => setSelected((s) => (s === item.id ? null : item.id))}
              />
            ))
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={fill}
            className="rounded-full border border-white/20 px-5 py-2 text-xs text-white/70 transition-colors hover:border-white/45 hover:text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            FILL FROM POOL
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-white/20 px-5 py-2 text-xs text-white/70 transition-colors hover:border-red-300/60 hover:text-red-200"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CLEAR
          </button>
        </div>

        {selected && (
          <p className="mt-4 text-center text-xs text-white/55">
            Now tap a slot to drop{" "}
            <span className="text-white/85">{byId.get(selected)?.label}</span> in — or tap it again to
            cancel.
          </p>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingItem ? (
          <TierItemChip item={draggingItem} style={template.itemStyle} size={size} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
