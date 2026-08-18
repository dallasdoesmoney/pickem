import { supabase } from "@/lib/supabase/client";

export type CreatorLink = { id: string; platform: string; url: string };

export async function fetchCreatorLinks(userId: string): Promise<CreatorLink[]> {
  const { data, error } = await supabase.from("creator_links").select("id, platform, url").eq("user_id", userId).order("platform");
  if (error) throw error;
  return data as CreatorLink[];
}

export async function addCreatorLink(userId: string, platform: string, url: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("creator_links").insert({ user_id: userId, platform, url });
  if (error) {
    if (error.code === "23505") return { error: "You already added a link for that platform." };
    return { error: "Couldn't save that link. Try again." };
  }
  return { error: null };
}

export async function updateCreatorLink(linkId: string, url: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("creator_links").update({ url }).eq("id", linkId);
  if (error) return { error: "Couldn't update that link. Try again." };
  return { error: null };
}

export async function removeCreatorLink(linkId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("creator_links").delete().eq("id", linkId);
  if (error) return { error: "Couldn't remove that link. Try again." };
  return { error: null };
}
