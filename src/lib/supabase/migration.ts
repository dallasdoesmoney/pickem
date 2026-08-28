import { TEAMS, TeamAbbr } from "@/data/teams";
import { supabase } from "@/lib/supabase/client";
import { fetchWeeklyPicks, fetchSeasonPicks, saveWeeklyPicks, saveSeasonPicks } from "@/lib/supabase/picks";
import { updateAvatar } from "@/lib/supabase/profile";

const WEEKLY_KEY_RE = /^pickem:picks:week-(\d+)$/;
const SEASON_KEY_RE = /^pickem:season-predictor:([A-Z]{2,3})$/;
const PROFILE_KEY = "pickem:profile";
const lockKeyFor = (week: number) => `pickem:lock:week-${week}`;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Pulls whatever is sitting in THIS browser's localStorage into an account
// that does not have it yet.
//
// ADDITIVE, and that is the whole design. It used to write every local
// scope over the account unconditionally, which is destructive -
// saveWeeklyPicks deletes the week before inserting it - so it could only
// ever be allowed to run once, and profiles.migrated_local_picks was the
// thing making sure of that. A one-way flag is a bad fit for a person with
// two devices: sign up on a phone, and the phone's empty run flips the
// flag and locks the laptop's boards out of that account permanently.
//
// Checking the server first costs one read per local scope and removes the
// reason the flag had to be one-way. A week the account already has is
// left exactly as it is; only a week it has never had is filled in. So
// running this again on a second device is safe, and the flag goes back to
// being what it should have been - a note that the work is done, not a
// guard against damage.
//
// Returns whether anything was actually written, which is what useAuth
// uses to decide if there is anything worth remembering.
export async function migrateLocalDataToAccount(userId: string): Promise<boolean> {
  let migrated = false;

  for (const key of Object.keys(localStorage)) {
    const weeklyMatch = key.match(WEEKLY_KEY_RE);
    if (weeklyMatch) {
      const picks = safeParse<Record<string, TeamAbbr>>(localStorage.getItem(key));
      if (picks && Object.keys(picks).length > 0) {
        const week = Number(weeklyMatch[1]);
        // Any pick at all on the account for this week means the account
        // is the better copy - it has been played signed in since. Note
        // this is also what stops a browser's own CACHE of a previous
        // session from being re-imported: usePicks writes the same keys
        // for a signed-in user, and those weeks are already on the
        // server by definition.
        const existing = await fetchWeeklyPicks(userId, week);
        if (Object.keys(existing.picks).length === 0) {
          const lockedGameId = localStorage.getItem(lockKeyFor(week));
          await saveWeeklyPicks(userId, week, picks, lockedGameId && picks[lockedGameId] ? lockedGameId : null);
          migrated = true;
        }
      }
      continue;
    }

    const seasonMatch = key.match(SEASON_KEY_RE);
    if (seasonMatch) {
      const team = seasonMatch[1] as TeamAbbr;
      if (!(team in TEAMS)) continue;
      const picks = safeParse<Record<number, TeamAbbr>>(localStorage.getItem(key));
      if (picks && Object.keys(picks).length > 0) {
        const existing = await fetchSeasonPicks(userId, team);
        if (Object.keys(existing).length === 0) {
          await saveSeasonPicks(userId, team, picks);
          migrated = true;
        }
      }
      continue;
    }
  }

  const profile = safeParse<{ avatarDataUrl?: string | null }>(localStorage.getItem(PROFILE_KEY));
  if (profile?.avatarDataUrl) {
    // Only when the account has no picture of its own. Overwriting one
    // somebody chose later with a guest doodle from an old browser is the
    // same class of mistake as overwriting their picks.
    const { data } = await supabase.from("profiles").select("avatar_url").eq("id", userId).single();
    if (!data?.avatar_url) {
      await updateAvatar(userId, profile.avatarDataUrl);
      migrated = true;
    }
  }

  return migrated;
}
