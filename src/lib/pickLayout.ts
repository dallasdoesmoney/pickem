import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { gameTimeLabel } from "@/lib/groupGames";

export type FlowItem =
  | { type: "header"; key: string; label: string }
  | { type: "game"; key: string; game: Game }
  | { type: "blank"; key: string };

export type DayGroup = { label: string; games: Game[] };

export function flatten(groups: DayGroup[]): FlowItem[] {
  return groups.flatMap((group) => [
    { type: "header" as const, key: `h-${group.label}`, label: group.label },
    ...group.games.map((game) => ({ type: "game" as const, key: game.id, game })),
  ]);
}

export type DesktopCell = { game: Game; timeLabel: string };
export type DesktopRow = { key: string; left: DesktopCell; right: DesktopCell | null };

// No more day-group dividers at all - every matchup carries its own
// "WED · 8:20PM" tab instead (see the desktop grid's renderGridGame), so
// there's no row ever spent on a label, full stop. Games just pair up two
// at a time in kickoff order; sorted here rather than trusted from the
// caller since groupGamesByDay's Map only preserves first-occurrence
// order, not a true chronological sort.
export function buildDesktopRows(games: Game[]): DesktopRow[] {
  const sorted = [...games].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const rows: DesktopRow[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const left: DesktopCell = { game: sorted[i], timeLabel: gameTimeLabel(sorted[i].kickoff) };
    const rightGame = sorted[i + 1];
    const right: DesktopCell | null = rightGame ? { game: rightGame, timeLabel: gameTimeLabel(rightGame.kickoff) } : null;
    rows.push({ key: sorted[i].id, left, right });
  }
  return rows;
}

// Splits into two columns by total ROW count (headers + games), not just
// game count - a header takes up a real row too, so balancing on games
// alone let whichever column crossed more day-group boundaries end up
// visibly taller than the other even with the same number of games in
// each. Row-paired for a CSS grid so a header on one side and a game on
// the other still force both cells in that row to the same height (the
// grid's native "tallest cell wins" rule keeps every subsequent row
// locked in alignment).
//
// Row 0 of column 1 is always the first day header (flatten() always
// starts with one) - column 2's row 0 is forced blank instead of
// whatever game would naturally fall there, so the very top of the page
// never pairs a title-like header on the left with a matchup pill on the
// right. col1 gets ceil((N+1)/2) items (one more than an even split,
// since column 2 spends one of its own rows on the blank) so the two
// columns still land within one row of each other in total height.
export function splitIntoColumns(groups: DayGroup[]): { col1: FlowItem[]; col2: FlowItem[] } {
  const items = flatten(groups);
  const col1Count = Math.ceil((items.length + 1) / 2);
  const col1 = items.slice(0, col1Count);
  const col2: FlowItem[] = [{ type: "blank", key: "col2-top-spacer" }, ...items.slice(col1Count)];
  return { col1, col2 };
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
