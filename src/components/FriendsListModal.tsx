"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyFriends, FriendRow } from "@/lib/supabase/follows";
import { errorMessage } from "@/lib/errorMessage";

export function FriendsListModal({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function load() {
    setFriends(null);
    setError(null);
    fetchMyFriends(userId)
      .then(setFriends)
      .catch((err) => {
        console.error("Failed to load friends", errorMessage(err));
        setError("Couldn't load your friends.");
      });
  }

  useEffect(() => {
    if (!open) return;
    setQuery("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = friends?.filter((f) => (f.display_name || f.username).toLowerCase().includes(q) || f.username.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            FRIENDS
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

        {friends && friends.length > 0 && (
          <div className="px-5 pb-3 shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-2">
          {error ? (
            <div className="text-center py-10">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : !friends ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10 text-white/50">
              <div className="text-3xl mb-3">👥</div>
              <p className="text-sm">No friends yet - add some from standings.</p>
            </div>
          ) : filtered && filtered.length === 0 ? (
            <p className="text-center py-10 text-sm text-white/40">No friends match &ldquo;{query}&rdquo;.</p>
          ) : (
            filtered?.map((f) => {
              const label = f.display_name || f.username;
              return (
                <Link
                  key={f.user_id}
                  href={`/leaderboard/${f.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">{label.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{label}</div>
                    <div className="text-[11px] text-white/40 truncate">@{f.username}</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
