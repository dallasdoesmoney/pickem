import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { gameTimeLabel } from "@/lib/groupGames";

export type DesktopCell = { game: Game; timeLabel: string };
export type DesktopRow = { key: string; cells: (DesktopCell | null)[] };

// No more day-group dividers at all - every matchup carries its own
// "WED · 8:20PM" tab instead (see the desktop grid's renderGridGame), so
// there's no row ever spent on a label, full stop. Games just pair up two
// at a time in kickoff order; sorted here rather than trusted from the
// caller since groupGamesByDay's Map only preserves first-occurrence
// order, not a true chronological sort.
// Kickoff order, chopped into rows of `cols`. The column count is a
// display setting now (see useBoardView) rather than a constant: on a
// wide screen four columns turn eight rows into four at exactly the same
// pill size, which is the only way to buy height without shrinking
// anything. A short last row is padded with nulls so the grid keeps its
// tracks.
export function buildDesktopRows(games: Game[], cols = 2): DesktopRow[] {
  const sorted = [...games].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const rows: DesktopRow[] = [];
  for (let i = 0; i < sorted.length; i += cols) {
    const cells: (DesktopCell | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const game = sorted[i + c];
      cells.push(game ? { game, timeLabel: gameTimeLabel(game.kickoff) } : null);
    }
    rows.push({ key: sorted[i].id, cells });
  }
  return rows;
}

// The single underdog pick with the largest spread against it - shared by
// the stats row (as "Boldest Pick") and the auto-tag system (where it
// overrides the plain underdog tag on that one game).
function findBoldestPick(games: Game[], picks: Record<string, TeamAbbr>): Game | null {
  const underdogGames = games.filter(
    (g) => g.favorite && g.spread !== undefined && picks[g.id] && picks[g.id] !== g.favorite
  );
  return underdogGames.reduce<Game | null>(
    (max, g) => (!max || (g.spread ?? 0) > (max.spread ?? 0) ? g : max),
    null
  );
}

export function computePickStats(games: Game[], picks: Record<string, TeamAbbr>) {
  const withSpread = games.filter((g) => g.favorite && g.spread !== undefined && picks[g.id]);
  const chalkGames = withSpread.filter((g) => picks[g.id] === g.favorite);
  const underdogGames = withSpread.filter((g) => picks[g.id] !== g.favorite);
  const chalkPct = withSpread.length > 0 ? Math.round((chalkGames.length / withSpread.length) * 100) : null;
  const boldest = findBoldestPick(games, picks);
  return {
    underdogCount: underdogGames.length,
    chalkPct,
    boldestTeam: boldest ? TEAMS[picks[boldest.id]] : null,
    boldestSpread: boldest?.spread,
  };
}

export type PickStats = ReturnType<typeof computePickStats>;

export type PickTag = { icon: string; label: string };

export const UNDERDOG_ICON = "/underdog-bulldog.png";
export const BOLDEST_PICK_ICON = "/boldest-pick-alarm.png";

// Every underdog pick (picked team isn't the spread favorite) gets a plain
// underdog tag, EXCEPT the single boldest one (biggest spread against it),
// which gets the boldest-pick tag instead - one tag per game, no stacking.
export function computePickTags(games: Game[], picks: Record<string, TeamAbbr>): Record<string, PickTag> {
  const boldest = findBoldestPick(games, picks);
  const tags: Record<string, PickTag> = {};
  for (const g of games) {
    const pick = picks[g.id];
    if (!pick || !g.favorite || g.spread === undefined || pick === g.favorite) continue;
    tags[g.id] =
      g.id === boldest?.id ? { icon: BOLDEST_PICK_ICON, label: "Boldest Pick" } : { icon: UNDERDOG_ICON, label: "Underdog" };
  }
  return tags;
}
