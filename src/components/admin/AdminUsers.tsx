"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminUserRow,
  deleteAdminUser,
  fetchAdminUserEmail,
  fetchAdminUsers,
  setUserAdmin,
  setUserReferrer,
  updateAdminUser,
} from "@/lib/supabase/adminUsers";
import { sendPasswordReset } from "@/lib/supabase/profile";
import { errorMessage } from "@/lib/errorMessage";

// The user directory. It began as a referrer editor - referrals are
// normally self-claimed through a link, so anyone referred by word of
// mouth arrived unattributed and there was no way to credit them - and
// now carries the rest of what you need when somebody writes in: rename
// them, send them back into their account, make them an admin, or remove
// them entirely.

function joined(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ row }: { row: AdminUserRow }) {
  const [failed, setFailed] = useState(false);
  const letter = (row.display_name || row.username || row.email || "?").trim().charAt(0).toUpperCase();
  if (!row.avatar_url || failed) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm text-white/60">{letter}</span>
    );
  }
  return <img src={row.avatar_url} alt="" onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
}

function ReferrerEditor({
  row,
  onSaved,
  onError,
}: {
  row: AdminUserRow;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [value, setValue] = useState(row.referrer_username ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save(username: string) {
    if (saving) return;
    setSaving(true);
    setDone(false);
    onError(null);
    try {
      await setUserReferrer(row.id, username);
      setValue(username);
      setDone(true);
      onSaved();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <label className="block text-[10px] tracking-[0.16em] text-white/35" htmlFor={`ref-${row.id}`}>
        REFERRED BY
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={`ref-${row.id}`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(value);
          }}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // 16px: anything smaller makes iOS Safari zoom the page in on focus.
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0a1428] px-3 py-2 text-[16px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => save(value)}
          disabled={saving || value.trim() === (row.referrer_username ?? "")}
          className="rounded-xl px-4 py-2 text-[11px] tracking-[0.1em] disabled:opacity-40"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          {saving ? "SAVING" : "SAVE"}
        </button>
        {row.referrer_username && (
          <button
            type="button"
            onClick={() => save("")}
            disabled={saving}
            className="rounded-xl border border-white/15 px-3 py-2 text-[11px] tracking-[0.1em] text-white/60 hover:text-white disabled:opacity-40"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CLEAR
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/35">
        {done
          ? "Saved. Both sides have been credited 1,000 points."
          : "Awards 1,000 points to each side, same as a link signup. Replacing an existing referrer takes their bonus back."}
      </p>
    </div>
  );
}

export function AdminUsers() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (search: string) =>
      fetchAdminUsers(search)
        .then(setRows)
        .catch((err) => setError(errorMessage(err))),
    [],
  );

  // Debounced so typing a username doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      load(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, username or email"
        aria-label="Search users"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-2xl border border-white/15 bg-[#101d38] px-4 py-3 text-[16px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {rows === null ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/45">No users match &ldquo;{query}&rdquo;.</p>
      ) : (
        <>
          <p className="mt-4 mb-2 text-[11px] tracking-[0.14em] text-white/30">
            {rows.length} USER{rows.length === 1 ? "" : "S"}
            {rows.length === 100 ? " (NEWEST 100 — SEARCH TO NARROW)" : ""}
          </p>
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const open = openId === row.id;
              return (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <Avatar row={row} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm text-white">{row.display_name || row.username || "(no name)"}</span>
                        {row.is_admin && (
                          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-white/60">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-white/40">
                        {row.username ? `@${row.username}` : "no username"}
                        {row.email ? ` · ${row.email}` : ""}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-white/40">
                        Joined {joined(row.created_at)} · {row.total_points.toLocaleString()} pts
                        {row.referral_count > 0 ? ` · referred ${row.referral_count}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] tracking-[0.12em] text-white/30">REFERRER</div>
                      <div className={`text-[11px] ${row.referrer_username ? "text-[#4ade80]" : "text-white/30"}`}>
                        {row.referrer_username ? `@${row.referrer_username}` : "none"}
                      </div>
                    </div>
                  </button>

                  {open && (
                    <>
                      <ReferrerEditor
                        row={row}
                        onError={setError}
                        // Re-reads the list so the referrer's own row picks up
                        // its new count and points, not just the row we edited.
                        onSaved={() => load(query)}
                      />
                      <AccountEditor row={row} onError={setError} onSaved={() => load(query)} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

const fieldClass =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/40";
const ghostClass =
  "rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/60 transition-colors hover:border-white/35 hover:text-white disabled:opacity-40";

// Everything about an account that an admin might need to change, under
// the referrer editor it grew out of. Each action says what it did
// rather than silently succeeding, because from out here you cannot see
// the effect of any of them.
function AccountEditor({
  row,
  onSaved,
  onError,
}: {
  row: AdminUserRow;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [username, setUsername] = useState(row.username ?? "");
  const [displayName, setDisplayName] = useState(row.display_name ?? "");
  const [busy, setBusy] = useState<null | "save" | "reset" | "admin" | "delete">(null);
  const [note, setNote] = useState<string | null>(null);
  // Deleting takes everything the account owns and cannot be undone, so
  // it asks for the name to be typed rather than for a click.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  const label = row.username || row.display_name || row.email || row.id.slice(0, 8);
  const dirty = username.trim() !== (row.username ?? "") || displayName.trim() !== (row.display_name ?? "");

  async function run(kind: "save" | "reset" | "admin" | "delete", work: () => Promise<string>) {
    if (busy) return;
    setBusy(kind);
    setNote(null);
    onError(null);
    try {
      setNote(await work());
      onSaved();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="mb-2 text-[10px] tracking-[0.12em] text-white/30">ACCOUNT</div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          aria-label={`Username for ${label}`}
          className={fieldClass}
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          aria-label={`Display name for ${label}`}
          className={fieldClass}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || busy !== null}
          onClick={() =>
            run("save", async () => {
              await updateAdminUser(row.id, {
                // Only what actually changed, so saving a display name
                // doesn't re-submit a username that is already right and
                // trip its own uniqueness check.
                username: username.trim() !== (row.username ?? "") ? username.trim() : undefined,
                displayName: displayName.trim() !== (row.display_name ?? "") ? displayName.trim() : undefined,
              });
              return "Saved.";
            })
          }
          className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] text-white transition-colors hover:bg-white/25 disabled:opacity-40"
        >
          {busy === "save" ? "SAVING…" : "SAVE"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("reset", async () => {
              // Read fresh rather than trusting the row this page loaded
              // with, which may be minutes old.
              const email = await fetchAdminUserEmail(row.id);
              if (!email) throw new Error("That account has no email address to send to.");
              await sendPasswordReset(email);
              return `Reset link sent to ${email}.`;
            })
          }
          className={ghostClass}
        >
          {busy === "reset" ? "SENDING…" : "SEND RESET LINK"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("admin", async () => {
              await setUserAdmin(row.id, !row.is_admin);
              return row.is_admin ? "Admin access removed." : "Admin access granted.";
            })
          }
          className={ghostClass}
        >
          {busy === "admin" ? "SAVING…" : row.is_admin ? "REMOVE ADMIN" : "MAKE ADMIN"}
        </button>

        {!confirmDelete && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setConfirmDelete(true);
              setTyped("");
            }}
            className="ml-auto rounded-full border border-red-400/30 px-3 py-1.5 text-[11px] text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200 disabled:opacity-40"
          >
            DELETE
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/5 p-3">
          <p className="text-[12px] text-red-200">
            This deletes {label} and everything they own — picks, tier lists, points, follows. It
            cannot be undone.
          </p>
          <p className="mt-1.5 text-[11px] text-white/45">
            Type <span className="font-semibold text-white/80">{label}</span> to confirm.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={label}
              aria-label="Type the name to confirm deletion"
              className={fieldClass}
            />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={typed.trim() !== label || busy !== null}
                onClick={() =>
                  run("delete", async () => {
                    await deleteAdminUser(row.id);
                    return `${label} deleted.`;
                  })
                }
                className="rounded-full bg-red-500/80 px-3 py-1.5 text-[11px] text-white transition-colors hover:bg-red-500 disabled:opacity-30"
              >
                {busy === "delete" ? "DELETING…" : "DELETE FOR GOOD"}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={ghostClass}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {note && <p className="mt-2 text-[11px] text-[#4ade80]">{note}</p>}
    </div>
  );
}
