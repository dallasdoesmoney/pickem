"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchTopCreators, TopCreator } from "@/lib/supabase/creators";
import { followUser } from "@/lib/supabase/follows";
import { markFollowRecsPrompted } from "@/lib/supabase/profile";
import { LevelBadge } from "@/components/LevelBadge";
import { SOCIAL_ICON_COMPONENTS } from "@/components/SocialIcon";
import { errorMessage } from "@/lib/errorMessage";

// Third and last of the first-run gates (see layout.tsx), after
// UsernameGate and AvatarPromptGate. Its condition requires both of
// those to be satisfied, so it can never jump the queue.
//
// Everyone who already had an account when this shipped picks it up on
// their next visit, because profiles.follow_recs_prompted defaults to
// false. That audience is mid-session with no signup flow around them, so
// "STEP 3 OF 3" would be a lie to them - they get a NEW badge instead.
// Anything created after the flag existed is genuinely walking the
// onboarding steps and keeps the counter.
const LAUNCHED_AT = Date.parse("2026-08-20T00:00:00Z");

function isBackfill(createdAt: string | null): boolean {
  if (!createdAt) return true;
  const created = Date.parse(createdAt);
  return Number.isNaN(created) ? true : created < LAUNCHED_AT;
}

function initialOf(creator: TopCreator): string {
  return (creator.display_name || creator.username || "?").trim().charAt(0).toUpperCase();
}

export function FollowRecsGate() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [creators, setCreators] = useState<TopCreator[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = !loading && !!user && !!profile && !!profile.username && profile.onboarding_avatar_prompted && !profile.follow_recs_prompted;

  useEffect(() => {
    if (!eligible || !user) {
      setCreators(null);
      return;
    }
    let cancelled = false;
    fetchTopCreators(user.id)
      .then((rows) => {
        if (cancelled) return;
        setCreators(rows);
        // Pre-selected, which is the whole point of the design: the easy
        // path follows everyone, and opting out is one visible tap.
        setSelected(new Set(rows.map((r) => r.user_id)));
        // Nothing to recommend - burn the flag rather than showing an
        // empty box, so this doesn't re-query on every page load forever.
        if (rows.length === 0) {
          markFollowRecsPrompted(user.id)
            .then(refreshProfile)
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setCreators([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, user, refreshProfile]);

  if (!eligible || !creators || creators.length === 0) return null;

  async function finish() {
    await markFollowRecsPrompted(user!.id);
    await refreshProfile();
  }

  async function handleFollow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Sequential, not Promise.all: these are three writes to the same
      // table and a partial failure should stop rather than race.
      for (const id of selected) {
        const { error: followError } = await followUser(user!.id, id);
        if (followError) throw new Error(followError);
      }
      await finish();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await finish();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const backfill = isBackfill(profile!.created_at);
  const count = selected.size;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="follow-recs-title">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1730] p-5 shadow-2xl shadow-black/50">
        {backfill ? (
          <span
            className="mx-auto mb-2.5 block w-fit rounded-full px-2.5 py-[3px] text-[9px] tracking-[0.14em]"
            style={{ fontFamily: "var(--font-display)", background: "#4ade80", color: "#06210f" }}
          >
            NEW
          </span>
        ) : (
          <span className="mb-2 block text-center text-[10px] tracking-[0.2em] text-amber-300/80">STEP 3 OF 3</span>
        )}

        <h2 id="follow-recs-title" className="text-center text-[17px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
          FOLLOW THE TOP CREATORS
        </h2>
        <p className="mx-auto mt-1.5 mb-4 text-center text-[13px] leading-snug text-white/50">
          {creators.length === 1
            ? "The highest-level creator on Sideline Brew."
            : `The ${creators.length === 2 ? "two" : "three"} highest-level creators on Sideline Brew. Untick anyone you'd rather not follow.`}
        </p>

        <div className={`grid gap-2 ${creators.length === 1 ? "grid-cols-1" : creators.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {creators.map((creator) => {
            const on = selected.has(creator.user_id);
            return (
              <button
                key={creator.user_id}
                type="button"
                onClick={() => toggle(creator.user_id)}
                aria-pressed={on}
                disabled={busy}
                className={`relative rounded-[13px] border px-1.5 pt-4 pb-3 text-center transition-colors disabled:opacity-60 ${
                  on ? "border-[#4ade80]/50 bg-[#4ade80]/10" : "border-white/10 bg-white/5"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute right-1.5 top-1.5 grid h-[19px] w-[19px] place-items-center rounded-full text-[11px] ${
                    on ? "bg-[#4ade80] text-[#06121f]" : "border-[1.5px] border-white/25 text-transparent"
                  }`}
                >
                  ✓
                </span>
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt="" className="mx-auto mb-2 h-11 w-11 rounded-full object-cover sm:h-13 sm:w-13" />
                ) : (
                  <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-lg font-semibold text-white">
                    {initialOf(creator)}
                  </span>
                )}
                <span className="block truncate text-[12px] font-medium leading-tight text-white">
                  {creator.display_name || creator.username}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-white/40">@{creator.username}</span>
                <span className="mt-1.5 block">
                  <LevelBadge totalPoints={creator.total_points} size="xs" />
                </span>
                {creator.platforms.length > 0 && (
                  <span className="mt-1.5 flex items-center justify-center gap-1">
                    {creator.platforms.slice(0, 3).map((platform) => {
                      const Icon = SOCIAL_ICON_COMPONENTS[platform];
                      return Icon ? <Icon key={platform} className="h-3 w-3 text-white/60" /> : null;
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleFollow}
          disabled={busy || count === 0}
          className="mt-4 w-full rounded-full px-5 py-3 text-[11px] tracking-[0.08em] transition-transform duration-150 active:scale-95 disabled:opacity-40"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          {busy ? "FOLLOWING…" : count === 0 ? "NOBODY SELECTED" : `FOLLOW ALL ${count}`}
        </button>
        {/* A real target, not a grey whisper - pre-selection is only fair
            if opting out is as easy as opting in. */}
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className="mt-2 w-full py-2 text-center text-xs text-white/40 transition-colors hover:text-white/70 disabled:opacity-40"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
