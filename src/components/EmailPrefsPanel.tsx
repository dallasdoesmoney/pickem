"use client";

import { useEffect, useState } from "react";
import { fetchEmailPrefs, setWeeklyDeadlineEmail } from "@/lib/supabase/emailPrefs";

// The one place anybody can turn a reminder on.
//
// Off is the honest starting state and the switch says so plainly rather
// than pre-ticking itself, which is the whole reason this component
// exists: without somewhere to opt in, the sender has nobody to send to
// and the feature is inert. That is the correct inert, though - a
// reminder nobody asked for is spam however good the copy is.
//
// Writes immediately on flip, and puts the switch back if the write
// fails. A settings toggle that looks saved and is not is worse than one
// that visibly refuses.
export function EmailPrefsPanel() {
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
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
        EMAIL
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-white/85">Pick reminders</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            One email before the week locks, only if you still have games unpicked. Nothing else.
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
  );
}
