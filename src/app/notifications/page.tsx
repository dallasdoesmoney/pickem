"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchIncomingRequests, acceptFriendRequest, removeFriendship, fetchMyFriendIds, FriendRequest } from "@/lib/supabase/friends";
import { fetchAllNotifications, markAllNotificationsRead, NotificationRow } from "@/lib/supabase/notifications";
import { fetchProfilesByIds, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { buildActivityGroups, relativeTime, ActivityGroup } from "@/lib/activity";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";
import { errorMessage } from "@/lib/errorMessage";

const PENDING_PREVIEW_COUNT = 5;

function pluralOthers(n: number): string {
  return n === 1 ? "1 other" : `${n} others`;
}

function describeGroup(group: ActivityGroup, actors: (Pick<LeaderboardRow, "username" | "display_name" | "avatar_url"> | undefined)[]) {
  const first = actors[0];
  const firstLabel = first?.display_name || first?.username || "Someone";
  const extra = group.actorIds.length - 1;
  // "Lucas" or "Lucas and 3 others" - built once, reused for both the
  // subject form (friend_accepted, referral_joined) and the possessive
  // form (friend_request_accepted_by_me) below.
  const namePhrase = extra > 0 ? `${firstLabel} and ${pluralOthers(extra)}` : firstLabel;

  if (group.kind === "level_up") {
    const entry = ALL_LEVELS[(group.level ?? 1) - 1];
    return {
      text: entry ? `You reached Level ${entry.level} — ${entry.rankName} ${subLevelRoman(entry.subLevel)}!` : "You leveled up!",
      accentColor: entry?.rankColor ?? "#c084fc",
      avatarUrl: null as string | null,
      initial: entry?.rankEmoji ?? "🎉",
    };
  }
  if (group.kind === "friend_accepted") {
    return {
      text: `${namePhrase} accepted your friend request${extra > 0 ? "s" : ""}`,
      accentColor: "#4ade80",
      avatarUrl: first?.avatar_url ?? null,
      initial: firstLabel.charAt(0).toUpperCase(),
    };
  }
  if (group.kind === "friend_request_accepted_by_me") {
    return {
      text: `You accepted ${namePhrase}${extra > 0 ? "’" : "’s"} friend request${extra > 0 ? "s" : ""}`,
      accentColor: "#38bdf8",
      avatarUrl: first?.avatar_url ?? null,
      initial: firstLabel.charAt(0).toUpperCase(),
    };
  }
  // referral_joined
  return {
    text: `${namePhrase} joined using your invite!`,
    accentColor: "#f59e0b",
    avatarUrl: first?.avatar_url ?? null,
    initial: firstLabel.charAt(0).toUpperCase(),
  };
}

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<FriendRequest[] | null>(null);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string> | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/account");
      return;
    }
    Promise.all([fetchIncomingRequests(user.id), fetchAllNotifications(user.id), fetchMyFriendIds(user.id)])
      .then(([incoming, allNotifications, friends]) => {
        setRequests(incoming);
        setNotifications(allNotifications);
        setFriendIds(friends);
        markAllNotificationsRead(user.id).catch((err) => console.error("Failed to mark notifications read", err));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [user, loading, router]);

  const pendingRequesterIds = useMemo(() => new Set((requests ?? []).map((r) => r.requester_id)), [requests]);

  const groups = useMemo(() => {
    if (!notifications || !friendIds) return [];
    return buildActivityGroups(notifications, { pendingRequesterIds, friendIds });
  }, [notifications, friendIds, pendingRequesterIds]);

  useEffect(() => {
    const actorIds = groups.flatMap((g) => g.actorIds).filter((id) => !profiles.has(id));
    if (actorIds.length === 0) return;
    fetchProfilesByIds(actorIds)
      .then((fetched) => setProfiles((prev) => new Map([...prev, ...fetched])))
      .catch((err) => console.error("Failed to resolve activity actors", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  async function handleAccept(req: FriendRequest) {
    setBusyId(req.id);
    const { error } = await acceptFriendRequest(req.id);
    setBusyId(null);
    if (error) {
      setError(error);
      return;
    }
    setRequests((prev) => prev?.filter((r) => r.id !== req.id) ?? null);
    setFriendIds((prev) => new Set(prev).add(req.requester_id));
  }

  async function handleDecline(req: FriendRequest) {
    setBusyId(req.id);
    const { error } = await removeFriendship(req.id);
    setBusyId(null);
    if (error) {
      setError(error);
      return;
    }
    setRequests((prev) => prev?.filter((r) => r.id !== req.id) ?? null);
  }

  const visibleRequests = requests && !pendingExpanded ? requests.slice(0, PENDING_PREVIEW_COUNT) : requests;
  const hiddenCount = requests ? requests.length - PENDING_PREVIEW_COUNT : 0;

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">ACTIVITY</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          NOTIFICATIONS
        </h1>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {!requests ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : (
        <>
          {requests.length > 0 && (
            <div className="mb-8">
              <div className="text-[11px] text-white/45 tracking-[0.15em] mb-3">FRIEND REQUESTS ({requests.length})</div>
              <div className="flex flex-col gap-2">
                {visibleRequests!.map((req) => {
                  const label = req.display_name || req.username;
                  return (
                    <div key={req.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <Link href={`/leaderboard/${req.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">
                            {label.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm truncate">{label}</span>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAccept(req)}
                          disabled={busyId === req.id}
                          className="rounded-full px-3 py-1.5 text-xs disabled:opacity-50 active:scale-95 transition-transform duration-150"
                          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDecline(req)}
                          disabled={busyId === req.id}
                          className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!pendingExpanded && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setPendingExpanded(true)}
                    className="text-center text-xs text-sky-300/80 hover:text-sky-300 transition-colors py-2"
                  >
                    +{hiddenCount} more pending request{hiddenCount === 1 ? "" : "s"} &rarr;
                  </button>
                )}
                {pendingExpanded && requests.length > PENDING_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setPendingExpanded(false)}
                    className="text-center text-xs text-white/40 hover:text-white/70 transition-colors py-2"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="text-[11px] text-white/45 tracking-[0.15em] mb-3">RECENT ACTIVITY</div>
          {!notifications ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-sm">Nothing here yet - friend activity and level-ups will show up as they happen.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((group) => {
                const actors = group.actorIds.map((id) => profiles.get(id));
                const { text, accentColor, avatarUrl, initial } = describeGroup(group, actors);
                return (
                  <div key={group.ids[0]} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-base"
                        style={{ background: `${accentColor}26`, boxShadow: `0 0 10px -4px ${accentColor}` }}
                      >
                        {initial}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{text}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{relativeTime(group.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
