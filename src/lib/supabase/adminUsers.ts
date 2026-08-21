import { supabase } from "@/lib/supabase/client";

// Both of these go through security-definer RPCs rather than table
// queries: profiles is select-own under RLS, and referred_by has no
// client update grant at all. See supabase/migrations/0031_admin_users.sql
// for why that lockdown exists and why admin needs its own door.

export type AdminUserRow = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  is_admin: boolean;
  referred_by: string | null;
  referrer_username: string | null;
  referrer_display_name: string | null;
  referral_count: number;
  total_points: number;
};

export async function fetchAdminUsers(search: string, limit = 100, offset = 0): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as AdminUserRow[];
}

// Pass an empty username to clear the attribution. The RPC also moves the
// point ledger, including taking the bonus back off a previous referrer.
export async function setUserReferrer(userId: string, referrerUsername: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_referrer", {
    p_user_id: userId,
    p_referrer_username: referrerUsername,
  });
  if (error) throw error;
}

// Rename an account. Either field may be left out, so "just fix the
// display name" doesn't require re-sending a username that is fine.
export async function updateAdminUser(
  userId: string,
  fields: { username?: string; displayName?: string }
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user", {
    p_user_id: userId,
    p_username: fields.username ?? null,
    p_display_name: fields.displayName ?? null,
  });
  if (error) throw error;
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_admin", { p_user_id: userId, p_is_admin: isAdmin });
  if (error) throw error;
}

// Irreversible, and takes everything the account owns with it - picks,
// tier lists, points, follows - because it deletes the auth user and the
// rest cascades off that. The RPC refuses to delete you or another
// admin; the UI asks you to type the name as well.
export async function deleteAdminUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
  if (error) throw error;
}

// Read fresh at the moment of sending rather than trusted from the open
// list, so a reset can never go to an address the page has gone stale on.
export async function fetchAdminUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("admin_user_email", { p_user_id: userId });
  if (error) throw error;
  return (data as string | null) ?? null;
}
