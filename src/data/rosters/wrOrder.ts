import type { TeamAbbr } from "@/data/teams";

// WHICH TWO RECEIVERS ARE THE WR DUO, where the data cannot say.
//
// TEMPORARY. Every line here is deleted by the next `npm run sync:players`
// being correct on its own - see the bottom of this file.
//
// WHAT WENT WRONG. The roster files are sorted by name, so "the top two
// receivers" needed an ordering and did not have one. It was rebuilt from
// `depthRank` in all.ts, which sounded like the right field and is not:
// depthRanksAt() walks EVERY slot in every formation with no position
// filter, so it means "this player starts somewhere on the chart" -
// punt returner and kick returner included. That is exactly what it was
// built for, as the daily puzzle's threshold for an answerable player.
//
// A returner is rank 1 at returner. So he ties with the actual WR1, an
// alphabetical tiebreak decides, and Washington's duo came out Luke
// McCaffrey and Terry McLaurin with Stefon Diggs nowhere - McCaffrey
// being, in the real world, their fourth receiver.
//
// Nine of thirty-two teams have that tie. The membership is right in all
// of them - depthChartAt DOES filter by position, so the three receivers
// are the right three - it is only the ORDER between them that was
// guessed.
//
// THE REAL FIX is one sync. scripts/sync-players.mjs now records the
// chart order it picked in, on the row, as `depth`; running it writes the
// true order for all 32 teams and this file stops mattering. Until then,
// anything listed here wins.
//
// Names, not ids, because this is a file a person reads and corrects in
// ten seconds. A name that is not on that team fails the test rather than
// being silently ignored.
export const WR_ORDER: Partial<Record<TeamAbbr, string[]>> = {
  // Confirmed wrong on the stream: McCaffrey is Washington's fourth
  // receiver, not half of the duo.
  WAS: ["Terry McLaurin", "Stefon Diggs", "Luke McCaffrey"],

  // THE OTHER EIGHT WITH THE SAME TIE, left alone rather than guessed at.
  //
  // Each line is the current order, which is alphabetical among the tied
  // players and therefore arbitrary. Reorder and uncomment any that are
  // wrong; the first two names are the duo.
  //
  // NE:  ["A.J. Brown", "DeMario Douglas", "Romeo Doubs"],
  // JAX: ["Brian Thomas Jr.", "Parker Washington", "Jakobi Meyers"],
  // SEA: ["Jaxon Smith-Njigba", "Rashid Shaheed", "Cooper Kupp"],
  // LAR: ["Jordan Whittington", "Puka Nacua", "Davante Adams"],
  // BUF: ["DJ Moore", "Khalil Shakir", "Keon Coleman"],
  // ATL: ["Drake London", "Jahan Dotson", "Olamide Zaccheaus"],
  // HOU: ["Jaylin Noel", "Nico Collins", "Xavier Hutchinson"],
  // CHI: ["Kalif Raymond", "Rome Odunze", "Luther Burden III"],
};
