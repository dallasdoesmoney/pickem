"use client";

import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks } from "@/hooks/usePicks";

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;

  return (
    <div className="flex flex-col flex-1 bg-neutral-50">
      <header className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-black/10 px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Week {CURRENT_WEEK}</h1>
        <p className="text-sm text-black/60 mt-1">
          {pickedCount} / {games.length} picked
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(pickedCount / games.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3 max-w-xl w-full mx-auto">
        {loaded &&
          games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              picked={picks[game.id]}
              onPick={(team) => setPick(game.id, team)}
            />
          ))}
      </main>
    </div>
  );
}
