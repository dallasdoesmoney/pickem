import { supabase } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

// avatarDataUrl comes pre-cropped from the existing resizeToSquareDataUrl
// logic in src/app/account/page.tsx - this only handles the upload + DB
// write, so the crop math stays in one place.
export async function updateAvatar(userId: string, avatarDataUrl: string) {
  const blob = await (await fetch(avatarDataUrl)).blob();
  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Cache-bust so a re-uploaded avatar at the same path shows up immediately.
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) throw error;
}

// A preset (currently: team logos) is just an existing public CDN URL -
// no crop/upload step needed, unlike updateAvatar above.
export async function setPresetAvatar(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) throw error;
}

// Marks AvatarPromptGate as seen (kept/uploaded/preset-picked/skipped -
// all four count as "done") so it never shows again for this account.
export async function markAvatarPrompted(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ onboarding_avatar_prompted: true }).eq("id", userId);
  if (error) throw error;
}

// Marks ReferralPromptGate as seen - answered or skipped, both count -
// so nobody is asked twice who invited them.
export async function markReferralPrompted(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ onboarding_referral_prompted: true }).eq("id", userId);
  if (error) throw error;
}

export async function markFollowRecsPrompted(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ follow_recs_prompted: true }).eq("id", userId);
  if (error) throw error;
}

// Runs through a security-definer RPC (see supabase/schema.sql) rather
// than a plain select, since the profiles_select_own RLS policy only
// lets someone read their OWN row - checking whether a name is taken
// needs to see across all users without broadening that policy.
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_username_available", { check_username: username });
  if (error) throw error;
  return data as boolean;
}

export async function claimUsername(userId: string, username: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
  if (error) {
    if (error.code === "23505") return { error: "That username is already taken." };
    if (error.code === "23514") return { error: "That username isn't allowed." };
    return { error: "Couldn't save that username. Try again." };
  }
  return { error: null };
}

// Unlike username, not unique - so there's no 23505 conflict case to
// handle, just the profanity/length constraint.
export async function updateDisplayName(userId: string, displayName: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
  if (error) {
    if (error.code === "23514") return { error: "That name isn't allowed." };
    return { error: "Couldn't save that name. Try again." };
  }
  return { error: null };
}

// Emails a one-time link that lands on /reset-password with a recovery
// session, where the password can be set. Deliberately in the profile
// layer rather than useAuth: the admin panel sends these for OTHER
// people, and it is the same call either way - Supabase does not tell
// the caller whether the address exists, which is what stops this being
// an account-enumeration endpoint.
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
