// Type-only, so this module stays importable from a plain node test
// script without dragging the whole schedule in behind it.
import type { Game } from "@/data/games";

// A pick closes at its own game's kickoff.
//
// Until now the only thing that closed picking was weeks.is_open, a
// boolean somebody flips by hand in the admin panel. That is not a
// deadline, it is a chore, and the first Wednesday night of the season is
// what it cost: the game kicked off at 8:20 ET, nobody flipped the flag,
// and every account could still change its pick on a game that had
// already been played.
//
// Per game, not per week. Locking the whole slate at the week's first
// kickoff would freeze Sunday's fifteen games on Wednesday night, which
// is a different kind of broken. is_open stays on top of this as a manual
// override - an admin can still close a week early - it just isn't the
// only thing standing between a played game and an edit.

// True once this game has started. An unparseable kickoff locks the game
// rather than opening it: a bad date in the schedule should cost us one
// game nobody can pick (loud, obvious, one-line fix) and not a game
// anybody can pick after it finishes (silent, and exactly the bug this
// exists to close).
export function isKickedOff(game: Game, now: number): boolean {
  const at = Date.parse(game.kickoff);
  if (!Number.isFinite(at)) return true;
  return at <= now;
}

// The games in `games` that can still be written to. The save path needs
// this as a set, because a whole-week delete-then-insert would otherwise
// try to delete rows the database now refuses to give up.
export function openGameIds(games: Game[], now: number): Set<string> {
  return new Set(games.filter((g) => !isKickedOff(g, now)).map((g) => g.id));
}
