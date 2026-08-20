"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { dismissFollowBack, fetchFollowersNotFollowingBack, followUser, FollowerRow } from "@/lib/supabase/follows";
import { fetchAllNotifications, markAllNotificationsRead, NotificationRow } from "@/lib/supabase/notifications";
import { fetchProfilesByIds, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { buildActivityGroups, relativeTime, activityHref, ActivityGroup } from "@/lib/activity";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";
import { errorMessage } from "@/lib/errorMessage";

const FOLLOWERS_PREVIEW_COUNT = 5;

function pluralOthers(n: number): string {
  return n === 1 ? "1 other" : `${n} others`;
}

function describeGroup(group: ActivityGroup, actors: (Pick<LeaderboardRow, "username" | "display_name" | "avatar_url"> | undefined)[]) {
  const first = actors[0];
  const firstLabel = first?.display_name || first?.username || "Someone";
  const extra = group.actorIds.length - 1;
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
  if (group.kind === "new_follower") {
    return {
      text: `${namePhrase} started following you`,
      accentColor: "#c084fc",
      avatarUrl: first?.avatar_url ?? null,
      initial: firstLabel.charAt(0).toUpperCase(),
    };
  }
  if (group.kind === "creator_request_approved") {
    return {
      text: "You're now a Creator! Your badge is live on your profile.",
      accentColor: "#ef4444",
      avatarUrl: null as string | null,
      initial: "🎥",
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
  const [followers, setFollowers] = useState<FollowerRow[] | null>(null);
  const [followersExpanded, setFollowersExpanded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which grouped row is showing its members. A group of several people
  // has no single profile to open, so instead of picking one and hoping,
  // tapping it lists them and each of those is a real link.
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/account");
      return;
    }
    Promise.all([fetchFollowersNotFollowingBack(user.id), fetchAllNotifications(user.id)])
      .then(([unreciprocated, allNotifications]) => {
        setFollowers(unreciprocated);
        setNotifications(allNotifications);
        markAllNotificationsRead(user.id).catch((err) => console.error("Failed to mark notifications read", err));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [user, loading, router]);

  const groups = useMemo(() => {
    if (!notifications) return [];
    return buildActivityGroups(notifications);
  }, [notifications]);

  useEffect(() => {
    const actorIds = groups.flatMap((g) => g.actorIds).filter((id) => !profiles.has(id));
    if (actorIds.length === 0) return;
    fetchProfilesByIds(actorIds)
      .then((fetched) => setProfiles((prev) => new Map([...prev, ...fetched])))
      .catch((err) => console.error("Failed to resolve activity actors", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Seeing a follower and deciding not to follow back is a real answer,
  // and it used to have nowhere to go: the list and the header's red
  // badge are both "followers minus following", so the only way to clear
  // either was to follow someone you did not want to follow.
  async function handleDismiss(row: FollowerRow) {
    if (!user) return;
    setBusyId(row.user_id);
    // Removed first: this is a suggestion disappearing, not a
    // transaction, and it should feel instant. A failure puts it back.
    setFollowers((prev) => prev?.filter((f) => f.user_id !== row.user_id) ?? null);
    const { error } = await dismissFollowBack(user.id, row.user_id);
    setBusyId(null);
    if (error) {
      setError(error);
      setFollowers((prev) => (prev ? [row, ...prev] : [row]));
    }
  }

  async function handleFollowBack(row: FollowerRow) {
    if (!user) return;
    setBusyId(row.user_id);
    const { error } = await followUser(user.id, row.user_id);
    setBusyId(null);
    if (error) {
      setError(error);
      return;
    }
    setFollowers((prev) => prev?.filter((f) => f.user_id !== row.user_id) ?? null);
  }

  const visibleFollowers = followers && !followersExpanded ? followers.slice(0, FOLLOWERS_PREVIEW_COUNT) : followers;
  const hiddenCount = followers ? followers.length - FOLLOWERS_PREVIEW_COUNT : 0;

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">ACTIVITY</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          NOTIFICATIONS
        </h1>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {!followers ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : (
        <>
          {followers.length > 0 && (
            <div className="mb-8">
              <div className="text-[11px] text-white/45 tracking-[0.15em] mb-3">FOLLOW BACK ({followers.length})</div>
              <div className="flex flex-col gap-2">
                {visibleFollowers!.map((f) => {
                  const label = f.display_name || f.username;
                  return (
                    <div key={f.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <Link href={`/leaderboard/${f.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">
                            {label.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm truncate">{label}</span>
                      </Link>
                      <button
                        onClick={() => handleFollowBack(f)}
                        disabled={busyId === f.user_id}
                        className="shrink-0 rounded-full px-3 py-1.5 text-xs border disabled:opacity-50 transition-colors hover:brightness-110"
                        style={{ fontFamily: "var(--font-display)", background: "rgba(192,132,252,0.14)", borderColor: "rgba(192,132,252,0.4)", color: "#d8b4fe" }}
                      >
                        {busyId === f.user_id ? "…" : "Follow Back"}
                      </button>
                      {/* The other answer. Not a block - they still
                          follow you and are never told; it only stops
                          this being offered. */}
                      <button
                        onClick={() => handleDismiss(f)}
                        disabled={busyId === f.user_id}
                        aria-label={`Dismiss ${f.display_name || f.username}`}
                        title="Not now"
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/10 hover:text-white/80 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
                {!followersExpanded && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFollowersExpanded(true)}
                    className="text-center text-xs text-sky-300/80 hover:text-sky-300 transition-colors py-2"
                  >
                    +{hiddenCount} more follower{hiddenCount === 1 ? "" : "s"} &rarr;
                  </button>
                )}
                {followersExpanded && followers.length > FOLLOWERS_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setFollowersExpanded(false)}
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
              <p className="text-sm">Nothing here yet - new followers and level-ups will show up as they happen.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((group) => {
                const actors = group.actorIds.map((id) => profiles.get(id));
                const { text, accentColor, avatarUrl, initial } = describeGroup(group, actors);
                const key = group.ids[0];
                const multiple = group.actorIds.length > 1;
                const href = multiple ? null : activityHref(group.kind, actors[0]?.username);
                const expanded = expandedGroup === key;

                const face = avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span
                    className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-base"
                    style={{ background: `${accentColor}26`, boxShadow: `0 0 10px -4px ${accentColor}` }}
                  >
                    {initial}
                  </span>
                );
                const body = (
                  <>
                    {face}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm">{text}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{relativeTime(group.createdAt)}</p>
                    </div>
                    {/* Every row that goes somewhere says so. Without it
                        the feed reads as a wall of static text, which is
                        exactly what it was. */}
                    {(href || multiple) && (
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${expanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </>
                );
                const rowClass =
                  "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors";

                if (href) {
                  return (
                    <Link key={key} href={href} className={`${rowClass} hover:border-white/25 hover:bg-white/[0.08]`}>
                      {body}
                    </Link>
                  );
                }
                if (multiple) {
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedGroup(expanded ? null : key)}
                        aria-expanded={expanded}
                        className={`${rowClass} hover:border-white/25 hover:bg-white/[0.08]`}
                      >
                        {body}
                      </button>
                      {expanded && (
                        <div className="flex flex-col gap-1 pl-6">
                          {group.actorIds.map((id) => {
                            const actor = profiles.get(id);
                            const label = actor?.display_name || actor?.username || "Someone";
                            if (!actor?.username) {
                              return (
                                <span key={id} className="px-3 py-2 text-sm text-white/40">
                                  {label}
                                </span>
                              );
                            }
                            return (
                              <Link
                                key={id}
                                href={`/leaderboard/${actor.username}`}
                                className="flex items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2 transition-colors hover:border-white/25 hover:bg-white/5"
                              >
                                {actor.avatar_url ? (
                                  <img src={actor.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span className="h-7 w-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[11px]">
                                    {label.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate text-sm">{label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={key} className={rowClass}>
                    {body}
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
