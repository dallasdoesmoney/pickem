import { NotificationRow } from "@/lib/supabase/notifications";

// Short relative timestamp for an activity row - falls back to a plain
// date once something's old enough that "12d ago" stops being useful.
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Distinct from NotificationType - friend_request notifications split
// into two different display kinds here (still-pending ones live in the
// separate pending-requests section entirely, not this feed) or get
// dropped (declined/removed - nothing worth remembering).
export type ActivityKind = "friend_accepted" | "friend_request_accepted_by_me" | "referral_joined" | "level_up";

export type ActivityGroup = {
  kind: ActivityKind;
  ids: string[];
  createdAt: string; // most recent event in the group
  actorIds: string[]; // distinct, in first-seen order; empty for level_up
  level?: number; // level_up only
};

const GROUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Builds the grouped, newest-first activity feed from raw notification
// rows. friend_request rows are resolved against current friendship state
// (not stored on the notification itself, since a request's outcome can
// change well after it was sent):
//   - still pending -> excluded (shown in the separate pending section)
//   - now a friend -> "you accepted" history entry
//   - neither -> declined/removed, dropped entirely
export function buildActivityGroups(
  notifications: NotificationRow[],
  { pendingRequesterIds, friendIds }: { pendingRequesterIds: Set<string>; friendIds: Set<string> }
): ActivityGroup[] {
  type Resolved = { kind: ActivityKind; actorId: string | null; createdAt: string; id: string; level?: number };
  const resolved: Resolved[] = [];

  for (const n of notifications) {
    if (n.type === "friend_request") {
      const requesterId = String(n.data.requester_id ?? "");
      if (!requesterId || pendingRequesterIds.has(requesterId)) continue;
      if (!friendIds.has(requesterId)) continue;
      resolved.push({ kind: "friend_request_accepted_by_me", actorId: requesterId, createdAt: n.created_at, id: n.id });
    } else if (n.type === "friend_accepted") {
      const accepterId = String(n.data.accepter_id ?? "");
      if (!accepterId) continue;
      resolved.push({ kind: "friend_accepted", actorId: accepterId, createdAt: n.created_at, id: n.id });
    } else if (n.type === "referral_joined") {
      const refereeId = String(n.data.referee_id ?? "");
      if (!refereeId) continue;
      resolved.push({ kind: "referral_joined", actorId: refereeId, createdAt: n.created_at, id: n.id });
    } else if (n.type === "level_up") {
      resolved.push({ kind: "level_up", actorId: null, createdAt: n.created_at, id: n.id, level: Number(n.data.level) });
    }
  }

  // Build forward through time so each group's window anchors to its most
  // recent member, then flip to newest-first for display.
  const chronological = [...resolved].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const groups: ActivityGroup[] = [];
  for (const item of chronological) {
    const last = groups[groups.length - 1];
    const withinWindow = !!last && new Date(item.createdAt).getTime() - new Date(last.createdAt).getTime() <= GROUP_WINDOW_MS;
    if (item.kind !== "level_up" && last && last.kind === item.kind && withinWindow) {
      last.ids.push(item.id);
      last.createdAt = item.createdAt;
      if (item.actorId && !last.actorIds.includes(item.actorId)) last.actorIds.push(item.actorId);
    } else {
      groups.push({
        kind: item.kind,
        ids: [item.id],
        createdAt: item.createdAt,
        actorIds: item.actorId ? [item.actorId] : [],
        level: item.level,
      });
    }
  }

  return groups.reverse();
}
