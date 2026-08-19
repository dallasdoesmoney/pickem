"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TierItem } from "@/data/tierTemplates";

// Items render as a bare logo by product decision, so the accessible name
// has to come from somewhere else entirely: aria-label carries the full
// team name for screen readers, `title` gives sighted users a hover
// tooltip, and the img itself stays alt="" so the name isn't announced
// twice.
export function TierItemChip({
  item,
  size,
  selected,
  landed,
  sweeping,
  sweepIndex = 0,
  scatterKey = 0,
  scatterIndex = 0,
  onActivate,
  dragging,
}: {
  item: TierItem;
  size: number;
  selected?: boolean;
  // Set for one beat right after a placement so the chip can pop.
  landed?: boolean;
  // Reset is clearing the board - fly out before it does.
  sweeping?: boolean;
  sweepIndex?: number;
  // Bumped per shuffle; the key remounts the chip so the scatter replays.
  scatterKey?: number;
  scatterIndex?: number;
  onActivate?: () => void;
  dragging?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-pressed={selected}
      title={item.label}
      onClick={onActivate}
      className={`relative shrink-0 rounded-xl flex items-center justify-center transition-[box-shadow,transform] duration-150 ${
        landed ? "tier-anim-land" : ""
      } ${dragging ? "tier-anim-target" : "hover:scale-110 active:scale-95"} ${sweeping ? "tier-anim-sweep" : scatterKey ? "tier-anim-scatter" : ""}`}
      key={scatterKey}
      style={{
        width: size,
        height: size,
        // No plate behind the mark - the ESPN "500-dark" logos are already
        // built to sit on dark ground (see espnLogo in teams.ts), and they
        // read much better bare, exactly as they do in the share image.
        // Selection is carried by a ring instead of a fill.
        // While a drag is in flight this element sits at the spot the item
        // would land. The faded logo alone carries that - an outline round
        // it just added noise.
        background: selected && !dragging ? `${item.accent}33` : "transparent",
        boxShadow: selected && !dragging ? `0 0 0 2px ${item.accent}, 0 6px 18px -6px ${item.accent}` : undefined,
        touchAction: "manipulation",
        // Staggered so the board empties in a wave rather than all at once,
        // and the pool scatters in a ripple rather than a single blink.
        animationDelay: sweeping ? `${sweepIndex * 22}ms` : scatterKey ? `${scatterIndex * 26}ms` : undefined,
        // Alternating so the board clears outward in both directions
        // instead of every chip piling toward one corner.
        ...(sweeping
          ? {
              ["--sweep-x" as string]: `${(sweepIndex % 2 ? 1 : -1) * (130 + (sweepIndex % 3) * 40)}px`,
              ["--sweep-rot" as string]: `${(sweepIndex % 2 ? 1 : -1) * (100 + (sweepIndex % 4) * 45)}deg`,
            }
          : {}),
      }}
    >
      <img
        src={item.imageUrl}
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        className="w-full h-full object-contain select-none pointer-events-none transition-opacity duration-150"
        style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))", opacity: dragging ? 0.3 : 1 }}
      />
    </button>
  );
}

// Sortable wrapper. Kept separate from the presentational chip so the
// share-image preview and the mobile sheet can render a chip without
// pulling in dnd-kit context (useSortable throws outside a DndContext).
export function SortableTierItem({
  item,
  size,
  selected,
  landed,
  sweeping,
  sweepIndex,
  scatterKey,
  scatterIndex,
  onActivate,
  disabled,
}: {
  item: TierItem;
  size: number;
  selected?: boolean;
  landed?: boolean;
  sweeping?: boolean;
  sweepIndex?: number;
  scatterKey?: number;
  scatterIndex?: number;
  onActivate?: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
      {...attributes}
      {...listeners}
    >
      <TierItemChip
        item={item}
        size={size}
        selected={selected}
        landed={landed}
        sweeping={sweeping}
        sweepIndex={sweepIndex}
        scatterKey={scatterKey}
        scatterIndex={scatterIndex}
        onActivate={onActivate}
        dragging={isDragging}
      />
    </div>
  );
}
