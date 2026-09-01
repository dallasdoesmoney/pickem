import Link from "next/link";

// THE ONLY WORDS ON THIS PAGE A SEARCH ENGINE CAN READ.
//
// The game itself is a board of eight rows of coloured chips. It is the
// whole point of the page and it is, to a crawler, almost nothing: a
// heading, some player names that change every day, and a wall of divs.
// Somebody googling "NFL Nameplate" was being offered a page with no
// text on it that said what NFL Nameplate is.
//
// So this is that text. Not filler under the fold - the honest answers
// to the four things anyone asks before playing, which is also exactly
// what somebody types into Google. It renders on the SERVER, in the HTML
// of the first response, because the game above it does not: everything
// in DailyPuzzle is behind "use client" and a fetch.
//
// The questions here and the FAQPage JSON-LD in the page are ONE list,
// defined once below and rendered twice. Structured data that disagrees
// with the visible page is worse than none - Google treats it as a
// reason to distrust the rest.

export const FAQ = [
  {
    q: "What is NFL Nameplate?",
    a: "NFL Nameplate is a free daily guessing game: one mystery NFL player a day, eight guesses to name him. Everybody in the world gets the same player on the same day, and a new one drops every morning.",
  },
  {
    q: "How do you play NFL Nameplate?",
    a: "Guess any active NFL player. Every guess comes back scored against the mystery player across six columns - team, division, position, age, height and jersey number - so a wrong guess still tells you something. Green is an exact match, yellow is close (same conference, within three years, within two inches, within three on the number), and an arrow shows whether the answer is higher or lower. Narrow it down and name him inside eight tries.",
  },
  {
    q: "Is NFL Nameplate free, and do I need an account?",
    a: "It is free, and no. You can play today's board without signing in. An account is only there if you want your streak, your win rate and your guess distribution kept across devices.",
  },
  {
    q: "When does a new NFL Nameplate come out?",
    a: "A new player unlocks every day at midnight Eastern. Your streak survives as long as you solve each day's board before the next one lands.",
  },
  {
    q: "Can I play more than one NFL Nameplate a day?",
    a: "Yes. The daily board is one player a day and is the one everybody shares, but there is an unlimited mode on the same page that deals you a fresh random player as often as you like. Unlimited rounds do not count towards your streak.",
  },
];

export function NameplateAbout() {
  return (
    // Real prose, so it is styled like prose rather than like the game.
    // Quiet on purpose: this is for the crawler and for the one person in
    // fifty who scrolls past the board, and it must not compete with it.
    // max-w-2xl, narrower than the game card above it, because this is
    // the only running text on the site: at the card's full width a line
    // runs past a hundred characters and the eye loses its place coming
    // back to the left edge. Centred, so it still sits on the card's axis.
    <section className="mx-auto mt-14 w-full max-w-2xl px-1 text-white/60">
      <h2 className="text-[clamp(1.15rem,4.4vw,1.6rem)] leading-tight tracking-wide text-white/85" style={{ fontFamily: "var(--font-display)" }}>
        ABOUT NFL NAMEPLATE
      </h2>
      <p className="mt-3 text-sm leading-relaxed">
        NFL Nameplate is the daily NFL player guessing game from Sideline Brew. One mystery player, eight
        guesses, the same player for everybody &mdash; think Wordle, but the answer is a football player and
        every guess hands back six clues instead of five letters.
      </p>

      <dl className="mt-8 flex flex-col gap-6">
        {FAQ.map(({ q, a }) => (
          <div key={q}>
            <dt className="text-[15px] font-semibold leading-snug text-white/85">{q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed">{a}</dd>
          </div>
        ))}
      </dl>

      {/* Links out, because a page with nothing leaving it is a dead end
          to a crawler as well as to a person - and these are the three
          other things on the site somebody who liked this would want. */}
      <p className="mt-9 text-sm leading-relaxed">
        More NFL games at Sideline Brew:{" "}
        <Link href="/weekly" className="text-white/80 underline underline-offset-2 hover:text-white">
          weekly NFL pick&rsquo;em
        </Link>
        ,{" "}
        <Link href="/predictor" className="text-white/80 underline underline-offset-2 hover:text-white">
          the NFL record predictor
        </Link>{" "}
        and{" "}
        <Link href="/tier-lists" className="text-white/80 underline underline-offset-2 hover:text-white">
          NFL tier lists
        </Link>
        .
      </p>
    </section>
  );
}
