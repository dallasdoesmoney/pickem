"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { fetchMyFriendIds } from "@/lib/supabase/follows";
import { fetchCreatorUserIds } from "@/lib/supabase/badges";
import { errorMessage } from "@/lib/errorMessage";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import { LevelBadge } from "@/components/LevelBadge";
import { CreatorBadgeIcon } from "@/components/CreatorBadgeIcon";
import { getLevelInfo } from "@/lib/levels";

type BoardView = "global" | "friends";

// Same "here's what you get" pitch shape as the sign-in modal's referral
// preview (three benefit tiles under a headline) - shown in place of an
// empty/inaccessible friends list rather than hiding the Friends tab
// entirely, so tapping it is itself the pitch for creating a profile.
function FriendsPreview({ onSignUp }: { onSignUp: () => void }) {
  const tiles = [
    { icon: "👥", label: "ADD FRIENDS", sub: "Find people you know" },
    { icon: "📊", label: "COMPARE PICKS", sub: "See who's hotter" },
    { icon: "🏆", label: "CLIMB TOGETHER", sub: "Track it all season" },
  ];
  return (
    <div className="flex flex-col items-center text-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-6 py-8">
      <span className="text-3xl mb-1">👥</span>
      <p className="text-base text-white font-medium">Want to compare with friends?</p>
      <p className="text-sm text-white/50 max-w-xs">Create a free profile to add friends and see how your picks stack up against theirs, every week.</p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm mt-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-[10px] font-semibold mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
              {t.label}
            </span>
            <span className="text-[8.5px] text-white/40">{t.sub}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onSignUp}
        className="mt-5 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
        style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
      >
        CREATE A PROFILE
      </button>
    </div>
  );
}

// Global/friends leaderboard, self-contained (fetches its own data) so it
// can drop into any page - the standalone /leaderboard page and the
// weekly picks page's Leaderboard tab both render this exact component
// rather than keeping two copies of the same list/toggle/modal in sync.
export function LeaderboardBoard() {
  const { user } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string> | null>(null);
  const [creatorIds, setCreatorIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<BoardView>("global");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then((fetched) => {
        setRows(fetched);
        fetchCreatorUserIds(fetched.map((r) => r.user_id))
          .then(setCreatorIds)
          .catch(() => {});
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const reloadFriends = useCallback(() => {
    if (!user) return;
    fetchMyFriendIds(user.id)
      .then(setFriendIds)
      .catch((err) => setError(errorMessage(err)));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFriendIds(null);
      if (view === "friends") setView("global");
      return;
    }
    reloadFriends();
  }, [user, reloadFriends]);

  const showFriendsPreview = !user && view === "friends";

  const visibleRows = useMemo(() => {
    if (!rows) return null;
    if (view === "global" || !user) return rows;
    return rows.filter((r) => r.user_id === user.id || friendIds?.has(r.user_id));
  }, [rows, view, user, friendIds]);

  return (
    <>
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
          {(["global", "friends"] as BoardView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition-colors ${
                view === v ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {showFriendsPreview ? (
        <FriendsPreview onSignUp={() => requestSignIn()} />
      ) : !visibleRows ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <div className="text-4xl mb-3">🏈</div>
          <p className="text-sm">
            {view === "friends" ? "No friends yet — add some from their profile page." : "No records yet — check back once a week’s results are published."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleRows.map((row, i) => {
            const isMe = row.user_id === user?.id;
            const label = row.display_name || row.username;
            const rankColor = getLevelInfo(row.total_points).rankColor;
            return (
              <button
                key={row.user_id}
                type="button"
                onClick={() => setSelected(row)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors text-left ${
                  isMe ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-[#101f3d] hover:bg-[#152546] hover:border-white/20"
                }`}
              >
                <span className="w-6 text-center text-sm text-white/40" style={{ fontFamily: "var(--font-display)" }}>
                  {i + 1}
                </span>
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                    style={{ boxShadow: `0 0 0 2px ${rankColor}, 0 0 8px -2px ${rankColor}` }}
                  />
                ) : (
                  <span
                    className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs"
                    style={{ boxShadow: `0 0 0 2px ${rankColor}, 0 0 8px -2px ${rankColor}` }}
                  >
                    {label.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-sm truncate">
                    {label}
                    {isMe && <span className="text-white/40"> (you)</span>}
                  </span>
                  <LevelBadge totalPoints={row.total_points} />
                  {creatorIds.has(row.user_id) && <CreatorBadgeIcon size="sm" />}
                </span>
                <span className="text-sm shrink-0" style={{ fontFamily: "var(--font-display)" }}>
                  {row.correct}-{row.graded - row.correct}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <PlayerProfileModal row={selected} myId={user?.id} onClose={() => setSelected(null)} onFollowChange={reloadFriends} />
      {signInModal}
    </>
  );
}
