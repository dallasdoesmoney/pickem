import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProfileRow, fetchProfileRank } from "@/lib/supabase/server";
import { getLevelInfo, subLevelRoman } from "@/lib/levels";
import { reportError } from "@/lib/sentry";
import { ProfileClient } from "./ProfileClient";

// A SERVER page now. It used to be a client component that rendered a
// spinner and went looking for the player, which meant every shared
// profile link - and this is the link creators share, the one the whole
// creator-forward idea rests on - unfurled as the generic site card with
// the generic site title. Whoever's profile it was appeared only after
// JavaScript ran, which a crawler and a chat app's link preview do not
// wait for.
//
// The row is fetched here and passed down; ProfileClient keeps the parts
// that genuinely need the browser. Not the server-component-plus-static-
// params pattern /predictor/[team] uses - usernames are arbitrary and
// change, so "does this one exist" has to be a real query.

// Points and records move, and this page is small. Rendering it per
// request keeps a profile from being served with yesterday's record, and
// keeps a player who has just changed their display name from seeing the
// old one on their own shared link.
export const dynamic = "force-dynamic";

function describe(row: Awaited<ReturnType<typeof fetchProfileRow>>, rank: number | null) {
  if (!row) return null;
  const name = row.display_name || row.username;
  const level = getLevelInfo(row.total_points);
  // Reads as a sentence about a person, not a row of a table: who they
  // are, where they are on the board, and what their picks have actually
  // done. Each piece is dropped when it would be noise - an unranked
  // player with no graded picks would otherwise get a description made
  // entirely of zeroes.
  const bits = [
    rank !== null ? `#${rank} on the leaderboard` : null,
    row.graded > 0 ? `${row.correct}-${row.graded - row.correct} on picks` : null,
    level.isUnranked ? null : `${level.rankName} ${subLevelRoman(level.subLevel)}`,
    row.streak > 0 ? `${row.streak} day streak` : null,
  ].filter(Boolean);
  return {
    name,
    title: `${name} (@${row.username})`,
    description: bits.length > 0 ? `${bits.join(" · ")}. Follow ${name} on Sideline Brew.` : `${name} on Sideline Brew. Picks, tier lists and the daily game.`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  // A profile that cannot be fetched is not a profile that does not
  // exist, so a failure here gives up on the metadata rather than
  // asserting the player is missing - the page below is what decides
  // whether this is a 404.
  const row = await fetchProfileRow(username).catch((err) => {
    reportError("profile.metadataRow", err);
    return null;
  });
  if (!row) return { title: "Player not found - Sideline Brew", robots: { index: false } };

  const rank = await fetchProfileRank(row).catch((err) => {
    reportError("profile.metadataRank", err);
    return null;
  });
  const d = describe(row, rank)!;
  const url = `/leaderboard/${row.username}`;
  return {
    title: `${d.title} - Sideline Brew`,
    description: d.description,
    // The canonical is the username as the DATABASE spells it, not as the
    // URL did: /leaderboard/Dallas and /leaderboard/dallas would otherwise
    // be two pages with one player on them.
    alternates: { canonical: url },
    openGraph: { type: "profile", siteName: "Sideline Brew", title: d.title, description: d.description, url },
    twitter: { card: "summary_large_image", title: d.title, description: d.description },
  };
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const row = await fetchProfileRow(username);
  if (!row) notFound();
  return <ProfileClient row={row} />;
}
