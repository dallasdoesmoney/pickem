"use client";

import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState<UsernameFieldStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username) {
      setStatus("idle");
      return;
    }
    if (currentUsername && username.toLowerCase() === currentUsername.toLowerCase()) {
      setStatus("unchanged");
      return;
    }
    const format = validateUsernameFormat(username);
    if (!format.valid) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username);
        setStatus(available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, currentUsername]);

  return { username, setUsername, status };
}
