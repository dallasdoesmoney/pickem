// Per-game "WED · 8:20PM" tab, replacing the day-group divider entirely on
// the desktop grid - every matchup carries its own kickoff time instead of
// one blanket title per day, so there's no dedicated row spent on a label
// at all (see buildDesktopRows in pickLayout.ts).
export function gameTimeLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(date).toUpperCase();
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" })
    .format(date)
    .toUpperCase()
    .replace(/\s/g, "");
  return `${weekday} · ${time}`;
}
