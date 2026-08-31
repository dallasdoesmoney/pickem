"use client";

import { useEffect, useState } from "react";
import {
  CreatorApplication,
  CreatorRequest,
  CreatorSocial,
  fetchMyCreatorRequest,
  submitCreatorRequest,
} from "@/lib/supabase/creatorRequests";
import { fetchReferralCount } from "@/lib/supabase/referrals";
import { SOCIAL_PLATFORM_CATALOG } from "@/lib/socialPlatforms";
import { buildReferralLink } from "@/lib/referralStorage";
import { rankWashStyle } from "@/components/RankPanel";
import { errorMessage } from "@/lib/errorMessage";

// The creator application. Red rather than the app's usual navy, with
// the same wash the profile cards carry - this is the one thing on the
// account page that isn't about you yet, and it should look like it.
const RED = "#ef4444";

// Referrals are a guideline, not a gate. Somebody with a real audience
// and three referrals is exactly who this programme wants, and a hard
// stop would turn them away before you ever saw the application. So the
// shortfall screen says what the bar usually is, hands over the link,
// and lets them carry on.
const REFERRAL_GUIDELINE = 50;

const AUDIENCE_SIZES = ["<1k", "1k–10k", "10k–100k", "100k+"];
const CONTENT_TYPES = ["Live streams", "Videos", "Photos", "Podcast", "Writing", "Other"];
const CADENCES = ["Daily", "Weekly", "Monthly", "Now and then"];
const NFL_FOCUS = ["All of it", "Mostly", "Sometimes", "No"];
const PLATFORMS = Object.keys(SOCIAL_PLATFORM_CATALOG);

const PERKS: [string, string, string][] = [
  ["🎬", "Creator badge", "Shown next to your name everywhere on the site."],
  ["🔗", "Your channels on your profile", "Every visitor gets one tap through to your streams."],
  ["⭐", "Recommended to every new signup", "The top creators by level are offered to every account that joins."],
  ["🏆", "Creator-only leaderboard", "Ranked against other creators, not the whole site."],
  ["🚀", "Early access to new features", "You see what ships before anyone else."],
];

const EMPTY: CreatorApplication = {
  socials: [{ platform: "youtube", url: "" }],
  audienceSize: "",
  primaryPlatform: "",
  contentTypes: [],
  cadence: "",
  nflFocus: "",
  contactHandle: "",
  contentUrl: "",
  note: "",
};

type Step = "why" | "referrals" | "channels" | "about" | "done";

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-[7px] text-[11px] transition-colors ${
        on ? "border-[#ef4444]/60 bg-[#ef4444]/20 text-white" : "border-white/16 text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[9.5px] tracking-[0.14em] text-white/35">{label}</span>
      {children}
    </div>
  );
}

const INPUT =
  "w-full rounded-[10px] border border-white/14 bg-[#0a1428] px-3 py-2.5 text-[16px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none";

export function CreatorRequestModal({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const [existing, setExisting] = useState<CreatorRequest | null | undefined>(undefined);
  const [referrals, setReferrals] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("why");
  const [app, setApp] = useState<CreatorApplication>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setExisting(undefined);
    setStep("why");
    setApp(EMPTY);
    setSubmitError(null);
    setLoadError(null);
    setCopied(false);
    fetchMyCreatorRequest(userId)
      .then(setExisting)
      .catch((err) => {
        console.error("Failed to load creator request status", errorMessage(err));
        setLoadError("Couldn't load your request status.");
      });
    fetchReferralCount(userId)
      .then(setReferrals)
      .catch(() => setReferrals(null));
    // The referral link is built from the username, which the profile
    // already has - read straight off the row rather than threading it
    // through props from three different callers.
    import("@/lib/supabase/client").then(({ supabase }) =>
      supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => setUsername((data as { username: string | null } | null)?.username ?? null)),
    );
  }, [open, userId]);

  if (!open) return null;

  function patch(next: Partial<CreatorApplication>) {
    setApp((prev) => ({ ...prev, ...next }));
  }

  function toggleType(type: string) {
    patch({ contentTypes: app.contentTypes.includes(type) ? app.contentTypes.filter((t) => t !== type) : [...app.contentTypes, type] });
  }

  function setSocial(index: number, next: Partial<CreatorSocial>) {
    patch({ socials: app.socials.map((s, i) => (i === index ? { ...s, ...next } : s)) });
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await submitCreatorRequest(userId, app);
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    setStep("done");
    fetchMyCreatorRequest(userId).then(setExisting).catch(() => {});
  }

  // Where APPLY goes: straight past the referral screen once they're at
  // or above the guideline.
  const afterWhy: Step = referrals !== null && referrals < REFERRAL_GUIDELINE ? "referrals" : "channels";
  const stepNumber = step === "why" ? 1 : step === "referrals" ? 2 : step === "channels" ? 3 : 4;
  const totalSteps = afterWhy === "referrals" ? 4 : 3;
  const displayStep = afterWhy === "referrals" ? stepNumber : stepNumber - (stepNumber > 2 ? 1 : 0);

  const link = buildReferralLink(username);
  const pending = existing?.status === "pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="creator-app-title">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-[#ef4444]/35 bg-[#1b0d12] shadow-2xl shadow-black/60">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={rankWashStyle(RED)} />
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/60 backdrop-blur-sm hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        <div className="relative overflow-y-auto px-5 pb-5 pt-6">
          {loadError && <p className="text-center text-sm text-red-300">{loadError}</p>}

          {existing === undefined && !loadError && (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}

          {/* A request already in review: nothing to fill in. */}
          {pending && step !== "done" && (
            <>
              <div className="mx-auto mb-3 grid h-13 w-13 place-items-center rounded-full border border-[#ef4444]/50 bg-[#ef4444]/20 text-2xl">⏳</div>
              <h2 id="creator-app-title" className="text-center text-[16px] text-white" style={{ fontFamily: "var(--font-display)" }}>
                APPLICATION IN REVIEW
              </h2>
              <p className="mt-2 text-center text-[12.5px] leading-snug text-white/50">
                We&rsquo;ve got your application. You&rsquo;ll get a notification either way.
              </p>
              <button type="button" onClick={onClose} className="mt-4 w-full py-2 text-center text-xs text-white/40 hover:text-white/70">
                Close
              </button>
            </>
          )}

          {existing !== undefined && !pending && step === "why" && (
            <>
              <h2 id="creator-app-title" className="text-center text-[16px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
                BECOME A CREATOR
              </h2>
              <p className="mt-1.5 mb-4 text-center text-[12.5px] leading-snug text-white/50">What you get for wearing the badge.</p>
              {PERKS.map(([icon, title, detail]) => (
                <div key={title} className="mb-2 flex items-start gap-2.5 rounded-[11px] border border-white/9 bg-white/5 p-2.5">
                  <span className="shrink-0 text-base leading-tight">{icon}</span>
                  <span>
                    <span className="block text-[12.5px] font-medium leading-tight text-white">{title}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/45">{detail}</span>
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setStep(afterWhy)}
                className="mt-3 w-full rounded-full px-5 py-3 text-[11px] tracking-[0.08em] text-white transition-transform duration-150 active:scale-95"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
              >
                {existing?.status === "rejected" ? "APPLY AGAIN" : "APPLY TO BE A CREATOR"}
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-center text-xs text-white/40 hover:text-white/70">
                Maybe later
              </button>
            </>
          )}

          {step === "referrals" && (
            <>
              <span className="mb-1.5 block text-center text-[10px] tracking-[0.2em] text-red-300/85">STEP {displayStep} OF {totalSteps}</span>
              <h2 className="text-center text-[16px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
                ABOUT REFERRALS
              </h2>
              <div className="mt-4 flex items-baseline justify-between" style={{ fontFamily: "var(--font-display)" }}>
                <span className="text-[13px] text-white">
                  {referrals ?? 0} <span className="text-[11px] font-normal text-white/45" style={{ fontFamily: "var(--font-sans)" }}>of {REFERRAL_GUIDELINE} referrals</span>
                </span>
                <span className="text-[13px] text-red-300">{Math.max(0, REFERRAL_GUIDELINE - (referrals ?? 0))} TO GO</span>
              </div>
              <div className="mt-1 mb-2 h-[9px] overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(100, ((referrals ?? 0) / REFERRAL_GUIDELINE) * 100)}%`, background: "linear-gradient(90deg,#ef4444,#f87171)" }}
                />
              </div>
              <p className="text-[12.5px] leading-snug text-white/55">
                We don&rsquo;t usually approve creator accounts until someone has brought {REFERRAL_GUIDELINE} people to the
                site. You&rsquo;re welcome to finish the application now &mdash; we&rsquo;ll keep it on file and review it
                as your referrals come in.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-dashed border-white/22 bg-black/25 px-3 py-2.5">
                <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-red-300">{link}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(link);
                    setCopied(true);
                  }}
                  className="shrink-0 rounded-md bg-white/14 px-2 py-1 text-[9px] tracking-[0.1em] text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
              <p className="mt-1.5 text-[10.5px] text-white/35">Also on your profile under Referrals, any time.</p>
              <ul className="mt-2.5 list-disc pl-4">
                <li className="mb-1 text-[11.5px] leading-snug text-white/50">Put it in your stream bio and panels</li>
                <li className="mb-1 text-[11.5px] leading-snug text-white/50">Drop it in chat when picks go up each week</li>
                <li className="text-[11.5px] leading-snug text-white/50">Pin it under your weekly picks video</li>
              </ul>
              <button
                type="button"
                onClick={() => setStep("channels")}
                className="mt-4 w-full rounded-full px-5 py-3 text-[11px] tracking-[0.08em] text-white transition-transform duration-150 active:scale-95"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
              >
                CONTINUE ANYWAY
              </button>
            </>
          )}

          {step === "channels" && (
            <>
              <span className="mb-1.5 block text-center text-[10px] tracking-[0.2em] text-red-300/85">STEP {displayStep} OF {totalSteps}</span>
              <h2 className="text-center text-[16px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
                YOUR CHANNELS
              </h2>
              <p className="mt-1.5 mb-4 text-center text-[12.5px] leading-snug text-white/50">
                These go on your profile once you&rsquo;re approved &mdash; you won&rsquo;t have to enter them again.
              </p>

              <Field label="YOUR CHANNELS">
                {app.socials.map((social, i) => (
                  <div key={i} className="mb-1.5 flex gap-1.5">
                    <select
                      value={social.platform}
                      onChange={(e) => setSocial(i, { platform: e.target.value })}
                      className="shrink-0 rounded-[10px] border border-white/14 bg-[#0a1428] px-2 py-2.5 text-[16px] text-white focus:border-white/40 focus:outline-none"
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {SOCIAL_PLATFORM_CATALOG[platform].label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={social.url}
                      onChange={(e) => setSocial(i, { url: e.target.value })}
                      placeholder="https://…"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={INPUT}
                    />
                  </div>
                ))}
                {app.socials.length < PLATFORMS.length && (
                  <button
                    type="button"
                    onClick={() => patch({ socials: [...app.socials, { platform: PLATFORMS.find((p) => !app.socials.some((s) => s.platform === p)) ?? "website", url: "" }] })}
                    className="mt-1 text-[11.5px] text-white/45 hover:text-white"
                  >
                    + Add another channel
                  </button>
                )}
              </Field>

              <Field label="ROUGHLY HOW BIG IS YOUR AUDIENCE?">
                <div className="flex flex-wrap gap-1.5">
                  {AUDIENCE_SIZES.map((size) => (
                    <Chip key={size} label={size} on={app.audienceSize === size} onClick={() => patch({ audienceSize: size })} />
                  ))}
                </div>
              </Field>

              <Field label="WHERE DO YOU MOSTLY POST?">
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((platform) => (
                    <Chip
                      key={platform}
                      label={SOCIAL_PLATFORM_CATALOG[platform].label}
                      on={app.primaryPlatform === platform}
                      onClick={() => patch({ primaryPlatform: platform })}
                    />
                  ))}
                </div>
              </Field>

              <button
                type="button"
                onClick={() => setStep("about")}
                className="mt-3 w-full rounded-full px-5 py-3 text-[11px] tracking-[0.08em] text-white transition-transform duration-150 active:scale-95"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
              >
                CONTINUE
              </button>
              <button type="button" onClick={() => setStep(afterWhy === "referrals" ? "referrals" : "why")} className="mt-2 w-full py-2 text-center text-xs text-white/40 hover:text-white/70">
                Back
              </button>
            </>
          )}

          {step === "about" && (
            <>
              <span className="mb-1.5 block text-center text-[10px] tracking-[0.2em] text-red-300/85">STEP {displayStep} OF {totalSteps}</span>
              <h2 className="text-center text-[16px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
                WHAT YOU MAKE
              </h2>
              <div className="mt-4" />

              <Field label="WHAT DO YOU MAKE?">
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_TYPES.map((type) => (
                    <Chip key={type} label={type} on={app.contentTypes.includes(type)} onClick={() => toggleType(type)} />
                  ))}
                </div>
              </Field>

              <Field label="HOW OFTEN?">
                <div className="flex flex-wrap gap-1.5">
                  {CADENCES.map((c) => (
                    <Chip key={c} label={c} on={app.cadence === c} onClick={() => patch({ cadence: c })} />
                  ))}
                </div>
              </Field>

              <Field label="IS IT NFL?">
                <div className="flex flex-wrap gap-1.5">
                  {NFL_FOCUS.map((f) => (
                    <Chip key={f} label={f} on={app.nflFocus === f} onClick={() => patch({ nflFocus: f })} />
                  ))}
                </div>
              </Field>

              <Field label="BEST EXAMPLE OF YOUR WORK">
                <input
                  value={app.contentUrl}
                  onChange={(e) => patch({ contentUrl: e.target.value })}
                  placeholder="Link one specific video, clip or post…"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={INPUT}
                />
              </Field>

              <Field label="WHERE CAN WE REACH YOU?">
                <input
                  value={app.contactHandle}
                  onChange={(e) => patch({ contactHandle: e.target.value })}
                  placeholder="Discord or email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={INPUT}
                />
              </Field>

              <Field label="ANYTHING ELSE?">
                <textarea
                  value={app.note}
                  onChange={(e) => patch({ note: e.target.value })}
                  placeholder="Tell us about what you make…"
                  rows={3}
                  className={`${INPUT} resize-none`}
                />
              </Field>

              {submitError && <p className="mb-2 text-center text-xs text-red-300">{submitError}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-1 w-full rounded-full px-5 py-3 text-[11px] tracking-[0.08em] text-white transition-transform duration-150 active:scale-95 disabled:opacity-50"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
              >
                {submitting ? "SENDING…" : "SUBMIT APPLICATION"}
              </button>
              <button type="button" onClick={() => setStep("channels")} className="mt-2 w-full py-2 text-center text-xs text-white/40 hover:text-white/70">
                Back
              </button>
            </>
          )}

          {step === "done" && (
            <>
              <div className="mx-auto mb-3 grid h-13 w-13 place-items-center rounded-full border border-[#ef4444]/50 bg-[#ef4444]/20 text-2xl">📨</div>
              <h2 className="text-center text-[16px] text-white" style={{ fontFamily: "var(--font-display)" }}>
                APPLICATION SENT
              </h2>
              <p className="mt-2 mb-3 text-center text-[12.5px] leading-snug text-white/50">
                We&rsquo;ll review it and let you know. You&rsquo;ll get a notification either way.
              </p>
              <div className="flex items-start gap-2.5 rounded-[11px] border border-white/9 bg-white/5 p-2.5">
                <span className="shrink-0 text-base leading-tight">🔒</span>
                <span>
                  <span className="block text-[12.5px] font-medium leading-tight text-white">Your channels are saved</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
                    If you&rsquo;re approved they go straight onto your profile &mdash; nothing to re-enter.
                  </span>
                </span>
              </div>
              <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-center text-xs text-white/40 hover:text-white/70">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
