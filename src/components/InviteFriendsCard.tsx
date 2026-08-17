"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { AchievementDef } from "@/data/achievements";
import { AchievementCard } from "@/components/AchievementCard";

// Text/link sharing only - no image, no clipboard-then-deep-link tricks -
// so navigator.share (or a plain copy fallback) works everywhere, unlike
// the picks share flow which is inherently more fragile since it's
// sharing an actual image.
export function InviteFriendsCard({ def, username, referralCount }: { def: AchievementDef; username: string | null; referralCount: number }) {
  const [copied, setCopied] = useState(false);
  const link = username ? `${window.location.origin}/?ref=${username}` : null;

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    posthog.capture("referral_link_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Sideline Brew", text: "Come make some picks with me on Sideline Brew!", url: link });
        posthog.capture("referral_link_shared", { share_method: "native_share" });
      } catch {
        // User canceled or share failed - nothing to recover, same as the picks share flow.
      }
    } else {
      handleCopy();
    }
  }

  return (
    <AchievementCard icon={def.icon} label={def.label} description={def.description} pointsEach={def.pointsEach} pointsLabel="PTS PER REFERRAL" unitLabel={def.unitLabel} doneCount={referralCount}>
      {!username ? (
        <p className="text-xs text-white/50 mt-1">Set a username first to get your personal invite link.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 truncate">{link}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-full px-4 py-2 text-xs border border-white/15 hover:border-white/30 text-white/80 hover:text-white transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {copied ? "COPIED" : "COPY LINK"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-full px-4 py-2 text-xs active:scale-95 transition-transform duration-150"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
            >
              SHARE
            </button>
          </div>
        </div>
      )}
    </AchievementCard>
  );
}
