// THE CARDS. Two opposite ideas, and everything in between.
//
// Written rather than lifted. The board game's own deck is its deck; the
// mechanic is a spectrum with a hidden point on it, and a spectrum is
// just a pair of words. So these are ours, and they lean the way the
// site leans - about half are football, because the room is a football
// room and "UNDERRATED / OVERRATED" lands harder when the clue is allowed
// to be a quarterback.
//
// WHAT MAKES A GOOD PAIR, learned by writing the bad ones first:
//
//   It has to be a LINE, not a box. "Hot / Cold" is a line. "Offense /
//   Defense" is two categories with nothing in between, so a clue in the
//   middle means nothing and the round dies.
//
//   Both ends have to be ORDINARY. If one end is absurd, every clue
//   crowds the other end and the dial never leaves the edge.
//
//   It has to survive a one-word clue. That is the whole game: the
//   psychic gets one word and the team has to place it.

export type Spectrum = {
  id: string;
  // Reads left, then right. The dial runs 0 at `left` to 100 at `right`.
  left: string;
  right: string;
  // Football or not. The picker offers "all" or "football only", because
  // a room that came for the NFL does not necessarily want "Cat / Dog".
  nfl?: boolean;
};

const raw: [string, string, boolean?][] = [
  // ---- football -----------------------------------------------------
  ["Underrated", "Overrated", true],
  ["Bad team", "Good team", true],
  ["Boring offense", "Fun offense", true],
  ["Backup", "Franchise QB", true],
  ["Bad uniform", "Great uniform", true],
  ["Hated rival", "Team you respect", true],
  ["Rebuilding", "Win-now", true],
  ["Small market", "Huge market", true],
  ["Fluke season", "Real contender", true],
  ["Terrible fans", "Best fans in football", true],
  ["Bust", "Hall of Famer", true],
  ["Punt it", "Go for it", true],
  ["Cold weather team", "Dome team", true],
  ["Should be fired", "Coach of the Year", true],
  ["Ugly stadium", "Best stadium in the league", true],
  ["Nobody knows him", "Household name", true],
  ["Safe pick", "Massive reach", true],
  ["Practice squad", "All-Pro", true],
  ["Run it", "Air it out", true],
  ["Overpaid", "Bargain contract", true],
  ["Soft schedule", "Brutal schedule", true],
  ["One-year wonder", "Decade of dominance", true],
  ["Kicker", "Franchise cornerstone", true],
  ["Fantasy bust", "League winner", true],
  ["Bad beat", "Easy cover", true],
  ["Preseason", "Playoffs", true],
  ["Forgettable game", "Instant classic", true],
  ["College town", "Pro sports city", true],
  ["Draft him late", "First overall", true],
  ["Trap game", "Statement game", true],
  ["Gadget play", "Bread and butter", true],
  ["Blowout", "One-score game", true],
  ["Bad announcer", "Legendary voice", true],
  ["Empty seats", "Impossible ticket", true],
  ["Journeyman", "Face of the franchise", true],
  ["Bad call", "Textbook officiating", true],
  ["Nobody's watching", "Everybody's watching", true],
  ["Overthinking it", "Just run the ball", true],

  // ---- everything else ----------------------------------------------
  ["Cold", "Hot"],
  ["Useless", "Essential"],
  // NOT "Underrated / Overrated" again - the football half already has
  // it, and in the everything deck the same argument would come up twice
  // under two different ids.
  ["Bad idea", "Genius idea"],
  ["Cheap", "Expensive"],
  ["Ugly", "Beautiful"],
  ["Forgettable", "Unforgettable"],
  ["Quiet", "Loud"],
  ["Bad habit", "Good habit"],
  ["Guilty pleasure", "Genuinely great"],
  ["Kids' food", "Adult food"],
  ["Round", "Pointy"],
  ["Soft", "Hard"],
  ["Boring job", "Dream job"],
  ["Easy", "Impossible"],
  ["Fake", "Real"],
  ["Common", "Rare"],
  ["Low effort", "Enormous effort"],
  ["Terrible movie", "Masterpiece"],
  ["Weak drink", "Strong drink"],
  ["Rough", "Smooth"],
  ["Bad smell", "Great smell"],
  ["Weird pet", "Normal pet"],
  ["Nobody's hobby", "Everybody's hobby"],
  ["Trash food", "Fine dining"],
  ["Bad excuse", "Airtight excuse"],
  ["Petty crime", "Genuine evil"],
  ["Awkward", "Smooth"],
  ["Dated", "Timeless"],
  ["Overhyped", "Delivers"],
  ["Bad first date", "Great first date"],
  ["Tiny", "Enormous"],
  ["Slow", "Fast"],
  ["Old technology", "The future"],
  ["Bad gift", "Perfect gift"],
  ["Chore", "Treat"],
  ["Nobody likes it", "Universally loved"],
  ["Dangerous", "Completely safe"],
  ["Overdressed", "Underdressed"],
  ["Bad advice", "Life-changing advice"],
  ["Cheesy", "Genuinely cool"],
  ["Painful", "Relaxing"],
  ["Simple", "Complicated"],
  ["Dirty", "Clean"],
  ["Bad song", "Banger"],
  ["Waste of money", "Worth every penny"],
  ["Introvert", "Extrovert"],
  ["Snack", "Full meal"],
  ["Would not survive", "Would thrive"],
  ["Everyday", "Once in a lifetime"],
  ["Bad tattoo", "Great tattoo"],
];

export const SPECTRUMS: Spectrum[] = raw.map(([left, right, nfl], i) => ({
  id: `s${i}`,
  left,
  right,
  nfl: nfl === true,
}));

export const NFL_SPECTRUMS = SPECTRUMS.filter((s) => s.nfl);

// The two decks the picker offers. Named the way they are chosen rather
// than the way they are stored.
export type DeckKey = "everything" | "football";

export const DECKS: { key: DeckKey; title: string; note: string; cards: Spectrum[] }[] = [
  { key: "everything", title: "Everything", note: "Football and not", cards: SPECTRUMS },
  { key: "football", title: "Football only", note: "Every card is an NFL argument", cards: NFL_SPECTRUMS },
];

export function deck(key: DeckKey): Spectrum[] {
  return (DECKS.find((d) => d.key === key) ?? DECKS[0]).cards;
}
