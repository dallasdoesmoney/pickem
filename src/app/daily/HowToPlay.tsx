// What the game is, in the first response.
//
// /daily served fourteen words to anything that does not run JavaScript:
// the nav, the word NAMEPLATE, and "NFL Guessing Game". The board itself
// cannot help - it is a spinner until useAuth resolves, and even loaded it
// is a grid of coloured chips. So the page had nothing to say about itself
// to a search for "NFL player guessing game", which is the search it
// exists to answer.
//
// Under the board rather than above it, because a returning player wants
// the game and not the instructions. It is a real explanation for a real
// reader who has just arrived and does not know what the columns mean;
// that it also gives a crawler something to read is the same sentence
// doing two jobs, not a second sentence written for machines.
//
// Rendered from the route's layout, which is a server component, so it is
// in the HTML whatever the board is doing.
export function HowToPlay() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div className="border-t border-white/10 pt-7">
        <h2
          className="text-center text-[11px] tracking-[0.2em] text-white/40"
          style={{ fontFamily: "var(--font-display)" }}
        >
          HOW NAMEPLATE WORKS
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-[13px] leading-relaxed text-white/55">
          Nameplate is a free daily NFL guessing game. One mystery player, eight guesses, and
          the same player for everyone that day &mdash; so the result is worth comparing. No
          account is needed to play; signing in saves your streak and your record.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/55">
          Every guess is a real active player, and each one reports back on six things: their{" "}
          <strong className="font-normal text-white/80">team</strong>,{" "}
          <strong className="font-normal text-white/80">division</strong>,{" "}
          <strong className="font-normal text-white/80">position</strong>,{" "}
          <strong className="font-normal text-white/80">age</strong>,{" "}
          <strong className="font-normal text-white/80">height</strong> and{" "}
          <strong className="font-normal text-white/80">jersey number</strong>. Green means an
          exact match, yellow means close &mdash; the right conference but the wrong division,
          or an age within a year or two &mdash; and an arrow tells you which way to go on the
          numbers. Eight guesses is usually plenty once the first one narrows the league down.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/55">
          A new player unlocks every day at midnight Eastern. Solve it and you can share a
          spoiler-free grid of your guesses. If you want more than one, Unlimited mode on this
          page deals a fresh player as often as you like &mdash; it just does not count toward
          your streak.
        </p>
      </div>
    </section>
  );
}
