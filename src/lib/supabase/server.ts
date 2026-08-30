import { createClient } from "@supabase/supabase-js";
import { LEADERBOARD_COLUMNS, type LeaderboardRow } from "@/lib/supabase/leaderboard";

// The FIRST server-side reader in this codebase. Everything until now was
// a client component talking to the browser singleton in client.ts, which
// is fine while every page is a client page - but a profile that wants a
// real <title> and a real og:image has to be fetched before the HTML is
// sent, and the browser singleton is the wrong object for that: it is one
// long-lived instance that holds a session, and on a server one instance
// is shared by every request from every visitor.
//
// So this one is built per call and holds nothing. Same ANON key, so it
// sees exactly what a signed-out visitor sees and RLS still applies -
// this is not a service-role client and must never become one. The
// leaderboard view it reads is public by design.
export function serverSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The profile page's row, fetched three times per request in the worst
// case - generateMetadata, the page itself and the OG image are separate
// entry points and cannot hand each other a value. React's request cache
// collapses the first two; the OG image is a different request entirely.
// It is one indexed lookup on a view, so that is affordable, and the
// alternative - threading the row through - is not available across a
// route handler boundary.
//
// Returns null for "no such player", which is a 404, and THROWS for a
// network or database failure, which is not: a profile that exists must
// never be told it does not because Supabase was briefly unreachable.
export async function fetchProfileRow(username: string): Promise<LeaderboardRow | null> {
  const { data, error } = await serverSupabase()
    .from("leaderboard")
    .select(LEADERBOARD_COLUMNS)
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as LeaderboardRow | null) ?? null;
}

// There is no rank column - see leaderboard.ts, where the page finds your
// position by index in the sorted array it already has. A profile page
// has no such array, and fetching every row to number one of them is the
// kind of thing that works on a leaderboard of forty and falls over on a
// leaderboard of forty thousand.
//
// So: count who is ahead, and add one. The three clauses are the same
// three keys leaderboard.ts sorts by, in the same order, so the number
// here and the position on the board cannot disagree. Usernames are
// [a-zA-Z0-9_] by policy (usernamePolicy.ts), which is what makes it safe
// to put one inside a PostgREST or() filter.
export async function fetchProfileRank(row: LeaderboardRow): Promise<number | null> {
  const { count, error } = await serverSupabase()
    .from("leaderboard")
    .select("user_id", { head: true, count: "exact" })
    .or(
      [
        `correct.gt.${row.correct}`,
        `and(correct.eq.${row.correct},total_points.gt.${row.total_points})`,
        `and(correct.eq.${row.correct},total_points.eq.${row.total_points},username.lt.${row.username})`,
      ].join(",")
    );
  // A rank we could not work out is left out of the title rather than
  // guessed at - "#1" for everybody would be worse than no rank at all.
  if (error || count === null) return null;
  return count + 1;
}
