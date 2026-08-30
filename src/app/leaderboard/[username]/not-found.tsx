import Link from "next/link";

// The page used to render this itself, with the name you typed in it -
// but it did so with a 200, which told crawlers that every misspelling of
// every username was a real page. It is a real 404 now, and a 404 has no
// params to read, so the name goes and the way back stays.
export default function PlayerNotFound() {
  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <Link href="/leaderboard" className="text-xs text-white/40 hover:text-white/70 transition-colors">
        &larr; Back to leaderboard
      </Link>
      <div className="text-center py-16 text-white/50">
        <div className="text-4xl mb-3">🏈</div>
        <p className="text-sm">No player found at that address.</p>
      </div>
    </main>
  );
}
