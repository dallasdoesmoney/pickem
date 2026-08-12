"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "America/New_York" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(date);
  return `${day} · ${time} ET`;
}

export function GameCard({
  game,
  picked,
  onPick,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];

  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-black/50">
        <span>{formatKickoff(game.kickoff)}</span>
        <span>{game.network}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-black/10">
        {[
          { team: away, label: "Away" },
          { team: home, label: "Home" },
        ].map(({ team, label }) => {
          const isPicked = picked === team.abbr;
          return (
            <button
              key={team.abbr}
              onClick={() => onPick(team.abbr)}
              className="flex flex-col items-center gap-1 bg-white px-3 py-4 active:scale-[0.98] transition-transform"
              style={
                isPicked
                  ? { backgroundColor: team.color, color: "white" }
                  : undefined
              }
            >
              <span className="text-[10px] uppercase tracking-wide opacity-60" style={isPicked ? { color: "white" } : undefined}>
                {label}
              </span>
              <span className="text-sm font-semibold">{team.name}</span>
              {isPicked && <span className="text-[10px] font-medium">✓ Picked</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
