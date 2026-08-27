import { supabase } from "./client";

// Which emails a person has asked for. There is exactly one today, and
// it is off until they say otherwise - see the migration for why an
// opt-out default was not on the table.
export type EmailPrefs = {
  weeklyDeadline: boolean;
};

export const DEFAULT_EMAIL_PREFS: EmailPrefs = { weeklyDeadline: false };

// Reads the caller's own row and nobody else's - RLS sees to that, so
// there is no user id to pass and no way to ask for someone else's.
//
// A missing row reads as "everything off" rather than throwing. The
// trigger in 0052 creates one for every new profile and the migration
// backfilled the rest, but a preferences screen that breaks because a
// row is absent would be a bad trade for a value we already know.
export async function fetchEmailPrefs(): Promise<EmailPrefs> {
  const { data, error } = await supabase.from("email_prefs").select("weekly_deadline").maybeSingle();
  if (error) throw error;
  return { weeklyDeadline: data?.weekly_deadline === true };
}

// Upsert rather than update, so somebody whose row never got created can
// still turn the reminder on. The insert policy and the column grants in
// 0052 are what keep this to your own row and your own preference - the
// unsubscribe token is not writable here by design.
export async function setWeeklyDeadlineEmail(on: boolean): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("email_prefs")
    .upsert({ user_id: userId, weekly_deadline: on }, { onConflict: "user_id" });
  if (error) throw error;
}

// Turn the reminder off from a link in an email, with no session.
//
// The token is the whole credential, which is the accepted shape for
// unsubscribe links: the person clicking is reading their inbox, very
// likely on another device, and anything that puts a sign-in in the way
// is a broken unsubscribe. See email_unsubscribe() in 0052, which is
// granted to anon for exactly this call.
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("email_unsubscribe", { p_token: token });
  if (error) throw error;
  return data === true;
}
