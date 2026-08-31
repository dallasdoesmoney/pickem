// A quiet expandable section, for the things a page has to be able to say
// without saying them at the top of its voice.
//
// <details> rather than a modal or a state toggle, deliberately. Its
// contents are in the DOM whether it is open or shut, so they are in the
// server-rendered HTML - which is the point on pages whose real content is
// a board of logos or a grid of coloured chips, and which a JavaScript
// modal would not be. It is also keyboard-operable, announces its own
// state to a screen reader and survives with JavaScript off, none of which
// a div with an onClick does for free.
//
// Shut by default: somebody who has played before wants the game, not the
// instructions.
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mx-auto w-full max-w-2xl px-4 pb-14">
      <summary
        className="mx-auto flex cursor-pointer list-none items-center justify-center gap-2 py-2 text-[11px] tracking-[0.2em] text-white/35 transition-colors hover:text-white/70 [&::-webkit-details-marker]:hidden"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label.toUpperCase()}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-3 border-t border-white/10 pt-5">{children}</div>
    </details>
  );
}
