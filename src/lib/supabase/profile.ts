import { supabase } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

// avatarDataUrl comes pre-cropped from the existing resizeToSquareDataUrl
// logic in src/app/account/page.tsx - this only handles the upload + DB
// write, so the crop math stays in one place.
export async function updateProfile(userId: string, updates: { displayName?: string; avatarDataUrl?: string }) {
  const patch: { display_name?: string; avatar_url?: string } = {};

  if (updates.displayName !== undefined) {
    patch.display_name = updates.displayName;
  }

  if (updates.avatarDataUrl) {
    const blob = await (await fetch(updates.avatarDataUrl)).blob();
    const path = `${userId}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    // Cache-bust so a re-uploaded avatar at the same path shows up immediately.
    patch.avatar_url = `${data.publicUrl}?t=${Date.now()}`;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
