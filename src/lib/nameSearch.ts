// Typing a name should not require typing its punctuation.
//
// A third of the guess pool - 346 of them - has a period, an apostrophe or
// a hyphen in it, and every one was a small trap. "A.J. Brown" did not
// answer to "aj". "Ja'Marr Chase" did not answer to "jam", because the
// apostrophe falls between the "ja" and the "marr", so you had to know the
// name was spelled with one AND find the key for it on a phone keyboard,
// mid-guess, on a timer. Nobody is trying to test that.
//
// Two keys per name, because one is not enough:
//
//   "A.J. Brown"        loose "aj brown"        tight "ajbrown"
//   "Amon-Ra St. Brown" loose "amonra st brown" tight "amonrastbrown"
//   "Ja'Marr Chase"     loose "jamarr chase"    tight "jamarrchase"
//
// The loose key keeps word boundaries, so "st brown" still finds St.
// Brown. The tight key drops them, so "amonra st" and "amonrast" both do
// too - a hyphen removed rather than turned into a space would otherwise
// make "vera tucker" miss "Vera-Tucker". Comparing both is cheaper than
// deciding which one a person meant.

// Everything that is not a letter, a number or a space. \p{L} rather than
// a-z so that accented names normalise instead of being deleted.
const NOT_SEARCHABLE = /[^\p{L}\p{N} ]/gu;
const COMBINING_MARKS = /\p{M}/gu;

// NFD splits an accented character into its letter plus its accent, which
// is what makes the accent removable. Without it, "Nacua" typed without
// the accent misses a name that carries one.
export function looseKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NOT_SEARCHABLE, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tightKey(value: string): string {
  return looseKey(value).replace(/ /g, "");
}

export type SearchKeys = { loose: string; tight: string };

export function searchKeys(value: string): SearchKeys {
  const loose = looseKey(value);
  return { loose, tight: loose.replace(/ /g, "") };
}

// -1 no match, 0 the name starts with what was typed, 1 it contains it.
// Numbered so a caller can sort by it: somebody typing "jam" wants
// Ja'Marr before Benjamin.
export function matchRank(name: SearchKeys, query: SearchKeys): -1 | 0 | 1 {
  if (!query.loose) return -1;
  if (name.loose.startsWith(query.loose) || name.tight.startsWith(query.tight)) return 0;
  if (name.loose.includes(query.loose) || name.tight.includes(query.tight)) return 1;
  return -1;
}
