"use client";

import { useEffect, useState } from "react";
import { fetchEmailPrefs, setEmailPref, EmailPrefs, EmailPrefKey, DEFAULT_EMAIL_PREFS } from "@/lib/supabase/emailPrefs";

// Where somebody turns an email off.
//
// TWO SWITCHES, NOT ONE. A deadline nudge and "we built a new game" are
// different things, and one switch covering both would make whichever
// label it carried a lie - which is the precise move that turns an
// unsubscribe into a spam complaint. Someone can now keep the reminder
// and drop the announcements, or the other way round.
//
// Both are on by default (0053, 0056).
//
// COLLAPSED BY DEFAULT, and that is a deliberate choice rather than a
// layout one. Switches sitting open on the account page are questions
// put to everybody who ever looks at their profile, most of whom came to
// change their avatar and were not thinking about email at all. Asking a
// question nobody arrived with is how you get an answer nobody meant to
// give.
//
// What it is NOT is hidden. The row is always visible and says what it
// is, one tap opens it, and the unsubscribe link in every email still
// works without signing in - that link is the real opt-out path and it
// is one click from the inbox.
//
// Each switch writes immediately and puts itself back if the write
// fails. A settings toggle that looks saved and is not is worse than one
// that visibly refuses.
const ROWS: { key: EmailPrefKey; label: string; blurb: string }[] = [
  {
    key: "weeklyDeadline",
    label: "Pick reminders",
    blurb:
      "A heads-up the day before the week locks, and a last call in the final hour — both only if you still have games unpicked.",
  },
  {
    key: "productNews",
    label: "Game updates",
    blurb: "The occasional note when a new game or feature goes live. Rare, and never more than one at a time.",
  },
];

export function EmailPrefsPanel() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<EmailPrefs>(DEFAULT_EMAIL_PREFS);
  const [loaded, setLoaded] = useState(false);
  // Per row, so flipping one switch does not grey out the other or throw
  // its error under the wrong label.
  const [saving, setSaving] = useState<EmailPrefKey | null>(null);
  const [failed, setFailed] = useState<EmailPrefKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmailPrefs()
      .then((p) => {
        if (cancelled) return;
        setPrefs(p);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function flip(key: EmailPrefKey) {
    if (saving) return;
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    setFailed(null);
    try {
      await setEmailPref(key, next);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
      setFailed(key);
    } finally {
      setSaving(null);
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
            other section rows on this page. What is inside belongs
            inside - naming the settings out here would put them in front
            of everybody who opens their account page, which is the
            advertisement for switching them off that collapsing this was
            meant to avoid. */}
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
        <div className="border-t border-white/10">
          {ROWS.map((row, i) => (
            <div key={row.key} className={`px-4 py-3.5 ${i > 0 ? "border-t border-white/[0.07]" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white/85">{row.label}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-white/45">{row.blurb}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[row.key]}
                  aria-label={`${row.label} by email`}
                  onClick={() => flip(row.key)}
                  disabled={saving !== null}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    prefs[row.key] ? "bg-[#3ecb78]" : "bg-white/15"
                  } ${saving === row.key ? "opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left] duration-150 ${
                      prefs[row.key] ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              {failed === row.key && (
                <div className="mt-2 text-[11px] text-[#fca5a5]">Couldn&rsquo;t save that. Try again.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
