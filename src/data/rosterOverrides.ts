// Hand-picked replacements for what ESPN's depth chart says.
//
// The chart is right about who a team lists first and wrong, sometimes,
// about who is actually going to play - it lags injuries by days, and a
// long-term absence can sit at the top of a chart for weeks. Everything
// downstream of the chart inherits that: the tier lists rank a player who
// is not playing, and the daily puzzle can make him the answer.
//
// So this is the one place a person overrules the feed. Keyed by team and
// position, holding ESPN player ids, and applied by
// scripts/sync-players.mjs AFTER it has picked from the chart - which is
// what makes an entry survive the weekly sync instead of being quietly
// written back over.
//
// Two rules for anything added here:
//
//   Say why, and say when. An override with no reason is impossible to
//   retire, because nobody can tell whether the thing that caused it is
//   still true.
//
//   Delete it when it stops being true. This is a patch over live data,
//   not a second source of truth - the longer an entry sits, the more
//   likely it is the chart has moved on and this is now the wrong answer.
//
// The count must match what the position expects: one for QB, RB and TE,
// two for WR. The sync refuses the run rather than shipping a short list.
export const ROSTER_OVERRIDES: Record<string, string[]> = {
  // Zach Charbonnet (4426385) is out for an extended spell; Jadarian
  // Price is Seattle's second back and the one taking the carries.
  // Added 2026-08-26. Remove when Charbonnet is back.
  "SEA RB": ["4685512"],
};
