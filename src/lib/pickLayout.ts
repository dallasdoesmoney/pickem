import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";

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

// Splits into two columns by game count, row-paired for a CSS grid so a
// header on one side and a game on the other still force both cells in
// that row to the same height (the grid's native "tallest cell wins" rule
// keeps every subsequent row locked in alignment). Column 2 reserves a
// blank cell instead of repeating a day label when the split falls mid-day.
export function splitIntoColumns(groups: DayGroup[]): { col1: FlowItem[]; col2: FlowItem[] } {
  const totalGames = groups.reduce((sum, g) => sum + g.games.length, 0);
  const half = Math.ceil(totalGames / 2);

  const col1: FlowItem[] = [];
  const col2: FlowItem[] = [];
  let count = 0;
  let col2Started = false;

  for (const group of groups) {
    group.games.forEach((game, i) => {
      const isFirstOfGroup = i === 0;
      if (count < half) {
        if (isFirstOfGroup) col1.push({ type: "header", key: `h1-${group.label}`, label: group.label });
        col1.push({ type: "game", key: game.id, game });
      } else {
        if (!col2Started) {
          col2.push({ type: "blank", key: `blank-${group.label}` });
          col2Started = true;
        } else if (isFirstOfGroup) {
          col2.push({ type: "header", key: `h2-${group.label}`, label: group.label });
        }
        col2.push({ type: "game", key: game.id, game });
      }
      count++;
    });
  }

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

export type PickTag = { emoji: string; label: string };

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
      g.id === boldest?.id ? { emoji: "\u{1F48E}", label: "Boldest Pick" } : { emoji: "\u{1F436}", label: "Underdog" };
  }
  return tags;
}
