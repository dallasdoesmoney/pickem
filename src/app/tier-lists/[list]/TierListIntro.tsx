import { TierTemplate } from "@/data/tierTemplates";

// WHAT THE PAGE IS, BEFORE ANY JAVASCRIPT RUNS.
//
// This route is statically prerendered, but everything below the Suspense
// boundary is not: the editor reads `?id=` and so renders on the client.
// The prerendered HTML was therefore the boundary's FALLBACK - which was a
// spinner. Fetched the way a crawler fetches it, /tier-lists/nfl-quarterbacks
// came back as eleven words, none of them a quarterback's name, on the page
// whose entire reason to exist is the search "NFL quarterback tier list".
//
// Google runs JavaScript and would eventually have seen the board. The
// crawlers behind AI answers largely do not: they read the first response.
//
// So the fallback is the content now instead of a spinner. Everything here
// comes from the template, which is static data known at build time, and it
// is the same heading and the same names the board shows a moment later -
// nothing is written for crawlers that a person does not also see, which is
// the line between this and cloaking.
//
// It is a better loading state too. A spinner tells you to wait; this tells
// you that you are on the right page and what is on it.
export function TierListIntro({ template }: { template: TierTemplate }) {
  const [, plural] = template.itemNoun;
  const count = template.items.length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-10 pb-16">
      <h1
        className="text-center text-[clamp(1.25rem,5.4vw,2.6rem)] leading-none tracking-wide"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {`${template.title} Tier List`.toUpperCase()}
      </h1>
      <p className="mt-3 text-center text-sm text-white/55">{template.tagline}.</p>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/45">
        Drag {count} {plural} into tiers, save your board, and share the card.
      </p>

      <div className="mt-8 flex justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-white/25 border-t-white animate-spin" aria-hidden />
        <span className="sr-only" role="status">
          Loading the board
        </span>
      </div>

      {/* The names, as text. This is the half a crawler can read and the
          half the board itself cannot give it - the board draws faces and
          logos, and a picture of Patrick Mahomes is not the string
          "Patrick Mahomes" to anything that is not looking at it. */}
      <section className="mt-10 border-t border-white/10 pt-6">
        <h2 className="text-center text-[11px] tracking-[0.2em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
          {`ALL ${count} ${plural}`.toUpperCase()}
        </h2>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-white/45">
          {template.items.map((item) => item.label).join(" · ")}
        </p>
      </section>
    </main>
  );
}
