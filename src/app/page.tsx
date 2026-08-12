"use client";

import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";

type FlowItem =
  | { type: "header"; key: string; label: string }
  | { type: "game"; key: string; game: Game };

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const groups = groupGamesByDay(games);

  const items: FlowItem[] = groups.flatMap((group) => [
    { type: "header" as const, key: `h-${group.label}`, label: group.label },
    ...group.games.map((game) => ({ type: "game" as const, key: game.id, game })),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-3 text-center">
        <h1
          className="text-3xl tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          NFL PICK&rsquo;EM
        </h1>
        <p className="text-sm text-white/50 mt-2">
          Week {CURRENT_WEEK} &middot; {pickedCount} / {games.length} picked
        </p>
      </header>

      <main className="flex-1 px-4 pb-10 lg:columns-2 lg:gap-x-8 max-w-4xl w-full mx-auto">
        {loaded &&
          items.map((item) =>
            item.type === "header" ? (
              <h2
                key={item.key}
                className="text-center whitespace-nowrap break-inside-avoid-column px-2 mb-2 mt-5 first:mt-0 text-[clamp(1.25rem,7.5vw,2.75rem)] lg:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.label}
              </h2>
            ) : (
              <div key={item.key} className="break-inside-avoid-column mb-3">
                <GameCard
                  game={item.game}
                  picked={picks[item.game.id]}
                  onPick={(team) => setPick(item.game.id, team)}
                />
              </div>
            )
          )}
      </main>
    </div>
  );
}
