"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { Tier, MAX_TIER_LABEL, tierLabelFor } from "@/lib/tierList";
import { SortableTierItem } from "@/components/tierList/TierItemChip";
import { TIER_LABEL_FONT, tierLabelSize } from "@/components/tierList/tierLabel";

export function TierRow({
  tier,
  index,
  itemIds,
  template,
  chipSize,
  railWidth,
  first,
  cascading,
  sweeping,
  editing,
  hot,
  selectedItemId,
  landedItemId,
  isDropTarget,
  canMoveUp,
  canMoveDown,
  canDelete,
  onRename,
  onCommitRename,
  onMove,
  onDelete,
  onItemActivate,
  onPlaceSelected,
}: {
  tier: Tier;
  index: number;
  itemIds: string[];
  template: TierTemplate;
  chipSize: number;
  railWidth: number;
  // Only the separator differs; the first row has the board's edge above it.
  first: boolean;
  // Set for a beat when the board fills, so the rows can light in sequence.
  cascading: boolean;
  // Set while a reset is clearing out, so the chips can fly before they go.
  sweeping: boolean;
  editing: boolean;
  // Resolved by the page, not by this row's own isOver: once a row has
  // items, dnd-kit reports the item under the cursor as the drop target
  // rather than the row, so isOver only ever fired on empty rows.
  hot: boolean;
  selectedItemId: string | null;
  landedItemId: string | null;
  isDropTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onRename: (label: string) => void;
  // Enter in the rename field is a commit, not just a blur - it leaves
  // edit mode entirely, which is what pressing Enter in a small inline
  // field is universally taken to mean.
  onCommitRename: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onItemActivate: (item: TierItem) => void;
  onPlaceSelected: () => void;
}) {
  // Registered so an empty row is still a drop target; the lit state
  // arrives as a prop instead (see `hot` above).
  const { setNodeRef } = useDroppable({ id: `tier:${tier.id}` });
  const items = itemIds.map((id) => resolveItem(template, id));
  // `armed` is every row while an item is selected for tap-to-place -
  // giving all six a full glow at once would just be noise.
  const armed = isDropTarget && !hot;

  return (
    <div
      // No radius, no gap, no border of its own: rows butt straight into
      // each other and the board clips the outer corners, so the whole
      // thing reads as one object with a continuous colour column down
      // the side. A hairline is all that separates one tier from the next.
      // Tagged so the board can fold this row back out of the pyramid's
      // slope when the view returns. The row is a fresh element then, so
      // the animation has to find it by position rather than by identity.
      data-tier-row={index}
      className={`flex flex-wrap items-stretch transition-[background,box-shadow] duration-150 ${cascading ? "tier-anim-cascade" : ""}`}
      style={{
        // Pure black. It's the highest-contrast ground the logos can sit
        // on, and with 32 marks up there they should be the loudest thing
        // on the page.
        background: hot ? `${tier.accent}2e` : armed ? `${tier.accent}12` : "#000000",
        // Inset rather than an outer ring - the board clips overflow, so an
        // outer shadow would be sliced off at the top and bottom rows.
        boxShadow: hot
          ? `inset 0 0 0 2px ${tier.accent}, inset 0 0 34px -6px ${tier.accent}`
          : undefined,
        borderTop: first ? undefined : "1px solid rgba(255,255,255,0.09)",
        // Staggered so the light runs down the board rather than the whole
        // thing blinking at once.
        animationDelay: cascading ? `${index * 90}ms` : undefined,
      }}
    >
      {/* Label rail. A plain block of accent, not a chevron: the point ate
          the right-hand sixth of the rail, which is the part a wrapped
          name needs most, and stacked six of them into an arrow motif
          that fought the marks for attention. Solid accent with dark
          type - at this size a tinted rail with coloured text loses the
          letter entirely. It still drives forward on drag-over, which
          reads as the row reaching out to take the item. */}
      <div
        data-tier-rail
        className="shrink-0 flex items-center justify-center transition-[width,filter] duration-150"
        style={{
          // No longer widens to edit: the field is out in the row now,
          // so the rail has nothing to make room for.
          width: hot ? railWidth + 14 : railWidth,
          background: tier.accent,
          filter: hot ? "brightness(1.18)" : undefined,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        <span
          // leading-none stacks wrapped lines right on top of each
          // other; a name long enough to wrap needs the gap back.
          // w-full/min-w-0 are what make wrapping actually bite: as a bare
          // flex item the span sizes to its content instead, so a long
          // name overflowed the rail.
          className="w-full min-w-0 text-center leading-[1.18] uppercase [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
          style={{
            ...TIER_LABEL_FONT,
            // Steps down as the name grows - far enough that its longest
            // WORD fits the rail, because a word split across two lines
            // is not a shorter word, it is two wrong ones.
            fontSize: tierLabelSize(tierLabelFor(tier, index), railWidth - 12, chipSize + 16),
          }}
        >
          {tierLabelFor(tier, index)}
        </span>
      </div>

      {/* Drop zone. min-h keeps an empty tier a real target rather than a
          hairline you have to aim at. */}
      <div
        ref={setNodeRef}
        onClick={selectedItemId ? onPlaceSelected : undefined}
        className="flex-1 min-w-0 p-2 flex flex-wrap gap-1.5 content-start"
        style={{ minHeight: chipSize + 16, cursor: selectedItemId ? "pointer" : undefined }}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {items.map((item, i) => (
            <SortableTierItem
              key={item.id}
              item={item}
              style={template.itemStyle}
              size={chipSize}
              selected={selectedItemId === item.id}
              landed={landedItemId === item.id}
              sweeping={sweeping}
              sweepIndex={i}
              onActivate={() => onItemActivate(item)}
            />
          ))}
        </SortableContext>

        {/* No "EMPTY" placeholder - an empty row is self-evidently empty.
            Only the actionable hints render. */}
        {items.length === 0 && (selectedItemId || hot) && (
          <span
            className="self-center text-[11px] tracking-wide px-1 transition-colors duration-150"
            style={{ color: tier.accent }}
          >
            {selectedItemId ? "TAP TO PLACE HERE" : "DROP HERE"}
          </span>
        )}
      </div>

      {/* Tier controls live at the end of the row, not inside the rail.
          Three buttons crushed into a 64px rail under the label was the
          worst part of edit mode; out here they get full-size targets and
          the rail only has to hold a name. */}
      {/* Everything about editing a tier lives on its own line under the
          row: the name, and the three buttons that move or delete it.
          Both were in the rail once. The rail is as narrow as it is on
          purpose, and a 16px field inside it - 16 so iOS doesn't zoom the
          page on focus - left about six characters visible, so you could
          not read what you were typing. Down here the field gets real
          width, and the rail beside it goes on showing the name at its
          true size as you type. */}
      {editing && (
        // w-full as well as basis-full: basis alone resolved to the
          // line's max-content in Chromium here, which pushed the delete
          // button off the right edge of the board.
          <div className="basis-full w-full min-w-0 flex items-center gap-2 px-2 pb-2">
          <input
            value={tier.label}
            onChange={(e) => onRename(e.target.value)}
            maxLength={MAX_TIER_LABEL}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                onCommitRename();
              }
            }}
            // Caret to the end rather than wherever the tap landed. The
            // field used to be centre-aligned, so tapping it usually put
            // the caret in front of the name and backspace did nothing.
            onFocus={(e) => {
              const end = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(end, end);
            }}
            placeholder="Name this tier"
            aria-label={`Rename ${tierLabelFor(tier, index)} tier`}
            className="flex-1 min-w-0 rounded-lg bg-black/45 border border-white/15 focus:border-white/45 px-3 py-2 text-white placeholder:text-white/30 outline-none"
            style={{ ...TIER_LABEL_FONT, color: "#ffffff", fontSize: 16 }}
          />
          <RailButton label="Move tier up" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <path d="M18 15l-6-6-6 6" />
          </RailButton>
          <RailButton label="Move tier down" disabled={!canMoveDown} onClick={() => onMove(1)}>
            <path d="M6 9l6 6 6-6" />
          </RailButton>
          <RailButton label={`Delete ${tierLabelFor(tier, index)} tier`} disabled={!canDelete} onClick={onDelete} danger>
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
          </RailButton>
        </div>
      )}
    </div>
  );
}

function RailButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-25 shrink-0 ${
        danger
          ? "border-red-400/30 text-red-300 hover:text-red-200 hover:border-red-400/60"
          : "border-white/15 text-white/60 hover:text-white hover:border-white/35"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
