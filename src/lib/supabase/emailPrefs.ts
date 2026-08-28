import { supabase } from "./client";

// Which emails a person has asked for. Two streams, kept apart on
// purpose: a deadline nudge and "we built a new game" are different
// things, and one switch covering both would make whichever label it
// carried a lie. See 0056.
//
// Both are ON by default (0053 for reminders, 0056 for game updates).
// The defaults below are what a MISSING row reads as, which is a
// different question - see fetchEmailPrefs.
export type EmailPrefs = {
  weeklyDeadline: boolean;
  productNews: boolean;
};

export type EmailPrefKey = keyof EmailPrefs;

// Column per preference, in one place, so adding a third stream is a
// line here rather than a hunt through three files.
const COLUMN: Record<EmailPrefKey, string> = {
  weeklyDeadline: "weekly_deadline",
  productNews: "product_news",
};

// What a row that does not exist means. OFF, deliberately, and not the
// same answer as the database's column defaults: a row is created for
// every profile by the trigger in 0052 and the rest were backfilled, so
// a missing one means something has gone wrong - and the safe reading of
// "I do not know whether they agreed" is that they did not.
export const DEFAULT_EMAIL_PREFS: EmailPrefs = { weeklyDeadline: false, productNews: false };

// Reads the caller's own row and nobody else's - RLS sees to that, so
// there is no user id to pass and no way to ask for someone else's.
export async function fetchEmailPrefs(): Promise<EmailPrefs> {
  const { data, error } = await supabase.from("email_prefs").select("weekly_deadline, product_news").maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_EMAIL_PREFS;
  return {
    weeklyDeadline: data.weekly_deadline === true,
    productNews: data.product_news === true,
  };
}

// Upsert rather than update, so somebody whose row never got created can
// still set a preference. The insert policy and the column grants in
// 0052/0056 are what keep this to your own row and your own preferences -
// the unsubscribe token is not writable here by design.
//
// Writes ONE column. Sending the whole object would mean every flip of
// one switch also rewrites the other, so two tabs open on the account
// page could quietly undo each other.
export async function setEmailPref(key: EmailPrefKey, on: boolean): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("email_prefs")
    .upsert({ user_id: userId, [COLUMN[key]]: on }, { onConflict: "user_id" });
  if (error) throw error;
}

// Turn EVERYTHING off from a link in an email, with no session.
//
// All of it, not just the stream the link arrived in. Somebody clicking
// unsubscribe in an inbox has decided they are done, and a link that
// silences one of two things means the next email still arrives - at
// which point they reach for the spam button rather than hunting for the
// other switch. Precision lives in the account page, where there is a
// session to make it with. See 0056.
//
// The token is the whole credential, which is the accepted shape for
// unsubscribe links: the person clicking is reading their inbox, very
// likely on another device, and anything that puts a sign-in in the way
// is a broken unsubscribe.
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("email_unsubscribe", { p_token: token });
  if (error) throw error;
  return data === true;
}
