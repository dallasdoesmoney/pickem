// Shown the instant a navigation starts, via each route's loading.tsx.
//
// Without a loading boundary the App Router keeps the *previous* page on
// screen until the next one has its code and its data, so a tap produced
// no feedback at all for a second or more and read as a dead button. This
// costs nothing and makes the press register immediately.
export function RouteLoading({ label }: { label?: string }) {
  return (
    <main className="flex-1 px-4 pt-16 pb-16 w-full flex flex-col items-center justify-start gap-4">
      <span className="h-7 w-7 rounded-full border-2 border-white/25 border-t-white animate-spin" aria-hidden />
      <span className="sr-only" role="status">
        Loading{label ? ` ${label}` : ""}
      </span>
      {label && (
        <span className="text-xs text-white/40 tracking-[0.2em]" style={{ fontFamily: "var(--font-display)" }}>
          {label.toUpperCase()}
        </span>
      )}
    </main>
  );
}
