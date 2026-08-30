import { RouteLoading } from "@/components/RouteLoading";

// In a route group, so it covers /leaderboard and NOT
// /leaderboard/[username].
//
// A loading.tsx is a Suspense boundary around everything below it, and a
// Suspense boundary is a promise that the first bytes will be the
// fallback and the real content will follow. For the leaderboard itself
// that is exactly right - it is a client component fetching a board, and
// without this a tap sat on the previous page with no feedback at all.
//
// For a profile it is the opposite of what is wanted: it made the first
// response a spinner with the player hidden behind it until JavaScript
// ran, which is precisely the thing making that page a server component
// was meant to fix. The route group is URL-transparent, so /leaderboard
// is still /leaderboard; only the boundary moved.
export default function Loading() {
  return <RouteLoading label="Leaderboard" />;
}
