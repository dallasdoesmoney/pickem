import { supabase } from "@/lib/supabase/client";

export type NotificationType = "friend_request" | "referral_joined" | "level_up";

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

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Idempotent, race-safe (see sync_level_up_notifications in
// supabase/schema.sql) - safe to call on every session load.
export async function syncLevelUpNotifications(): Promise<void> {
  const { error } = await supabase.rpc("sync_level_up_notifications");
  if (error) throw error;
}
