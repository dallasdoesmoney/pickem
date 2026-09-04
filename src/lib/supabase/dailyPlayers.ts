import { supabase } from "./client";
import { alreadyCounted, markCounted, playerKey } from "@/lib/playerKey";

// HOW MANY PEOPLE PLAYED TODAY - the two calls behind the live counter.
//
// Both are deliberately quiet about failure. This is a number on a card,
// not a feature: if the count cannot be read the counter hides, and if a
// play cannot be recorded the guess still lands. Neither is allowed to
// surface an error to somebody who came here to play a game.

// Report that this browser has played. Called on the FIRST GUESS of the
// day - not on page load, because opening the page is not playing and
// counting opens would fill the number with crawlers and link previews.
//
// Safe to call more than once: the server is idempotent on (day, key),
// and the client skips after the first success anyway.
export async function recordDailyPlay(day: string): Promise<void> {
  if (alreadyCounted(day)) return;
  const key = playerKey();
  // No key means storage is unavailable - a private window, or a browser
  // set to block site data. That person plays and is not counted, which
  // is the right way round.
  if (!key) return;
  const { error } = await supabase.rpc("record_daily_play", { p_key: key });
  if (error) {
    // Swallowed on purpose, and logged rather than shown: a counter must
    // never be able to interrupt the guess that triggered it.
    console.error("Could not record today's play", error);
    return;
  }
  markCounted(day);
}

// Today's count. Returns null when it cannot be read, and the caller
// draws nothing - an empty space is better than a zero, which would be a
// lie about the day rather than an absence of information.
export async function fetchPlayersToday(): Promise<number | null> {
  const { data, error } = await supabase.rpc("daily_players_today");
  if (error) {
    console.error("Could not read today's player count", error);
    return null;
  }
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}
