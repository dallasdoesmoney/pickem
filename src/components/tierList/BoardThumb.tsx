"use client";

import { useState } from "react";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { TierListState, createInitialState } from "@/lib/tierList";

// Shared by the tier-list hub and the home page, which both front a
// board with the same piece of art - a saved list is recognised by its
// shape long before anyone reads its name, so the two places that
// advertise one have to draw it identically.

// A mark, falling back to a plain tile rather than a broken image - these
// are remote, and a card full of broken icons is worse than a card of
// blanks.
export function Mark({ item, size }: { item: TierItem; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed || !item.imageUrl) {
    return (
      <span
        aria-hidden
        className="shrink-0 rounded-[3px]"
        style={{ width: size, height: size, background: item.accent, opacity: 0.85 }}
      />
    );
  }
  return (
    <img
      src={item.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      crossOrigin="anonymous"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

// A category has no ranking of its own, so its card art is an invented
// one. Seeded off the slug rather than Math.random: the same category
// must draw the same board on the server and on the client, or hydration
// tears - and a preview that reshuffles on every render is just noise.
export function previewFor(template: TierTemplate): TierListState {
  const base = createInitialState(template);
  let seed = 2166136261;
  for (const ch of template.slug) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;

  const ids = template.items.map((i) => i.id);
  for (let i = ids.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  // Uneven on purpose - a real board is never a neat rectangle.
  const perRow = [4, 7, 9, 6, 3];
  const placements: Record<string, string[]> = {};
  let cut = 0;
  base.tiers.forEach((tier, i) => {
    const take = perRow[i] ?? 0;
    placements[tier.id] = ids.slice(cut, cut + take);
    cut += take;
  });
  return { ...base, placements, unranked: ids.slice(cut) };
}

// The board, shrunk to card art. The colours ARE the preview.
export function BoardThumb({
  state,
  template,
  size = 13,
  perRow = 9,
}: {
  state: TierListState;
  template: TierTemplate;
  size?: number;
  perRow?: number;
}) {
  const rows = state.tiers.slice(0, 5);
  return (
    <div className="rounded-lg overflow-hidden bg-black">
      {rows.map((tier, i) => {
        const ids = (state.placements[tier.id] ?? []).slice(0, perRow);
        return (
          <div
            key={tier.id}
            className="flex items-stretch"
            style={{ borderTop: i === 0 ? undefined : "1px solid rgba(255,255,255,0.09)" }}
          >
            <span
              className="shrink-0"
              style={{
                width: size,
                background: tier.accent,
                clipPath: "polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%)",
              }}
            />
            <span
              className="flex-1 min-w-0 flex flex-wrap gap-[3px] p-1 content-start"
              style={{ minHeight: size + 7 }}
            >
              {ids.map((id) => (
                <Mark key={id} item={resolveItem(template, id)} size={size} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
