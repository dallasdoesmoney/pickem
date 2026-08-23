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
