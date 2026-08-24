"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { AchievementDef, DISCORD_INVITE_URL } from "@/data/achievements";
import { AchievementCard } from "@/components/AchievementCard";
import { claimDiscordJoin } from "@/lib/supabase/discord";
import { errorMessage } from "@/lib/errorMessage";

// A one-off reward, so this card has two states rather than a count:
// there is a button, or there is a tick.
//
// The claim fires alongside opening the invite, not after coming back -
// nothing comes back. The tab that opens Discord is the last thing this
// page hears about, so waiting for a return trip would mean the points
// were never paid.
//
// window.open BEFORE the await, deliberately: a popup blocker allows a
// window opened during the click's own turn and blocks one opened after
// an await resolves, so awaiting first would silently swallow the invite
// on some browsers and pay for a link that never opened.
export function JoinDiscordCard({ def, claimed, onClaimed }: { def: AchievementDef; claimed: boolean; onClaimed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setError(null);
    setBusy(true);
    window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
    try {
      const result = await claimDiscordJoin();
      posthog.capture("discord_join_clicked", { awarded: result.awarded });
      onClaimed();
    } catch (err) {
      // The invite is already open at this point, so this is only about
      // the points - say so rather than implying the link failed.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AchievementCard
      icon={def.icon}
      label={def.label}
      description={def.description}
      pointsEach={def.pointsEach}
      pointsLabel="PTS, ONCE"
      unitLabel={def.unitLabel}
      doneCount={claimed ? 1 : 0}
      totalCount={1}
      note={claimed ? <span className="text-emerald-400">Claimed</span> : undefined}
    >
      {claimed ? (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-xs text-white/50">You&apos;ve already claimed this one. The door is still open though.</p>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-4 py-2 text-xs text-center border border-white/15 hover:border-white/30 text-white/80 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            OPEN DISCORD
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          {error && <p className="text-xs text-red-400">Couldn&apos;t award the points: {error}</p>}
          <button
            type="button"
            onClick={handleJoin}
            disabled={busy}
            className="rounded-full px-4 py-2 text-xs active:scale-95 transition-transform duration-150 disabled:opacity-60"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #818cf8, #5865F2)", color: "#0e1b33" }}
          >
            {busy ? "OPENING…" : `JOIN THE DISCORD — ${def.pointsEach} PTS`}
          </button>
        </div>
      )}
    </AchievementCard>
  );
}
