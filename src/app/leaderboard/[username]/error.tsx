"use client";

import Link from "next/link";

// The cost of fetching on the server: the old client page caught its own
// failure and printed a line of red text, and a server page that throws
// gets whatever error screen the framework has. There was none in this
// app, so a Supabase outage turned every profile into Next's stock error
// page.
//
// A 500 is still the right ANSWER here - the profile may well exist and
// we could not tell - so this does not soften it into a 404 or a 200. It
// just says so in the site's own voice, and offers the two things that
// actually help: try again, or go back to the board.
export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <Link href="/leaderboard" className="text-xs text-white/40 hover:text-white/70 transition-colors">
        &larr; Back to leaderboard
      </Link>
      <div className="text-center py-16 text-white/50">
        <div className="text-4xl mb-3">📡</div>
        <p className="text-sm">Couldn&rsquo;t load that profile just now.</p>
        <button
          onClick={reset}
          className="mt-5 rounded-full border border-white/20 px-5 py-2 text-xs tracking-[0.18em] text-white/80 hover:bg-white/10 transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TRY AGAIN
        </button>
      </div>
    </main>
  );
}
