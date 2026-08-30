import type { Metadata } from "next";

// page.tsx is a client component and cannot export metadata, so the
// route's layout carries it - same arrangement as /daily.
export const metadata: Metadata = {
  title: "Leaderboard - Sideline Brew",
  description: "Who is ahead on picks, tier lists and the daily game. Points, levels and streaks for every player.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "Sideline Brew Leaderboard",
    description: "Who is ahead on picks, tier lists and the daily game.",
    url: "/leaderboard",
  },
  twitter: { card: "summary_large_image", title: "Sideline Brew Leaderboard" },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
