import { Game } from "@/data/games";

export function dayGroupLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" })
    .format(date)
    .toUpperCase();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(date)
  );
  const isNight = hour >= 19;

  if (weekday === "SUNDAY") return isNight ? "SUNDAY NIGHT" : "SUNDAY";
  return isNight ? `${weekday} NIGHT` : weekday;
}

export function groupGamesByDay(games: Game[]): { label: string; games: Game[] }[] {
  const groups = new Map<string, Game[]>();
  for (const game of games) {
    const label = dayGroupLabel(game.kickoff);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(game);
  }
  return Array.from(groups.entries()).map(([label, games]) => ({ label, games }));
}
