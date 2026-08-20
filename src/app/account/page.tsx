"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { fetchMyLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelsAchievementsModal } from "@/components/LevelsAchievementsModal";
import { MyReferralsModal } from "@/components/MyReferralsModal";
import { FriendsListModal } from "@/components/FriendsListModal";
import { FollowersListModal } from "@/components/FollowersListModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { CreatorRequestModal } from "@/components/CreatorRequestModal";
import { SocialLinksModal } from "@/components/SocialLinksModal";
import { StatTile, StatDetailRow } from "@/components/StatTile";
import { TeamsPredictedRow } from "@/components/TeamsPredictedRow";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { fetchUserBadges } from "@/lib/supabase/badges";
import { getLevelInfo, subLevelRoman } from "@/lib/levels";
import { RankPanel } from "@/components/RankPanel";

export default function AccountPage() {
  const { user, profile: authProfile, loading: authLoading, signOut, refreshProfile } = useAuth();

  if (authLoading) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto flex items-center justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </main>
    );
  }

  return user ? (
    <SignedInAccount userId={user.id} authProfile={authProfile} onSignOut={signOut} onProfileChange={refreshProfile} />
  ) : (
    <SignedOutAccount />
  );
}

// A clean, read-only view - every edit (photo, display name, username)
// lives behind EditProfileModal instead of inline fields here.
function SignedInAccount({
  userId,
  authProfile,
  onSignOut,
  onProfileChange,
}: {
  userId: string;
  authProfile: Profile | null;
  onSignOut: () => Promise<void>;
  onProfileChange: () => Promise<void>;
}) {
  // "Everything a signed-in user can see about themselves" is the
  // superset the public /leaderboard/[username] page is a filtered view
  // of - own record here reuses that exact same leaderboard row/query,
  // just scoped to this account instead of everyone.
  const [myRecord, setMyRecord] = useState<LeaderboardRow | null | undefined>(undefined);
  useEffect(() => {
    fetchMyLeaderboardEntry(userId)
      .then(setMyRecord)
      .catch(() => setMyRecord(null));
  }, [userId]);

  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [referralsOpen, setReferralsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [creatorRequestOpen, setCreatorRequestOpen] = useState(false);
  const [socialLinksOpen, setSocialLinksOpen] = useState(false);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);
  const stats = usePlayerStats(userId);

  useEffect(() => {
    fetchUserBadges(userId)
      .then((badges) => setIsCreator(badges.some((b) => b.badge_key === "creator")))
      .catch(() => setIsCreator(false));
  }, [userId]);

  // One derivation of the wash colour, shared by every panel on the page.
  const rankColor = myRecord ? getLevelInfo(myRecord.total_points).rankColor : null;

  const label = authProfile?.display_name || authProfile?.username || "Your Profile";

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      {/* The identity block used to sit straight on the page, so the tiled
          watermark ran behind the avatar and the name. It gets a surface
          of its own now, washed with the player's own rank colour where
          there is one, so the profile reads as a card rather than as text
          floating over the wallpaper. */}
      <RankPanel
        rankColor={rankColor}
        tone="hero"
        className="rounded-3xl border border-white/12 bg-[#101d38] px-6 pt-8 pb-6"
        innerClassName="flex flex-col items-center"
      >
        <div className="relative">
          {authProfile?.avatar_url ? (
            <img
              src={authProfile.avatar_url}
              alt=""
              className="h-28 w-28 rounded-full object-cover"
              style={myRecord ? { boxShadow: `0 0 0 2px ${getLevelInfo(myRecord.total_points).rankColor}, 0 0 10px -2px ${getLevelInfo(myRecord.total_points).rankColor}` } : { boxShadow: "0 0 0 2px rgba(255,255,255,0.2)" }}
            />
          ) : (
            <span
              className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center text-4xl"
              style={myRecord ? { boxShadow: `0 0 0 2px ${getLevelInfo(myRecord.total_points).rankColor}, 0 0 10px -2px ${getLevelInfo(myRecord.total_points).rankColor}` } : { boxShadow: "0 0 0 2px rgba(255,255,255,0.2)" }}
            >
              {label.charAt(0).toUpperCase()}
            </span>
          )}
          {myRecord && (
            <button
              type="button"
              onClick={() => setProgressModalOpen(true)}
              aria-label="View all levels"
              className="absolute left-1/2 -bottom-2 w-max -translate-x-1/2 active:scale-95 transition-transform"
            >
              <LevelBadge totalPoints={myRecord.total_points} size="sm" />
            </button>
          )}
        </div>

        <h1 className="text-3xl text-center mt-4" style={{ fontFamily: "var(--font-display)" }}>
          {label}
        </h1>

        {authProfile?.username ? (
          <p className="text-white/45 text-sm mt-1">@{authProfile.username}</p>
        ) : (
          <button type="button" onClick={() => setEditOpen(true)} className="text-sm mt-1 text-amber-300/80 hover:text-amber-300 transition-colors">
            Set a username &rarr;
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs mt-4 border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          EDIT PROFILE
        </button>
      </RankPanel>

      {/* Season record used to headline here as its own pill, but it's
          just the SEASON tile in the stats grid below now - showing it
          twice was redundant. */}
      {myRecord && (
        <div className="flex flex-col items-center mt-8">
          <PlayerBadges userId={userId} />
        </div>
      )}

      {/* This card + the achievements link below are deliberately stacked
          and cross-referenced (same badge as the header, explicit "earn
          points" copy) so the chain - achievements earn points, points
          set your level, your level is the badge by your name - reads as
          one connected system instead of three unrelated widgets. */}
      {/* Achievements used to have its own card here too, but
          LevelsAchievementsModal already has an in-modal tab switcher
          between Levels and Achievements - a second entry point into the
          same modal was pure duplication. */}
      {myRecord && (
        <div className="mt-6">
          <LevelSummaryCard totalPoints={myRecord.total_points} onOpenLevels={() => setProgressModalOpen(true)} />
        </div>
      )}

      {/* Every stat here is a real navigation target for your own
          profile (tap Referrals to see who joined, Friends to browse and
          search them, Season/Teams Predicted/etc. to jump to the page
          behind that number) - the public profile popup shows the same
          stats but leaves them inert, since there's nowhere useful to
          send a viewer looking at someone else's data. This also
          replaces the old standalone "MY REFERRALS" card - the
          Referrals tile below is the one entry point into that list now. */}
      {myRecord && (
        <RankPanel
          rankColor={rankColor}
          className="mt-6 rounded-2xl border border-white/10 bg-[#0b1730]"
          innerClassName="flex flex-col gap-3 p-4"
        >
          <div className="text-[10px] text-white/45 tracking-[0.15em] mb-1">PICK&rsquo;EM</div>
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon="🔗" value={stats ? String(stats.referralCount) : "–"} label="REFERRALS" accentColor="#c084fc" onClick={() => setReferralsOpen(true)} />
            <StatTile icon="🔥" value="–" label="STREAK SOON" accentColor="rgba(255,255,255,0.35)" />
            <StatTile icon="🏆" value={`${myRecord.correct}-${myRecord.graded - myRecord.correct}`} label="SEASON" accentColor="#4ade80" href="/weekly" />
          </div>

          <div className="mt-2">
            <div className="text-[10px] text-white/45 tracking-[0.15em] mb-2">MORE STATS</div>
            <div className="flex flex-col gap-1.5">
              <StatDetailRow icon="👀" label="Followers" value={stats ? String(stats.followerCount) : "–"} onClick={() => setFollowersOpen(true)} />
              <StatDetailRow icon="👥" label="Friends" value={stats ? String(stats.friendCount) : "–"} onClick={() => setFriendsOpen(true)} />
              <TeamsPredictedRow completedCount={stats?.completedTeamCount} href="/predictor" />
              <StatDetailRow icon="🔒" label="Lock bonuses hit" value={stats ? String(stats.lockBonusCount) : "–"} href="/weekly" />
              <StatDetailRow icon="📅" label="Weeks completed" value={stats ? String(stats.completedWeekCount) : "–"} href="/weekly" />
            </div>
          </div>
        </RankPanel>
      )}

      {isCreator === false && (
        <button
          type="button"
          onClick={() => setCreatorRequestOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 hover:border-white/20 transition-colors mt-6"
        >
          <span className="text-2xl shrink-0">🎥</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
              BECOME A CREATOR
            </div>
            <div className="text-[11px] text-white/45 mt-0.5">Stream or make content? Request the Creator badge &rarr;</div>
          </div>
        </button>
      )}

      {isCreator === true && (
        <button
          type="button"
          onClick={() => setSocialLinksOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 hover:border-white/20 transition-colors mt-6"
        >
          <span className="text-2xl shrink-0">🔗</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
              SOCIAL LINKS
            </div>
            <div className="text-[11px] text-white/45 mt-0.5">Add your channels/socials to your public profile &rarr;</div>
          </div>
        </button>
      )}

      {myRecord?.username && (
        <div className="text-center mt-6">
          <Link href={`/leaderboard/${myRecord.username}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            View your public profile &rarr;
          </Link>
        </div>
      )}

      <div className="flex justify-center mt-10">
        <button
          onClick={() => onSignOut()}
          className="text-xs text-white/40 hover:text-white/70 rounded-full px-5 py-2 border border-white/15 hover:border-white/30 transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          SIGN OUT
        </button>
      </div>

      {editOpen && (
        <EditProfileModal
          userId={userId}
          authProfile={authProfile}
          onClose={() => setEditOpen(false)}
          onProfileChange={onProfileChange}
        />
      )}
      <LevelsAchievementsModal
        open={progressModalOpen}
        initialTab="levels"
        totalPoints={myRecord?.total_points}
        onClose={() => setProgressModalOpen(false)}
      />
      <MyReferralsModal open={referralsOpen} onClose={() => setReferralsOpen(false)} />
      <FriendsListModal
        userId={userId}
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        emptyHint="No friends yet - add some from the leaderboard."
      />
      <FollowersListModal userId={userId} open={followersOpen} onClose={() => setFollowersOpen(false)} />
      <CreatorRequestModal userId={userId} open={creatorRequestOpen} onClose={() => setCreatorRequestOpen(false)} />
      <SocialLinksModal userId={userId} open={socialLinksOpen} onClose={() => setSocialLinksOpen(false)} />
    </main>
  );
}

// Own-account-only, not shown on the public profile - this is the one
// place that spells out the whole system: the badge, what rank it means,
// and exactly how many points stand between here and the next one. Whole
// card opens the same level-ladder modal as the header badge, so clicking
// either one lands you in the same place.
function LevelSummaryCard({ totalPoints, onOpenLevels }: { totalPoints: number; onOpenLevels: () => void }) {
  const info = getLevelInfo(totalPoints);
  const nextLabel = info.isMaxLevel ? "Max level reached" : `${info.pointsForNextLevel! - info.pointsIntoLevel} pts to Level ${info.level + 1}`;

  return (
    <button
      type="button"
      onClick={onOpenLevels}
      className="w-full text-left rounded-2xl border p-4 transition-colors hover:border-white/25"
      style={{ borderColor: `${info.rankColor}55`, background: `linear-gradient(135deg, ${info.rankColor}22, ${info.rankColor}0a)` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-11 w-11 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ background: `${info.rankColor}26`, boxShadow: `0 0 16px -4px ${info.rankColor}` }}
        >
          {info.rankEmoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-white/45 tracking-wide">{info.isUnranked ? "NOT RANKED YET" : "YOUR LEVEL"}</div>
          <div className="text-base truncate" style={{ color: info.rankColor, fontFamily: "var(--font-display)" }}>
            {info.isUnranked ? "Unranked" : `${info.rankName} ${subLevelRoman(info.subLevel)} · Level ${info.level}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base tabular-nums" style={{ color: info.rankColor, fontFamily: "var(--font-display)" }}>
            {totalPoints.toLocaleString()}
          </div>
          <div className="text-[9px] text-white/40 tracking-wide">PTS</div>
        </div>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>

      <div className="mt-3.5">
        <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(info.progress, 1) * 100}%`, background: "linear-gradient(90deg, #4ade80, #22c55e)" }}
          />
        </div>
        <p className="text-[11px] text-white/45 mt-1.5">{info.isUnranked ? `${totalPoints} / 150 pts to Level 1` : nextLabel}</p>
      </div>
    </button>
  );
}

function SignedOutAccount() {
  const { profile, setProfile, loaded } = useProfile();
  const { requestSignIn, signInModal } = useSignInModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function handleCropConfirm(dataUrl: string) {
    setCropFile(null);
    setProfile((p) => ({ ...p, avatarDataUrl: dataUrl }));
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        PROFILE
      </h1>
      <p className="text-center text-white/50 text-sm mt-2 mb-10">Sign in to choose a username and save your picks across devices.</p>

      {loaded && (
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center"
              aria-label="Change profile picture"
            >
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-white/30">+</span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/50 hover:text-white">
              {profile.avatarDataUrl ? "Change photo" : "Add photo"}
            </button>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
            <p className="text-sm text-white/60">Signing in lets you pick a username and syncs this profile to your account.</p>
            <button
              onClick={() => requestSignIn()}
              className="mt-3 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #34d399, #059669)", color: "#ffffff" }}
            >
              SIGN IN
            </button>
          </div>
        </div>
      )}
      {signInModal}
      {cropFile && <AvatarCropModal file={cropFile} outputSize={200} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}
    </main>
  );
}
