"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { markReferralPrompted } from "@/lib/supabase/profile";
import { ReferrerMatch, claimReferral, searchReferrers } from "@/lib/supabase/referrals";
import { errorMessage } from "@/lib/errorMessage";
import { PENDING_REFERRAL_KEY } from "@/lib/referralStorage";

// The last first-run gate, after the username and the photo.
//
// A ?ref= link only attributes a signup if someone actually clicked it,
// which most people don't - they hear about the site and type it in.
// Those accounts have no referrer and never can, so the referral loop
// quietly loses most of its reach. This is the other way in: ask.
//
// Shown only to accounts that have no referrer AND weren't already
// credited by a link, so anyone who arrived the normal way never sees
// it. Fully skippable, and says so - there is no answer to give if
// nobody sent you.
const DEBOUNCE_MS = 180;

export function ReferralPromptGate() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ReferrerMatch[]>([]);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<ReferrerMatch | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // A link that hasn't been cashed in yet. useAuth claims it in the
  // background on the first session resolve, but it awaits a data
  // migration first, so there IS a window where the account has a
  // referrer coming and doesn't have one yet - and asking "who invited
  // you?" inside that window is asking someone who already answered.
  // Read after mount, never during render: there is no localStorage on
  // the server.
  const [linkPending, setLinkPending] = useState(true);
  useEffect(() => {
    const read = () => setLinkPending(!!localStorage.getItem(PENDING_REFERRAL_KEY));
    read();
    // The claim clears the key rather than telling anyone, so this
    // watches for it going away.
    const t = setInterval(read, 400);
    return () => clearInterval(t);
  }, []);

  const show =
    !loading &&
    !!user &&
    !!profile &&
    // Never over the top of the two gates that come first, which also
    // buys the background claim all the time it needs: nobody reaches
    // this until they have named themselves and dealt with a photo.
    !!profile.username &&
    profile.onboarding_avatar_prompted &&
    // The two ways an account can already have a referrer: the column is
    // set, or a link is still in flight to set it.
    !profile.referred_by &&
    !linkPending &&
    !profile.onboarding_referral_prompted;

  // Debounced so a fast typist makes one request at the end of a word
  // rather than one per letter, and stamped so a slow reply for "mi"
  // can't overwrite the results for "mike".
  const runId = useRef(0);
  useEffect(() => {
    if (!show || picked) return;
    const term = query.trim();
    const id = ++runId.current;
    // Everything happens on the timer, including clearing: state set
    // straight from an effect body is a synchronous re-render on every
    // keystroke, which is exactly what the debounce is here to avoid.
    const t = setTimeout(() => {
      if (!term) {
        setMatches([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      searchReferrers(term)
        .then((rows) => {
          if (id !== runId.current) return;
          setMatches(rows);
          setCursor(0);
        })
        .catch(() => {
          if (id === runId.current) setMatches([]);
        })
        .finally(() => {
          if (id === runId.current) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, show, picked]);

  if (!show) return null;

  async function finish() {
    await markReferralPrompted(user!.id);
    await refreshProfile();
  }

  async function handleAdd() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const result = await claimReferral(picked.username);
      if (result === "ok" || result === "already_claimed") {
        setPaid(result === "ok");
        await finish();
      } else if (result === "self") {
        setError("That's you. Pick whoever actually sent you here.");
      } else {
        setError("That account isn't there any more. Try another name.");
      }
    } catch (err) {
      console.error("Referral claim failed", err);
      setError(`Couldn't add them: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    await finish();
    setBusy(false);
  }

  const nameOf = (m: ReferrerMatch) => m.display_name || m.username;
  const initials = (m: ReferrerMatch) =>
    nameOf(m)
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const primaryStyle = {
    fontFamily: "var(--font-display)",
    background: "linear-gradient(135deg, #4ade80, #22c55e)",
    color: "#0e1b33",
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto text-center">
        <span className="block text-[10px] tracking-[0.2em] text-amber-300/80 mb-2">STEP 3 OF 3</span>

        {paid ? (
          <>
            <span className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/15">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#4ade80" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
              NICE — 1,000 POINTS
            </h2>
            <p className="text-white/50 text-sm mt-1">
              {picked ? nameOf(picked) : "They"} got 1,000 too. You&apos;re all set.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
              WHO INVITED YOU?
            </h2>
            <p className="text-white/50 text-sm mt-1 mb-4">
              Add them and you <span className="text-emerald-400 font-semibold">both</span> get 1,000 points.
            </p>

            {picked ? (
              <>
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/45 bg-emerald-400/10 px-3 py-2.5 text-left">
                  <Avatar m={picked} initials={initials(picked)} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-semibold text-white">{nameOf(picked)}</span>
                    <span className="block text-xs text-white/50">@{picked.username}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(null);
                      setQuery("");
                      setError(null);
                    }}
                    aria-label="Choose someone else"
                    className="ml-auto shrink-0 px-1 text-lg leading-none text-white/50 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-3 text-[12.5px] text-white/50">
                  You <span className="font-semibold text-emerald-400">+1,000</span> · {nameOf(picked)}{" "}
                  <span className="font-semibold text-emerald-400">+1,000</span>
                </p>
              </>
            ) : (
              <div className="relative text-left">
                <span className="pointer-events-none absolute left-3.5 top-[23px] -translate-y-1/2 text-[15px] text-white/35">
                  @
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      if (!matches.length) return;
                      setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
                    }
                    if (e.key === "Enter" && matches[cursor]) {
                      e.preventDefault();
                      setPicked(matches[cursor]);
                    }
                  }}
                  placeholder="Search their username"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search for the person who invited you"
                  // 16px so iOS doesn't zoom the page the moment this
                  // takes focus, which on a signup step is the worst
                  // possible time to fight the viewport.
                  className="h-[46px] w-full rounded-xl border border-white/20 bg-[#08111f] pl-[30px] pr-3.5 text-base text-white outline-none placeholder:text-[#4a5c7d] focus:border-white/50"
                />

                {!!query.trim() && (
                  <div
                    role="listbox"
                    aria-label="Matching accounts"
                    className="mt-2 max-h-[232px] overflow-y-auto rounded-xl border border-white/15 bg-[#0a1526]"
                  >
                    {matches.length > 0 ? (
                      matches.map((m, i) => (
                        <button
                          key={m.user_id}
                          type="button"
                          role="option"
                          onClick={() => setPicked(m)}
                          aria-selected={i === cursor}
                          className={`flex w-full items-center gap-2.5 border-t border-white/10 px-3 py-2.5 text-left first:border-t-0 ${
                            i === cursor ? "bg-white/[0.06]" : "hover:bg-white/[0.06]"
                          }`}
                        >
                          <Avatar m={m} initials={initials(m)} />
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-semibold text-white">{nameOf(m)}</span>
                            <span className="block text-xs text-white/50">@{m.username}</span>
                          </span>
                          <span className="ml-auto shrink-0 text-[11px] text-white/35">
                            {m.total_points.toLocaleString()} pts
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3.5 text-[13.5px] text-white/50">
                        {searching ? "Looking…" : "No one by that name. Try the first few letters."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 text-left text-xs text-red-400">{error}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {paid ? (
            <button
              type="button"
              onClick={() => {}}
              className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150"
              style={primaryStyle}
            >
              START PICKING
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAdd}
                // Only ever somebody the list offered, so a typo cannot
                // credit the wrong account - or nobody.
                disabled={!picked || busy}
                className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-40 disabled:active:scale-100"
                style={primaryStyle}
              >
                {busy ? "ADDING…" : "ADD THEM"}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={busy}
                className="w-full rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/70 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
                style={{ fontFamily: "var(--font-display)" }}
              >
                NOBODY INVITED ME
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ m, initials }: { m: ReferrerMatch; initials: string }) {
  if (m.avatar_url) {
    return <img src={m.avatar_url} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white/15 text-[12px] font-bold text-white">
      {initials}
    </span>
  );
}
