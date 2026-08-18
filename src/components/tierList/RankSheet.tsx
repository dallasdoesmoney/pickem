"use client";

import { useEffect } from "react";
import { TierItem } from "@/data/tierTemplates";
import { Tier, tierLabelFor } from "@/lib/tierList";

// The primary mobile ranking interaction: tap a team, pick a tier, done.
// Sits at z-[60] because the app's sticky header is z-50 - a sheet that
// slid up under the header would look broken.
export function RankSheet({
  item,
  tiers,
  currentTierId,
  onPick,
  onUnrank,
  onClose,
}: {
  item: TierItem | null;
  tiers: Tier[];
  currentTierId: string | null;
  onPick: (tierId: string) => void;
  onUnrank: () => void;
  onClose: () => void;
}) {
  // No other modal in this app handles Escape, but this one is reachable
  // by keyboard from the item grid, so leaving it trapped would be worse
  // than being inconsistent.
  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Rank ${item.label}`}>
      <div className="absolute inset-0 bg-black/60 tier-anim-scrim" onClick={onClose} />

      <div
        className="tier-anim-sheet relative w-full max-w-md rounded-t-3xl border-t border-x border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* Grab handle - reads as "this came from the bottom edge and can
            go back there", even though dismissal is tap-scrim/Escape. */}
        <div className="flex justify-center pt-3 pb-1">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center gap-3 px-5 pt-2 pb-4">
          <span
            className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0 border"
            style={{ background: `${item.accent}2e`, borderColor: `${item.accent}66` }}
          >
            <img src={item.imageUrl} alt="" crossOrigin="anonymous" className="h-9 w-9 object-contain" />
          </span>
          <div className="min-w-0">
            <div className="text-white text-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {item.label}
            </div>
            <div className="text-white/45 text-xs mt-0.5">Where do they belong?</div>
          </div>
        </div>

        <div className="px-5 grid grid-cols-3 gap-2">
          {tiers.map((tier, i) => {
            const isCurrent = tier.id === currentTierId;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => onPick(tier.id)}
                aria-label={`Move ${item.label} to ${tierLabelFor(tier, i)}`}
                aria-pressed={isCurrent}
                className="rounded-xl py-3 text-center transition-transform duration-150 active:scale-95 border-2 truncate px-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: tierLabelFor(tier, i).length > 4 ? 13 : 20,
                  color: isCurrent ? "#0e1b33" : tier.accent,
                  background: isCurrent ? tier.accent : `${tier.accent}1f`,
                  borderColor: tier.accent,
                }}
              >
                {tierLabelFor(tier, i)}
              </button>
            );
          })}
        </div>

        <div className="px-5 pt-4 flex gap-3">
          {currentTierId && (
            <button
              type="button"
              onClick={onUnrank}
              className="flex-1 rounded-full px-4 py-2.5 text-xs border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              UNRANK
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full px-4 py-2.5 text-xs border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
