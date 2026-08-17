"use client";

import { LevelLadder } from "@/components/LevelLadder";

// For viewing someone else's ladder (PlayerProfileModal, the player
// page) - no achievements toggle here, since achievements are private to
// your own account. See LevelsAchievementsModal for the "my own profile"
// version with that toggle.
export function LevelListModal({ open, totalPoints, onClose }: { open: boolean; totalPoints?: number; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            ALL LEVELS
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-4">
          <LevelLadder totalPoints={totalPoints} />
        </div>
      </div>
    </div>
  );
}
