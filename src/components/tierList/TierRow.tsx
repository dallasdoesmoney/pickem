"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { Tier, MAX_TIER_LABEL, tierLabelFor } from "@/lib/tierList";
import { SortableTierItem } from "@/components/tierList/TierItemChip";

export function TierRow({
  tier,
  index,
  itemIds,
  template,
  chipSize,
  editing,
  selectedItemId,
  landedItemId,
  isDropTarget,
  canMoveUp,
  canMoveDown,
  canDelete,
  onRename,
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
  editing: boolean;
  selectedItemId: string | null;
  landedItemId: string | null;
  isDropTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onRename: (label: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onItemActivate: (item: TierItem) => void;
  onPlaceSelected: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier:${tier.id}` });
  const items = itemIds.map((id) => resolveItem(template, id));
  const active = isOver || isDropTarget;

  return (
    <div
      className="flex items-stretch rounded-2xl overflow-hidden border transition-colors duration-150"
      style={{
        borderColor: active ? tier.accent : "rgba(255,255,255,0.10)",
        background: active ? `${tier.accent}14` : "rgba(255,255,255,0.03)",
      }}
    >
      {/* Label rail. Always visible, always the tier's colour - it's the
          only thing telling you which row you're looking at once the
          labels are renamed to something arbitrary. */}
      <div
        className="shrink-0 flex flex-col items-center justify-center gap-1 px-1 py-2"
        style={{ width: 64, background: `${tier.accent}26`, borderRight: `2px solid ${tier.accent}` }}
      >
        {editing ? (
          <input
            value={tier.label}
            onChange={(e) => onRename(e.target.value)}
            maxLength={MAX_TIER_LABEL}
            aria-label={`Rename ${tierLabelFor(tier, index)} tier`}
            className="w-full bg-black/30 rounded-md text-center text-white text-sm py-1 outline-none border border-white/20 focus:border-white/50"
            style={{ fontFamily: "var(--font-display)" }}
          />
        ) : (
          <span
            className="text-center leading-none break-all"
            style={{
              fontFamily: "var(--font-display)",
              color: tier.accent,
              // Long custom labels shrink rather than blowing out the
              // rail's fixed width.
              fontSize: tierLabelFor(tier, index).length > 4 ? 13 : 22,
            }}
          >
            {tierLabelFor(tier, index)}
          </span>
        )}

        {editing && (
          <div className="flex items-center gap-0.5 mt-0.5">
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

      {/* Drop zone. min-h keeps an empty tier a real target rather than a
          hairline you have to aim at. */}
      <div
        ref={setNodeRef}
        onClick={selectedItemId ? onPlaceSelected : undefined}
        className="flex-1 min-w-0 p-2 flex flex-wrap gap-1.5 content-start"
        style={{ minHeight: chipSize + 16, cursor: selectedItemId ? "pointer" : undefined }}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {items.map((item) => (
            <SortableTierItem
              key={item.id}
              item={item}
              size={chipSize}
              selected={selectedItemId === item.id}
              landed={landedItemId === item.id}
              onActivate={() => onItemActivate(item)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <span
            className="self-center text-[11px] tracking-wide px-1"
            style={{ color: active ? tier.accent : "rgba(255,255,255,0.28)" }}
          >
            {selectedItemId ? "TAP TO PLACE HERE" : active ? "DROP HERE" : "EMPTY"}
          </span>
        )}
      </div>
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
      className={`h-6 w-6 rounded-full border border-white/20 flex items-center justify-center transition-colors disabled:opacity-25 ${
        danger ? "text-red-300 hover:text-red-200" : "text-white/60 hover:text-white"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
