"use client";

import { useEffect, useState } from "react";
import { validateUsernameFormat } from "@/lib/usernamePolicy";
import { checkUsernameAvailable } from "@/lib/supabase/profile";

export type UsernameFieldStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unchanged";

// Shared between UsernameGate (claiming one for the first time) and the
// account page (renaming an existing one) - same debounced format +
// availability check either way. `currentUsername` lets the rename case
// treat "typed back your own existing name" as a no-op instead of an
// availability check that would incorrectly come back "taken" (it's
// already your own row).
export function useUsernameField(currentUsername?: string | null) {
  const [username, setUsername] = useState("");

  // THE VERDICTS THAT NEED NOBODY. Empty, unchanged and malformed are all
  // decidable from what is already in hand, so they are decided here
  // rather than in an effect. That is not only one render cheaper - it is
  // one render EARLIER: the old version rendered "idle" for a frame
  // before the effect corrected it to "invalid", so a bad character
  // showed as fine before it showed as wrong.
  //
  // null means "only the server knows", which is the one case worth an
  // effect.
  const local: UsernameFieldStatus | null = !username
    ? "idle"
    : currentUsername && username.toLowerCase() === currentUsername.toLowerCase()
      ? "unchanged"
      : !validateUsernameFormat(username).valid
        ? "invalid"
        : null;

  // Keyed by the name it was asked about, so an answer that arrives after
  // the box has moved on is ignored rather than shown against the wrong
  // word. The debounce ref is gone with it: the effect's own cleanup
  // cancels a pending check whenever the name changes, which is the same
  // guarantee with less to keep in sync.
  const [checked, setChecked] = useState<{
    name: string;
    status: "available" | "taken" | "idle";
  } | null>(null);

  useEffect(() => {
    if (local !== null) return;
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username);
        setChecked({ name: username, status: available ? "available" : "taken" });
      } catch {
        // Same fallback as before: a failed check reads as idle rather
        // than as a verdict the server never gave.
        setChecked({ name: username, status: "idle" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username, local]);

  // Still "checking" until an answer for THIS name has landed.
  const status: UsernameFieldStatus =
    local ?? (checked && checked.name === username ? checked.status : "checking");

  return { username, setUsername, status };
}
