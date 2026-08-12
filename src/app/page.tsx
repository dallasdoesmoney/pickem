"use client";

import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const groups = groupGamesByDay(games);

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-8 pb-4 text-center">
        <h1
          className="text-3xl tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          NFL PICK&rsquo;EM
        </h1>
        <p className="text-sm text-white/50 mt-3">
          Week {CURRENT_WEEK} &middot; {pickedCount} / {games.length} picked
        </p>
      </header>

      <main className="flex-1 px-4 pb-10 flex flex-col gap-8 max-w-xl w-full mx-auto">
        {loaded &&
          groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-3">
              <h2
                className="text-center text-lg tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {group.label}
              </h2>
              <div className="flex flex-col gap-6">
                {group.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    picked={picks[game.id]}
                    onPick={(team) => setPick(game.id, team)}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>
    </div>
  );
}
