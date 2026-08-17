import { TEAMS, TeamAbbr } from "@/data/teams";
import { saveWeeklyPicks, saveSeasonPicks } from "@/lib/supabase/picks";
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

// One-time pull of whatever's sitting in this browser's localStorage into a
// freshly-created account. Gated by profiles.migrated_local_picks in
// useAuth.tsx so this only ever runs once per account - a later login from
// a different device must never re-trigger it and stomp real server data.
export async function migrateLocalDataToAccount(userId: string) {
  for (const key of Object.keys(localStorage)) {
    const weeklyMatch = key.match(WEEKLY_KEY_RE);
    if (weeklyMatch) {
      const picks = safeParse<Record<string, TeamAbbr>>(localStorage.getItem(key));
      if (picks && Object.keys(picks).length > 0) {
        const week = Number(weeklyMatch[1]);
        const lockedGameId = localStorage.getItem(lockKeyFor(week));
        await saveWeeklyPicks(userId, week, picks, lockedGameId && picks[lockedGameId] ? lockedGameId : null);
      }
      continue;
    }

    const seasonMatch = key.match(SEASON_KEY_RE);
    if (seasonMatch) {
      const team = seasonMatch[1] as TeamAbbr;
      if (!(team in TEAMS)) continue;
      const picks = safeParse<Record<number, TeamAbbr>>(localStorage.getItem(key));
      if (picks && Object.keys(picks).length > 0) {
        await saveSeasonPicks(userId, team, picks);
      }
      continue;
    }
  }

  const profile = safeParse<{ avatarDataUrl?: string | null }>(localStorage.getItem(PROFILE_KEY));
  if (profile?.avatarDataUrl) {
    await updateAvatar(userId, profile.avatarDataUrl);
  }
}
