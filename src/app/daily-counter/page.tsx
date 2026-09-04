"use client";

import { COUNTERS, CounterStyles, PlayersToday, useFakeCount, type CounterKey } from "@/components/daily/PlayersToday";

// FOUR WAYS TO SHOW HOW MANY PEOPLE PLAYED TODAY, in the two places it
// would go: the home page card, and the game's own header.
//
// The number here is FAKE and creeping upward on a timer, because the
// only question worth answering from a picture is whether the thing
// reads as alive - and a static screenshot of a counter cannot answer
// it. Nothing on this page talks to the database; see the notes at the
// bottom for what would have to be built.
//
// Scratch page. It goes when one of the four is picked.

// A stand-in for the home card, matched to the real one's geometry -
// dark art panel, scrim, display-face caption, status line under it.
// Close enough to judge against; it is not the real component, because
// the real one lives inside the home route.
function CardMock({ kind, count }: { kind: CounterKey; count: number }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10"
      style={{ background: "#0b1220", containerType: "inline-size" }}
    >
      <div className="relative flex h-40 items-center justify-center bg-[#050a15] p-2.5">
        <span className="text-[11px] tracking-[0.2em] text-white/20">[ THE BOARD ART ]</span>
        {kind === "pill" && (
          <span className="absolute right-2.5 top-2.5">
            <PlayersToday kind={kind} count={count} />
          </span>
        )}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: "90%",
          background:
            "linear-gradient(to top, rgba(3,7,15,1.13) 0%, rgba(3,7,15,0.59) 42%, rgba(3,7,15,0) 100%)",
        }}
      />
      <div className="relative px-3 pb-3 pt-2.5">
        <div className="leading-[1.08]" style={{ fontFamily: "var(--font-display)", fontSize: 26, textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
          NFL NAMEPLATE
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] tracking-[0.09em] text-white/60">
          {/* The live dot REPLACES the caption's static one rather than
              sitting next to it - two dots on one line is the tell that
              something was bolted on. */}
          {kind === "dot" ? (
            <PlayersToday kind={kind} count={count} />
          ) : (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#fb923c" }} />
              TODAY &middot; 8 GUESSES
            </>
          )}
          {kind !== "dot" && kind !== "pill" && <PlayersToday kind={kind} count={count} />}
        </div>
        {kind === "dot" && (
          <div className="mt-1 text-[10px] tracking-[0.09em] text-white/45">TODAY &middot; 8 GUESSES</div>
        )}
      </div>
    </div>
  );
}

// A stand-in for the game page header: the mark, the title lockup, and
// the line under it. The counter sits below the subtitle, which is the
// only horizontal space up there that is not already spoken for.
function HeaderMock({ kind, count }: { kind: CounterKey; count: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-5">
      <div className="flex flex-col items-center text-center">
        <h3 className="whitespace-nowrap leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          <span className="text-[18px] text-white/70">NFL </span>
          <span className="text-[34px]">NAMEPLATE</span>
        </h3>
        <p className="mt-1 text-[13px] leading-tight text-white/45">The daily NFL player guessing game</p>
        <div className="mt-2.5 text-white/60">
          <PlayersToday kind={kind} count={count} variant="strip" />
        </div>
      </div>
    </div>
  );
}

export default function DailyCounterPage() {
  const count = useFakeCount();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-8">
      <CounterStyles />
      <h1 className="text-[clamp(1.5rem,6vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        WHO PLAYED TODAY
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Four ways to draw a live count of everybody who has played since midnight Eastern, in the two places it
        would go. The number is <strong className="font-semibold text-white/75">fake and creeping upward on a
        timer</strong> &mdash; the only thing worth judging from a picture is whether it reads as alive, and a
        still frame cannot tell you that.
      </p>

      <div className="mt-9 flex flex-col gap-14">
        {COUNTERS.map((c) => (
          <section key={c.key}>
            <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
              {c.name.toUpperCase()}
            </h2>
            <p className="mb-5 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{c.note}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[10px] tracking-[0.14em] text-white/35">ON THE HOME CARD</div>
                <CardMock kind={c.key} count={count} />
              </div>
              <div>
                <div className="mb-2 text-[10px] tracking-[0.14em] text-white/35">ON THE NFL NAMEPLATE PAGE</div>
                <HeaderMock kind={c.key} count={count} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16 max-w-2xl">
        <h2 className="text-[15px] tracking-[0.14em] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
          WHAT IT WOULD TAKE
        </h2>
        <div className="mt-3 flex flex-col gap-3 text-[13px] leading-relaxed text-white/55">
          <p>
            <strong className="text-white/80">Signed-in players are already counted.</strong> Every guess is a row
            in <code className="text-white/70">puzzle_guesses</code> with the day on it, so today&rsquo;s signed-in
            players are one query and no new storage.
          </p>
          <p>
            <strong className="text-white/80">Signed-out players are not recorded at all.</strong> That is
            deliberate &mdash; <code className="text-white/70">puzzle_guest_compare</code> grades a guess and
            forgets it, on purpose, so playing without an account leaves no trace. Counting guests means starting
            to keep one: a random id in the browser, and a row per person per day. No account, no name, no IP.
          </p>
          <p>
            <strong className="text-white/80">It can be gamed, mildly.</strong> Clearing site data and playing
            again counts twice. For a fun counter that is fine; it is worth knowing rather than discovering.
          </p>
          <p>
            <strong className="text-white/80">&ldquo;Played&rdquo; should mean a first guess</strong>, not a page
            open &mdash; opening the page is not playing, and counting opens would inflate the number with
            crawlers.
          </p>
        </div>
      </section>
    </main>
  );
}
