"use client";

import { useState } from "react";
import { FollowersListModal } from "@/components/FollowersListModal";
import { FriendsListModal } from "@/components/FriendsListModal";

// Followers and friends sit with the name and handle rather than down in
// the stat list. Two reasons: it's where every social product puts them,
// so it's the first place anyone looks for them, and it's the one spot on
// the card that isn't competing with the three KPI tiles for attention -
// buried among the secondary rows they were the stats most likely to be
// scrolled past entirely.
//
// Both counts open the same lists the account page uses. That works on
// anyone's profile, not just your own: follows and friends are public
// (see fetchPublicFollowerCount / fetchPublicFriendCount), and the list
// fetchers behind these modals read those same public tables plus the
// public leaderboard view - the "My" in their names is a leftover from
// when the account page was the only caller.
export function ProfileSocialLine({
  userId,
  followerCount,
  friendCount,
}: {
  userId: string;
  followerCount: number | undefined;
  friendCount: number | undefined;
}) {
  const [openList, setOpenList] = useState<"followers" | "friends" | null>(null);

  return (
    <>
      <div className="flex items-center gap-3.5 mt-3">
        <SocialCount count={followerCount} singular="follower" plural="followers" onClick={() => setOpenList("followers")} />
        <span className="h-[3px] w-[3px] rounded-full bg-white/25 shrink-0" />
        <SocialCount count={friendCount} singular="friend" plural="friends" onClick={() => setOpenList("friends")} />
      </div>

      <FollowersListModal userId={userId} open={openList === "followers"} onClose={() => setOpenList(null)} />
      <FriendsListModal userId={userId} open={openList === "friends"} onClose={() => setOpenList(null)} />
    </>
  );
}

// Stays tappable while the count is still loading - the list modal has
// its own spinner, so there's nothing gained by making the target appear
// a beat later than the rest of the card.
function SocialCount({
  count,
  singular,
  plural,
  onClick,
}: {
  count: number | undefined;
  singular: string;
  plural: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-baseline gap-1.5 active:scale-95 transition-transform"
    >
      <span className="text-[15px] leading-none tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {count === undefined ? "–" : count}
      </span>
      <span className="text-xs text-white/55">{count === 1 ? singular : plural}</span>
    </button>
  );
}
