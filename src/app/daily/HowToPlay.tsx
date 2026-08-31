import { Disclosure } from "@/components/Disclosure";

// What the game is, in the first response.
//
// /daily served fourteen words to anything that does not run JavaScript:
// the nav, the word NAMEPLATE, and "NFL Guessing Game". The board itself
// cannot help - it is a spinner until useAuth resolves, and even loaded it
// is a grid of coloured chips. So the page had nothing to say about itself
// to a search for "NFL player guessing game", which is the search it
// exists to answer.
//
// Behind a disclosure rather than laid out under the board. A page of
// explanation beneath a game is an SEO habit rather than a design, and
// this is a game people come back to daily - the second visit does not
// want the rules. <details> keeps the words in the HTML either way; see
// the note on the component.
export function HowToPlay() {
  return (
    <Disclosure label="How to play">
      <p className="text-[13px] leading-relaxed text-white/55">
        Nameplate is a free daily NFL guessing game. One mystery player, eight guesses, and the
        same player for everyone that day &mdash; so the result is worth comparing. No account
        is needed to play; signing in saves your streak and your record.
      </p>

      <p className="mt-3 text-[13px] leading-relaxed text-white/55">
        Every guess is a real active player, and each one reports back on six things: their{" "}
        <strong className="font-normal text-white/80">team</strong>,{" "}
        <strong className="font-normal text-white/80">division</strong>,{" "}
        <strong className="font-normal text-white/80">position</strong>,{" "}
        <strong className="font-normal text-white/80">age</strong>,{" "}
        <strong className="font-normal text-white/80">height</strong> and{" "}
        <strong className="font-normal text-white/80">jersey number</strong>. Green means an
        exact match, yellow means close &mdash; the right conference but the wrong division, or
        an age within a year or two &mdash; and an arrow tells you which way to go on the
        numbers.
      </p>

      <p className="mt-3 text-[13px] leading-relaxed text-white/55">
        A new player unlocks every day at midnight Eastern. Solve it and you can share a
        spoiler-free grid of your guesses. Unlimited mode on this page deals a fresh player as
        often as you like &mdash; it just does not count toward your streak.
      </p>
    </Disclosure>
  );
}
