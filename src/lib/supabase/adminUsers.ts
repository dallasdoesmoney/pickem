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
  newsletter_subscribed: boolean;
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
