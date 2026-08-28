"use client";

import { useEffect, useState } from "react";
import { fetchEmailPrefs, setWeeklyDeadlineEmail } from "@/lib/supabase/emailPrefs";

// The one place somebody can turn a reminder off.
//
// OFF, not on - reminders are on by default as of migration 0053, which
// is the opposite of what this file used to say. A stale comment on a
// consent control is worse than none, because it is the thing anybody
// reads before changing the behaviour.
//
// COLLAPSED BY DEFAULT, and that is a deliberate choice rather than a
// layout one. A toggle sitting open on the account page is a switch
// being offered to everybody who ever looks at their profile, most of
// whom came to change their avatar and were not thinking about email at
// all. Asking a question nobody arrived with is how you get an answer
// nobody meant to give.
//
// What it is NOT is hidden. The row is always visible, it says exactly
// what is inside, one tap opens it, and the unsubscribe link in every
// email still works without signing in at all - that link is the real
// opt-out path and it is one click from the inbox. This only declines to
// wave the switch at people who did not ask for it.
//
// Writes immediately on flip, and puts the switch back if the write
// fails. A settings toggle that looks saved and is not is worse than one
// that visibly refuses.
export function EmailPrefsPanel() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEmailPrefs()
      .then((p) => {
        if (cancelled) return;
        setOn(p.weeklyDeadline);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function flip() {
    if (saving) return;
    const next = !on;
    setOn(next);
    setSaving(true);
    setFailed(false);
    try {
      await setWeeklyDeadlineEmail(next);
    } catch {
      setOn(!next);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* The label and nothing else, matching SOCIAL LINKS and the
            other section rows on this page. It named the setting and its
            default underneath - which put "reminders are on" in front of
            everybody who ever opened their account page, which is the
            advertisement for turning them off that collapsing this was
            meant to avoid. What is inside belongs inside. */}
        <div className="min-w-0 flex-1 text-sm" style={{ fontFamily: "var(--font-display)" }}>
          EMAIL PREFERENCES
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-3.5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white/85">Pick reminders</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                A heads-up the day before the week locks, and a last call in the final hour &mdash; both only if you
                still have games unpicked. Nothing else.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="Pick reminders by email"
              onClick={flip}
              disabled={saving}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                on ? "bg-[#3ecb78]" : "bg-white/15"
              } ${saving ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left] duration-150 ${
                  on ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {failed && <div className="mt-2 text-[11px] text-[#fca5a5]">Couldn&rsquo;t save that. Try again.</div>}
        </div>
      )}
    </div>
  );
}
