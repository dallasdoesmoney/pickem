"use client";

import { useEffect, useState } from "react";
import { fetchUserBadges } from "@/lib/supabase/badges";
import { badgeDef, BADGE_CATALOG } from "@/lib/badgeCatalog";

const CREATOR_KEY = "creator";

// Renders nothing until award logic for any of these exists and a row
// shows up in user_badges - no empty-state placeholder, so a profile
// with none just looks like today's profile.
export function PlayerBadges({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<string[] | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);

  useEffect(() => {
    setKeys(null);
    fetchUserBadges(userId)
      .then((rows) => setKeys(rows.map((r) => r.badge_key)))
      .catch(() => setKeys([]));
  }, [userId]);

  if (!keys || keys.length === 0) return null;

  const hasCreator = keys.includes(CREATOR_KEY);
  const otherKeys = keys.filter((k) => k !== CREATOR_KEY);
  const creatorDef = BADGE_CATALOG[CREATOR_KEY];

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
      {hasCreator && (
        <button
          type="button"
          onClick={() => setExplainerOpen(true)}
          aria-label={`${creatorDef.label} badge - tap to learn more`}
          title={creatorDef.label}
          className="h-6 w-6 rounded-full flex items-center justify-center text-sm shrink-0 active:scale-90 transition-transform"
          style={{ background: creatorDef.color }}
        >
          {creatorDef.icon}
        </button>
      )}
      {otherKeys.map((key) => {
        const def = badgeDef(key);
        return (
          <span
            key={key}
            title={def.label}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
            style={{ fontFamily: "var(--font-display)", color: def.color, borderColor: `${def.color}55`, background: `${def.color}1a` }}
          >
            <span>{def.icon}</span>
            {def.label}
          </span>
        );
      })}

      {explainerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setExplainerOpen(false)} />
          <div className="relative w-full max-w-xs rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 text-center">
            <span
              className="inline-flex h-14 w-14 rounded-full items-center justify-center text-2xl mb-3"
              style={{ background: creatorDef.color }}
            >
              {creatorDef.icon}
            </span>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {creatorDef.label.toUpperCase()}
            </h2>
            <p className="text-sm text-white/60 mt-2">This account streams or makes content about Sideline Brew.</p>
            <button
              type="button"
              onClick={() => setExplainerOpen(false)}
              className="mt-5 w-full rounded-full px-5 py-2.5 text-sm border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
