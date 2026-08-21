"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { Tier, MAX_TIER_LABEL, tierLabelFor } from "@/lib/tierList";
import { SortableTierItem } from "@/components/tierList/TierItemChip";
import { TIER_LABEL_FONT, pickTierLabelSize } from "@/components/tierList/tierLabel";

// The label's own ink, reused for the marks that say it can be edited -
// a dashed inset and a pencil in any other colour would read as a
// second thing sitting on the rail rather than as part of the label.
const INK = TIER_LABEL_FONT.color;

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
  onStartEditing,
  onActivate,
  active,
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
  // Double-clicking a name is the way into edit mode from anywhere on
  // the board, so the row has to be able to ask for it.
  onStartEditing: () => void;
  // Fired when this row's name takes focus, so the board can follow
  // which tier is being worked on.
  onActivate: () => void;
  // The one tier currently being edited. Its name takes the caret, and
  // its controls are the only ones on screen: showing move and delete on
  // every row at once pushed the marks around on a phone, and edit mode
  // has to look like the list you are editing.
  active: boolean;
}) {
  // Registered so an empty row is still a drop target; the lit state
  // arrives as a prop instead (see `hot` above).
  const { setNodeRef } = useDroppable({ id: `tier:${tier.id}` });
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  // A textarea has no natural height, and the rail centres what is in it,
  // so the field is grown to exactly its own content each time it
  // changes. Without this a wrapped name would scroll inside a one-line
  // box instead of filling the rail the way the label does.
  const fit = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    fit(el);
    if (active) el.focus();
  }, [active, editing]);
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
      className={`flex items-stretch transition-[background,box-shadow] duration-150 ${cascading ? "tier-anim-cascade" : ""}`}
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
        // Double-click is what opens edit mode, from anywhere on the
        // board. A tier name is a thing you look at far more often than
        // you change, so the way in is the gesture people already try on
        // a label rather than a control the board has to carry all the
        // time.
        onDoubleClick={onStartEditing}
        className="relative shrink-0 flex items-center justify-center transition-[filter] duration-150"
        style={{
          width: hot ? railWidth + 14 : railWidth,
          background: tier.accent,
          filter: hot ? "brightness(1.18)" : undefined,
          paddingLeft: 6,
          paddingRight: 6,
          overflow: "hidden",
          cursor: editing ? "text" : undefined,
        }}
      >
        {editing ? (
          <textarea
            ref={fieldRef}
            defaultValue={tier.label}
            onChange={(e) => {
              onRename(e.target.value);
              fit(e.currentTarget);
            }}
            onFocus={(e) => {
              setFocused(true);
              onActivate();
              const end = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(end, end);
              fit(e.currentTarget);
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              // A tier name is one line of text however many lines it
              // wraps to, so Enter commits rather than inserting a break.
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                onCommitRename();
              }
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            rows={1}
            maxLength={MAX_TIER_LABEL}
            spellCheck={false}
            aria-label={`Rename ${tierLabelFor(tier, index)} tier`}
            // Typed at exactly the size and in exactly the place it will
            // be read, so what you are looking at while you type IS the
            // result. A textarea rather than an input because the rail
            // wraps: an input would scroll a long name sideways instead.
            className="w-full min-w-0 resize-none overflow-hidden bg-transparent text-center leading-[1.18] uppercase outline-none [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
            style={{
              ...TIER_LABEL_FONT,
              fontSize: pickTierLabelSize(tier.label || tierLabelFor(tier, index)),
              caretColor: TIER_LABEL_FONT.color,
            }}
          />
        ) : (
          <span
            // leading-none stacks wrapped lines right on top of each
            // other; a name long enough to wrap needs the gap back.
            // w-full/min-w-0 are what make wrapping actually bite: as a
            // bare flex item the span sizes to its content instead, so a
            // long name overflowed the rail.
            className="w-full min-w-0 text-center leading-[1.18] uppercase [overflow-wrap:normal] [word-break:normal] [hyphens:none]"
            style={{ ...TIER_LABEL_FONT, fontSize: pickTierLabelSize(tierLabelFor(tier, index)) }}
          >
            {tierLabelFor(tier, index)}
          </span>
        )}

        {/* What says the box is editable, and nothing more: a dashed
            inset that goes solid on the one you are in, and a pencil that
            steps out of the way once you are typing. Drawn over the rail
            rather than around it so the row's own geometry never moves -
            edit mode has to look like the list you are editing. */}
        {editing && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-lg transition-[border] duration-150"
              style={{
                inset: 4,
                border: focused
                  ? `2px solid ${INK}d9`
                  : `1.5px dashed ${INK}61`,
              }}
            />
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="pointer-events-none absolute transition-opacity duration-150"
              style={{ top: 7, right: 8, width: 11, height: 11, opacity: focused ? 0 : 0.5 }}
              fill="none"
              stroke={INK}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </>
        )}
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
      {/* This tier's own controls, at the end of its row, and only on the
          tier being edited. They were in the rail once, where three
          buttons crushed into 64px was the worst part of edit mode; out
          here they get full-size targets and the rail only has to hold a
          name. On every row at once they cost a phone two marks a line,
          which is the board rearranging itself to be edited. */}
      {editing && active && (
        <div className="shrink-0 flex items-center gap-1.5 pr-2.5 pl-1">
          <RailButton label="Move tier up" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <path d="M18 15l-6-6-6 6" />
          </RailButton>
          <RailButton label="Move tier down" disabled={!canMoveDown} onClick={() => onMove(1)}>
            <path d="M6 9l6 6 6-6" />
          </RailButton>
          <RailButton label={`Delete ${tierLabelFor(tier, index)} tier`} disabled={!canDelete} onClick={onDelete} danger>
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
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
