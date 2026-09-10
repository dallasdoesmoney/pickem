import { GAMES_BY_WEEK } from "@/data/games";
import type { TeamAbbr } from "@/data/teams";
import { openGameIds } from "@/lib/lockAtKickoff";

type Picks = Record<string, TeamAbbr>;

// The device's copy as a safety net, not as a second opinion.
//
// The account is authoritative and stays authoritative: a game the
// database has an answer for is never overruled here. This only fills
// GAPS - a game this browser remembers picking that the account has no
// row for at all - and only on games that have not kicked off, so it can
// never write a pick onto a played game.
//
// Those two conditions are narrow on purpose. Local and the account only
// diverge when a write did not land, because every deliberate change
// writes both. So a gap is a lost write, and un-picking a game updates
// local too, which is what stops this from resurrecting something
// somebody cleared on purpose.
//
// This exists because a failed write can silently empty a board: the
// save path deletes before it inserts, and if the insert is refused the
// delete has already committed. It is the same "the account has nothing
// for this week, so fill it in" rule migrateLocalDataToAccount already
// runs at sign-in, applied per game instead of per week.
export function healFromLocalCopy(dbPicks: Picks, dbLock: string | null, picksKey: string, lockKey: string, week: number) {
  let local: Picks = {};
  try {
    local = JSON.parse(localStorage.getItem(picksKey) ?? "{}") as Picks;
  } catch {
    local = {};
  }
  if (!local || typeof local !== "object") return { picks: dbPicks, lockedGameId: dbLock, restored: 0 };

  const open = openGameIds(GAMES_BY_WEEK[week] ?? [], Date.now());
  const picks: Picks = { ...dbPicks };
  let restored = 0;
  for (const [gameId, team] of Object.entries(local)) {
    if (picks[gameId] || !open.has(gameId) || typeof team !== "string") continue;
    picks[gameId] = team;
    restored++;
  }
  if (restored === 0) return { picks: dbPicks, lockedGameId: dbLock, restored: 0 };

  // The lock rides along only if the account has none and the game it
  // points at is one we just put back.
  const localLock = localStorage.getItem(lockKey);
  const lockedGameId = dbLock ?? (localLock && picks[localLock] && open.has(localLock) ? localLock : null);
  return { picks, lockedGameId, restored };
}
