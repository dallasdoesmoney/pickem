import { supabase } from "@/lib/supabase/client";

export type NotificationType = "new_follower" | "referral_joined" | "level_up";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  created_at: string;
};

// Oldest first - toasts should play back in the order things actually
// happened, not newest-first like a typical feed.
export async function fetchUnreadNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, data, created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as NotificationRow[];
}

// Newest first - this is the activity feed's own read, independent of the
// unread-only toast queue above. Capped well above anything a real user
// would accumulate; a hard ceiling here is simpler than paging a feed
// that's meant to be skimmed, not exhaustively browsed.
export async function fetchAllNotifications(userId: string, limit = 300): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Bulk version for the activity page - viewing it should clear every
// still-unread row at once (so the toast queue doesn't replay something
// already visible in the feed), not one at a time.
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (error) throw error;
}

// Idempotent, race-safe (see sync_level_up_notifications in
// supabase/schema.sql) - safe to call on every session load.
export async function syncLevelUpNotifications(): Promise<void> {
  const { error } = await supabase.rpc("sync_level_up_notifications");
  if (error) throw error;
}
