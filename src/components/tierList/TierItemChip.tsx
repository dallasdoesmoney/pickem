"use client";

import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TierItem, TierItemStyle } from "@/data/tierTemplates";

// Marks render bare, by product decision, so the accessible name has to
// come from somewhere else entirely: aria-label carries the full name
// for screen readers, `title` gives sighted users a hover tooltip, and
// the img itself stays alt="" so the name isn't announced twice.
//
// Portraits keep all of that and add a visible caption, because a hover
// tooltip is not a thing on a phone and a board of thirty-two faces with
// nothing written on it is a memory test. The caption is the surname
// only: at this chip size a full name sets at about five pixels, and the
// surname is what anyone says out loud anyway.
export function TierItemChip({
  item,
  style = "mark",
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
  style?: TierItemStyle;
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
      // How the board finds this mark again after a layout change, so it
      // can be flown from where it was to where it now is. The two
      // layouts are different element trees, so identity has to come from
      // the data rather than from the node.
      data-mark={item.id}
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
      {style === "portrait" ? (
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-xl"
          style={{ opacity: dragging ? 0.3 : 1 }}
        >
          {/* The team colour behind the cut-out, not a grey plate: these
              headshots are transparent PNGs, so whatever is behind them
              IS the chip. Team colour keeps a board of faces readable as
              a board of teams, and covers the gap when one fails. */}
          <span className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${item.accent}, ${item.accent}66)` }} />
          {/* The team's mark, ghosted behind the player.
              Centred by translate rather than by insets: setting all four
              insets on a box that also has a width and a height is
              over-constrained, and CSS resolves that by keeping the size
              and honouring only left/top - which silently shifts the mark
              up and to the left instead of enlarging it. That is what
              made these look off-centre. This way the size and the centre
              are stated separately and cannot fight.
              max-w-none because Tailwind's preflight caps every img at
              max-width:100% of its container, which silently clamped
              this back to the chip's own width - the scale below did
              nothing horizontally and the mark came out 80x96. */}
          {item.backdropUrl && (
            <img
              src={item.backdropUrl}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none object-contain"
              style={{
                width: `${BACKDROP_SCALE * 100}%`,
                height: `${BACKDROP_SCALE * 100}%`,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                opacity: BACKDROP_OPACITY,
              }}
            />
          )}
          {/* object-cover with the frame pushed to the top: ESPN's cut is
              1040x760 with the head in the upper middle, so fitting it
              whole leaves the face about a third of the chip, and
              centring the crop cuts the forehead off. */}
          <img
            src={item.imageUrl}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover object-top pointer-events-none"
          />
          {/* Bottom-anchored so the name sits over the shoulders rather
              than the face, and gradient-backed so it stays legible over
              a light jersey or a dark one. */}
          <span
            className="absolute inset-x-0 bottom-0 flex items-end justify-center whitespace-nowrap px-1 pb-0.5 text-white"
            style={{
              fontFamily: "var(--font-display)",
              // Solved rather than fixed, and never clipped: a surname cut
              // in half names nobody, and this caption exists precisely to
              // tell two faces apart. 0.72em per character is Bungee's
              // rough advance width, so the second term is the largest size
              // at which the whole name still fits the chip.
              fontSize: captionSize(item.label, size),
              lineHeight: 1.1,
              background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 55%, transparent)",
              paddingTop: size * 0.22,
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            }}
          >
            {surname(item.label)}
          </span>
        </span>
      ) : (
        <img
          src={item.imageUrl}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          className="w-full h-full object-contain select-none pointer-events-none transition-opacity duration-150"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))", opacity: dragging ? 0.3 : 1 }}
        />
      )}
    </button>
  );
}

// "Patrick Mahomes" -> "Mahomes". Suffixes ride along with the surname
// ("Michael Penix Jr." -> "Penix Jr.") because dropping one can leave a
// father and son indistinguishable, which is the exact job this caption
// has.
export const SUFFIXES = new Set(["jr.", "sr.", "ii", "iii", "iv", "v"]);

// Slightly larger than the chip so the mark bleeds past the corners
// rather than sitting in the middle of a frame, and faint enough to stay
// behind the player instead of competing with him.
export const BACKDROP_SCALE = 1.2;
export const BACKDROP_OPACITY = 0.22;

// em per character. 0.72 was measured off lowercase; these captions are
// uppercased, and caps run wider - measured at 0.80-0.82 across the
// surnames actually on the board, so the budget uses the worst of them.
export const BUNGEE_ADVANCE = 0.82;
function captionSize(fullName: string, chip: number): number {
  const chars = Math.max(1, surname(fullName).length);
  return Math.max(6, Math.min(chip * 0.17, (chip - 4) / (BUNGEE_ADVANCE * chars)));
}
export function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const tail = parts.length - (SUFFIXES.has(parts[parts.length - 1].toLowerCase()) ? 2 : 1);
  return parts.slice(tail).join(" ");
}

// Sortable wrapper. Kept separate from the presentational chip so the
// share-image preview and the mobile sheet can render a chip without
// pulling in dnd-kit context (useSortable throws outside a DndContext).
export function SortableTierItem({
  item,
  style,
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
  style?: TierItemStyle;
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
        style={style}
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

// The same chip, draggable but not sortable. The pyramid's places are
// fixed slots rather than a list you reorder, so there is nothing for a
// sorting strategy to do there - and letting it run would have every
// mark shuffling sideways to make room in a row that cannot grow.
export function DraggableTierItem({
  item,
  style,
  size,
  selected,
  landed,
  onActivate,
}: {
  item: TierItem;
  style?: TierItemStyle;
  size: number;
  selected?: boolean;
  landed?: boolean;
  onActivate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: "none" }}>
      <TierItemChip
        item={item}
        style={style}
        size={size}
        selected={selected}
        landed={landed}
        onActivate={onActivate}
        dragging={isDragging}
      />
    </div>
  );
}
