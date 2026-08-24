import { supabase } from "@/lib/supabase/client";

export type CheckInResult = {
  // False when today's check-in was already claimed - which is the normal
  // case on every load after the first one of the day.
  awarded: boolean;
  points: number;
  streak: number;
  longest: number;
};

// Claim today's check-in. Takes no arguments on purpose: the date and the
// once-per-day rule both live in the database (see
// supabase/migrations/0041_daily_check_in.sql), because a client that can
// name the day can claim a year of them.
//
// Safe to call on every session load - the second call of a day is a
// no-op that just reports the streak back.
export async function dailyCheckIn(): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc("daily_check_in");
  if (error) throw error;
  const row = (data ?? {}) as Partial<CheckInResult>;
  return {
    awarded: row.awarded === true,
    points: Number(row.points ?? 0),
    streak: Number(row.streak ?? 0),
    longest: Number(row.longest ?? 0),
  };
}

// The day the server would call today. daily_check_in() stamps
// reference_id with the New York date, so anything drawing a calendar of
// past check-ins has to ask the same question the same way - a viewer in
// Los Angeles at 10pm is already on tomorrow's date in New York, and a
// strip built from their local date would mark the wrong square.
export function checkInDateKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // en-CA formats as YYYY-MM-DD, which is what the date column casts to.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type CheckInStats = {
  // Every check-in ever, not just the ones in `recentDays`.
  total: number;
  streak: number;
  longest: number;
  // Newest first, one entry per day, starting today. True = checked in.
  recentDays: { date: string; checked: boolean }[];
  checkedInToday: boolean;
};

const RECENT_DAYS = 7;

// Own-row read only - point_events and profiles are both "select own", so
// this works for the signed-in user's own Challenges tab and nowhere
// else. A public version would need a security-definer RPC, the way
// public_lock_bonus_count does.
export async function fetchCheckInStats(userId: string): Promise<CheckInStats> {
  const window = Array.from({ length: RECENT_DAYS }, (_, i) => checkInDateKey(i));

  const [{ count, error: countError }, { data: recent, error: recentError }, { data: prof, error: profError }] = await Promise.all([
    supabase.from("point_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "daily_check_in"),
    // Ask only for the week being drawn rather than fetching the whole
    // history and slicing it here - this grows by one row a day forever.
    supabase
      .from("point_events")
      .select("reference_id")
      .eq("user_id", userId)
      .eq("source", "daily_check_in")
      .in("reference_id", window),
    supabase.from("profiles").select("check_in_streak, longest_check_in_streak").eq("id", userId).single(),
  ]);

  if (countError) throw countError;
  if (recentError) throw recentError;
  if (profError) throw profError;

  const hit = new Set((recent as { reference_id: string }[]).map((r) => r.reference_id));
  const recentDays = window.map((date) => ({ date, checked: hit.has(date) }));

  return {
    total: count ?? 0,
    streak: Number(prof?.check_in_streak ?? 0),
    longest: Number(prof?.longest_check_in_streak ?? 0),
    recentDays,
    checkedInToday: recentDays[0].checked,
  };
}
