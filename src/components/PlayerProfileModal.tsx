"use client";

import { useState } from "react";
import Link from "next/link";
import { LeaderboardRow } from "@/lib/supabase/leaderboard";
import { FriendButton } from "@/components/FriendButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelListModal } from "@/components/LevelListModal";

// Same overlay/panel styling as useConfirmDialog, reused here so a
// leaderboard click surfaces a player's record without leaving the
// leaderboard - the full /leaderboard/[username] page still exists
// underneath for direct/shareable links (e.g. from notifications).
export function PlayerProfileModal({
  row,
  myId,
  onClose,
  onFriendshipChange,
}: {
  row: LeaderboardRow | null;
  myId?: string;
  onClose: () => void;
  onFriendshipChange?: () => void;
}) {
  const [levelModalOpen, setLevelModalOpen] = useState(false);

  if (!row) return null;
  const label = row.display_name || row.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 flex flex-col items-center">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        {row.avatar_url ? (
          <img src={row.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover border-2 border-white/20 mt-2" />
        ) : (
          <span className="h-24 w-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl mt-2">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex items-center gap-2 mt-4">
          <h2 className="text-2xl text-center" style={{ fontFamily: "var(--font-display)" }}>
            {label}
          </h2>
          <LevelBadge totalPoints={row.total_points} size="lg" />
        </div>
        <button type="button" onClick={() => setLevelModalOpen(true)} className="text-[11px] text-white/35 hover:text-white/60 transition-colors">
          View all levels &rarr;
        </button>
        <p className="text-white/45 text-sm mt-1">@{row.username}</p>
        <PlayerBadges userId={row.user_id} />

        <div
          className="mt-6 rounded-full border-2 border-emerald-400 text-center flex flex-col items-center justify-center w-[150px] h-[92px]"
          style={{ background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
        >
          <div className="text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
            {row.correct}-{row.graded - row.correct}
          </div>
          <div className="text-[10px] text-white/55 mt-1.5 tracking-wide">SEASON RECORD</div>
        </div>

        {myId && myId !== row.user_id && (
          <div className="mt-6">
            <FriendButton myId={myId} otherId={row.user_id} onChange={onFriendshipChange} />
          </div>
        )}

        <Link href={`/leaderboard/${row.username}`} onClick={onClose} className="text-xs text-white/40 hover:text-white/70 transition-colors mt-6">
          View full profile page &rarr;
        </Link>
      </div>

      <LevelListModal open={levelModalOpen} totalPoints={row.total_points} onClose={() => setLevelModalOpen(false)} />
    </div>
  );
}
