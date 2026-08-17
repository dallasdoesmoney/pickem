import { supabase } from "@/lib/supabase/client";

// Calls our own /api/newsletter-subscribe route rather than Beehiiv
// directly - the Beehiiv API key is server-only and must never reach
// the browser. The route derives the email from the caller's own
// verified session, so nothing sensitive needs to be sent here.
export async function subscribeToNewsletter(): Promise<{ error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Not signed in" };

  const res = await fetch("/api/newsletter-subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) return { error: "Couldn't subscribe to the newsletter" };
  return { error: null };
}
