"use client";

import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";
import { TEAMS, TeamAbbr } from "@/data/teams";

type FlowItem =
  | { type: "header"; key: string; label: string }
  | { type: "game"; key: string; game: Game }
  | { type: "blank"; key: string };

type DayGroup = { label: string; games: Game[] };

function flatten(groups: DayGroup[]): FlowItem[] {
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
function splitIntoColumns(groups: DayGroup[]): { col1: FlowItem[]; col2: FlowItem[] } {
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

function computePickStats(games: Game[], picks: Record<string, TeamAbbr>) {
  const withSpread = games.filter((g) => g.favorite && g.spread !== undefined && picks[g.id]);
  const chalkGames = withSpread.filter((g) => picks[g.id] === g.favorite);
  const underdogGames = withSpread.filter((g) => picks[g.id] !== g.favorite);
  const chalkPct = withSpread.length > 0 ? Math.round((chalkGames.length / withSpread.length) * 100) : null;
  const boldest = underdogGames.reduce<Game | null>(
    (max, g) => (!max || (g.spread ?? 0) > (max.spread ?? 0) ? g : max),
    null
  );
  return {
    underdogCount: underdogGames.length,
    chalkPct,
    boldestTeam: boldest ? TEAMS[picks[boldest.id]] : null,
    boldestSpread: boldest?.spread,
  };
}

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, locks, toggleLock, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const groups = groupGamesByDay(games);
  const stats = computePickStats(games, picks);

  const items = flatten(groups);
  const { col1, col2 } = splitIntoColumns(groups);
  const rowCount = Math.max(col1.length, col2.length);

  const renderMobileItem = (item: FlowItem, isFirst: boolean) =>
    item.type === "header" ? (
      <h2
        key={item.key}
        className={`text-center whitespace-nowrap px-2 mb-2 text-[clamp(1.25rem,7.5vw,2.75rem)] lg:text-4xl ${
          isFirst ? "mt-0" : "mt-5"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {item.label}
      </h2>
    ) : item.type === "game" ? (
      <div key={item.key} className="mb-4">
        <GameCard
          game={item.game}
          picked={picks[item.game.id]}
          onPick={(team) => setPick(item.game.id, team)}
          isLocked={!!locks[item.game.id]}
          onToggleLock={() => toggleLock(item.game.id)}
        />
      </div>
    ) : null;

  const renderGridCell = (item: FlowItem | undefined) => {
    if (!item || item.type === "blank") {
      return <div key={item?.key ?? Math.random()} />;
    }
    if (item.type === "header") {
      return (
        <div key={item.key} className="h-full flex items-end justify-center pb-2">
          <h2
            className="text-center whitespace-nowrap px-2 text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {item.label}
          </h2>
        </div>
      );
    }
    return (
      <GameCard
        key={item.key}
        game={item.game}
        picked={picks[item.game.id]}
        onPick={(team) => setPick(item.game.id, team)}
        isLocked={!!locks[item.game.id]}
        onToggleLock={() => toggleLock(item.game.id)}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-3 max-w-4xl w-full mx-auto relative">
        <div className="flex flex-col items-center">
          <div className="text-center">
            <h1
              className="text-3xl tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              NFL PICK&rsquo;EM
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Week {CURRENT_WEEK} &middot; {pickedCount} / {games.length} picked
            </p>
          </div>
          <button
            aria-label="Sign in"
            className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-white/40 text-white/50 text-lg flex items-center justify-center absolute top-6 right-4"
          >
            +
          </button>
        </div>

        <div className="flex gap-2 mt-4 justify-center flex-wrap">
          <div className="shrink-0 min-w-[88px] rounded-full border-2 border-white text-center px-4 py-1.5">
            <div className="text-base" style={{ fontFamily: "var(--font-display)" }}>
              {stats.underdogCount}
            </div>
            <div className="text-[9px] text-white/55">UNDERDOGS</div>
          </div>
          <div className="shrink-0 min-w-[110px] rounded-full border-2 border-emerald-400 text-center px-4 py-1.5">
            <div
              className="text-base flex items-center justify-center gap-1"
              style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}
            >
              {stats.boldestTeam ? (
                <>
                  <img src={stats.boldestTeam.logo} alt="" className="h-[34px] w-auto" />+{stats.boldestSpread}
                </>
              ) : (
                "-"
              )}
            </div>
            <div className="text-[9px] text-white/55">BOLDEST PICK</div>
          </div>
          <div className="shrink-0 min-w-[88px] rounded-full border-2 border-white text-center px-4 py-1.5">
            <div className="text-base" style={{ fontFamily: "var(--font-display)" }}>
              {stats.chalkPct !== null ? `${stats.chalkPct}%` : "-"}
            </div>
            <div className="text-[9px] text-white/55">CHALK</div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-10 max-w-4xl w-full mx-auto">
        {loaded && (
          <>
            <div className="flex flex-col lg:hidden">
              {items.map((item, i) => renderMobileItem(item, i === 0))}
            </div>
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 lg:items-stretch">
              {Array.from({ length: rowCount }).flatMap((_, i) => [
                renderGridCell(col1[i]),
                renderGridCell(col2[i]),
              ])}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
