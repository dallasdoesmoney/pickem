"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { GAMES_BY_WEEK } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { fetchWeeks, setWeekOpen, setWeekResultsPublished, fetchGameResults, setGameResult, clearGameResult, WeekRow } from "@/lib/supabase/admin";
import { fetchPendingCreatorRequests, reviewCreatorRequest, PendingCreatorRequest } from "@/lib/supabase/creatorRequests";
import { errorMessage } from "@/lib/errorMessage";
import { AdminUsers } from "@/components/admin/AdminUsers";

export default function AdminPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-3xl w-full mx-auto flex items-center justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </main>
    );
  }

  if (!user || !profile?.is_admin) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-3xl w-full mx-auto text-center">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
          NOT AUTHORIZED
        </h1>
        <p className="text-white/50 text-sm mt-2">This page is admin-only.</p>
      </main>
    );
  }

  return <AdminDashboard />;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-white/40 hover:text-white/70 transition-colors mb-6">
      &larr; Back to admin
    </button>
  );
}

type AdminSection = "menu" | "pickem" | "tasks" | "users";

// Every admin capability lives behind one of a small set of cards
// (Pick'em today, Tasks for anything needing a human decision - just
// Creator Requests right now, more task types can join it later without
// this shell changing) rather than one long flat page - keeps each
// section's own state/effects colocated here without needing separate
// routes.
function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>("menu");

  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  // Held WITH the week it was fetched for, so "loaded" is a comparison
  // rather than a second flag the effect has to reset first. The two
  // used to drift for one commit every time the week changed: the map
  // was still last week's while resultsLoaded was still true, which is
  // exactly the render where the winner buttons are enabled.
  const [fetchedResults, setFetchedResults] = useState<{
    week: number;
    map: Record<string, TeamAbbr>;
  } | null>(null);
  const resultsLoaded = fetchedResults?.week === selectedWeek;
  const results = useMemo(
    () => (fetchedResults?.week === selectedWeek ? fetchedResults.map : {}),
    [fetchedResults, selectedWeek]
  );
  const [error, setError] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [creatorRequests, setCreatorRequests] = useState<PendingCreatorRequest[] | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    fetchPendingCreatorRequests()
      .then(setCreatorRequests)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function handleReviewRequest(requestId: string, approve: boolean) {
    if (reviewingId) return;
    setReviewingId(requestId);
    setError(null);
    try {
      await reviewCreatorRequest(requestId, approve);
      setCreatorRequests((prev) => prev?.filter((r) => r.id !== requestId) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewingId(null);
    }
  }

  useEffect(() => {
    const week = selectedWeek;
    fetchGameResults(week)
      .then((map) => setFetchedResults({ week, map }))
      .catch((err) => setError(errorMessage(err)));
  }, [selectedWeek]);

  const currentWeekRow = weeks?.find((w) => w.week === selectedWeek);
  const games = GAMES_BY_WEEK[selectedWeek] ?? [];

  async function handleToggleOpen() {
    if (!currentWeekRow || savingWeek) return;
    setSavingWeek(true);
    setError(null);
    try {
      const nextOpen = !currentWeekRow.is_open;
      await setWeekOpen(selectedWeek, nextOpen);
      setWeeks((prev) => prev?.map((w) => (w.week === selectedWeek ? { ...w, is_open: nextOpen } : w)) ?? prev);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingWeek(false);
    }
  }

  async function handleTogglePublished() {
    if (!currentWeekRow || savingWeek) return;
    setSavingWeek(true);
    setError(null);
    try {
      const next = !currentWeekRow.results_published;
      await setWeekResultsPublished(selectedWeek, next);
      setWeeks((prev) => prev?.map((w) => (w.week === selectedWeek ? { ...w, results_published: next } : w)) ?? prev);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingWeek(false);
    }
  }

  async function handlePickWinner(gameId: string, team: TeamAbbr) {
    if (savingGameId) return;
    setSavingGameId(gameId);
    setError(null);
    try {
      if (results[gameId] === team) {
        await clearGameResult(gameId);
        setFetchedResults((prev) => {
          if (!prev || prev.week !== selectedWeek) return prev;
          const map = { ...prev.map };
          delete map[gameId];
          return { week: prev.week, map };
        });
      } else {
        await setGameResult(gameId, selectedWeek, team);
        setFetchedResults((prev) =>
          prev && prev.week === selectedWeek
            ? { week: prev.week, map: { ...prev.map, [gameId]: team } }
            : prev
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingGameId(null);
    }
  }

  const resultCount = Object.keys(results).length;
  const taskCount = creatorRequests?.length ?? 0;

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-3xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        ADMIN
      </h1>
      {section === "menu" && <p className="text-center text-white/50 text-sm mt-2 mb-8">Pick a section to manage.</p>}

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {section === "menu" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setSection("pickem")}
            className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 hover:border-white/20 transition-colors"
          >
            <span className="text-2xl shrink-0">🏈</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                PICK&rsquo;EM
              </div>
              <div className="text-[11px] text-white/45 mt-0.5">Open/close weeks, record game results</div>
            </div>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setSection("tasks")}
            className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 hover:border-white/20 transition-colors"
          >
            <span className="text-2xl shrink-0">✅</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                TASKS
              </div>
              <div className="text-[11px] text-white/45 mt-0.5">Creator requests and other things needing a decision</div>
            </div>
            {taskCount > 0 && (
              <span
                className="shrink-0 h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[11px]"
                style={{ fontFamily: "var(--font-display)", background: "#ef4444", color: "#fff" }}
              >
                {taskCount}
              </span>
            )}
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setSection("users")}
            className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 hover:border-white/20 transition-colors"
          >
            <span className="text-2xl shrink-0">👥</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                USERS
              </div>
              <div className="text-[11px] text-white/45 mt-0.5">Search everyone, fix who referred who</div>
            </div>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}

      {section === "users" && (
        <>
          <BackButton onClick={() => setSection("menu")} />
          <AdminUsers />
        </>
      )}

      {section === "pickem" && (
        <>
          <BackButton onClick={() => setSection("menu")} />
          {!weeks ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {weeks.map((w) => (
                  <button
                    key={w.week}
                    onClick={() => setSelectedWeek(w.week)}
                    className={`relative h-11 w-11 rounded-full border-2 text-sm flex items-center justify-center transition-colors ${
                      w.week === selectedWeek ? "border-white bg-white/10 text-white" : "border-white/15 text-white/50 hover:border-white/30 hover:text-white"
                    }`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {w.week}
                    {w.is_open && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#070e1c]" />}
                    {w.results_published && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-sky-400 border-2 border-[#070e1c]" />}
                  </button>
                ))}
              </div>
              <p className="text-center text-[11px] text-white/40 mb-8">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1" /> open for picking &nbsp;&nbsp;
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400 mr-1" /> results published
              </p>

              {currentWeekRow && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                  <div>
                    <div className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                      WEEK {selectedWeek}
                    </div>
                    <div className="text-xs text-white/45 mt-1">
                      {resultCount}/{games.length} results entered
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-white/40 tracking-wide">{currentWeekRow.is_open ? "OPEN FOR PICKING" : "CLOSED TO PICKS"}</span>
                      <button
                        onClick={handleToggleOpen}
                        disabled={savingWeek}
                        className="rounded-full px-5 py-2 text-xs disabled:opacity-50 transition-colors"
                        style={{
                          fontFamily: "var(--font-display)",
                          background: currentWeekRow.is_open ? "linear-gradient(135deg, #4ade80, #22c55e)" : "transparent",
                          color: currentWeekRow.is_open ? "#0e1b33" : "rgba(255,255,255,0.7)",
                          border: currentWeekRow.is_open ? "none" : "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        {currentWeekRow.is_open ? "CLOSE WEEK" : "OPEN WEEK"}
                      </button>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-white/40 tracking-wide">{currentWeekRow.results_published ? "RESULTS PUBLISHED" : "RESULTS NOT PUBLISHED"}</span>
                      <button
                        onClick={handleTogglePublished}
                        disabled={savingWeek}
                        className="rounded-full px-5 py-2 text-xs disabled:opacity-50 transition-colors"
                        style={{
                          fontFamily: "var(--font-display)",
                          background: currentWeekRow.results_published ? "linear-gradient(135deg, #38bdf8, #0ea5e9)" : "transparent",
                          color: currentWeekRow.results_published ? "#0e1b33" : "rgba(255,255,255,0.7)",
                          border: currentWeekRow.results_published ? "none" : "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        {currentWeekRow.results_published ? "UNPUBLISH" : "PUBLISH RESULTS"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {games.map((game) => {
                  const away = TEAMS[game.away];
                  const home = TEAMS[game.home];
                  const gameId = game.id;
                  const winner = results[gameId];
                  const saving = savingGameId === gameId;
                  return (
                    <div key={gameId} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                      <button
                        onClick={() => handlePickWinner(gameId, game.away)}
                        disabled={!resultsLoaded || saving}
                        className={`flex-1 flex items-center gap-2 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 ${
                          winner === game.away ? "ring-2 ring-emerald-400" : "hover:bg-white/5"
                        }`}
                        style={{ background: winner === game.away ? away.color : "transparent" }}
                      >
                        <img src={away.logo} alt="" crossOrigin="anonymous" className="h-6 w-6 object-contain shrink-0" />
                        <span className="text-sm truncate">
                          {away.city} {away.name}
                        </span>
                      </button>
                      <span className="text-white/30 text-xs shrink-0">@</span>
                      <button
                        onClick={() => handlePickWinner(gameId, game.home)}
                        disabled={!resultsLoaded || saving}
                        className={`flex-1 flex items-center gap-2 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 justify-end text-right ${
                          winner === game.home ? "ring-2 ring-emerald-400" : "hover:bg-white/5"
                        }`}
                        style={{ background: winner === game.home ? home.color : "transparent" }}
                      >
                        <span className="text-sm truncate">
                          {home.city} {home.name}
                        </span>
                        <img src={home.logo} alt="" crossOrigin="anonymous" className="h-6 w-6 object-contain shrink-0" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {section === "tasks" && (
        <>
          <BackButton onClick={() => setSection("menu")} />
          {!creatorRequests ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : creatorRequests.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm">No tasks right now.</p>
            </div>
          ) : (
            <>
              <div className="text-[11px] text-white/45 tracking-[0.15em] mb-3">CREATOR REQUESTS ({creatorRequests.length})</div>
              <div className="flex flex-col gap-2">
                {creatorRequests.map((req) => {
                  const label = req.display_name || req.username;
                  const busy = reviewingId === req.id;
                  return (
                    <div key={req.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
                      <Link href={`/leaderboard/${req.username}`} target="_blank" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">{label.charAt(0).toUpperCase()}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate underline decoration-white/20 underline-offset-2">{label}</div>
                          <div className="text-[11px] text-white/40">View profile &rarr;</div>
                        </div>
                      </Link>
                      {/* The whole application, not just a link - these
                          fields exist so a decision can be made from this
                          card without opening five tabs. */}
                      {(req.socials ?? []).length > 0 && (
                        <div className="flex flex-col gap-1">
                          {(req.socials ?? []).map((social) => (
                            <a
                              key={`${social.platform}-${social.url}`}
                              href={social.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-sky-300/80 hover:text-sky-300"
                            >
                              <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/35">{social.platform}</span>
                              <span className="truncate">{social.url}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {[
                          req.audience_size && `${req.audience_size} audience`,
                          req.primary_platform && `mainly ${req.primary_platform}`,
                          req.cadence,
                          req.nfl_focus && `NFL: ${req.nfl_focus}`,
                          ...(req.content_types ?? []),
                        ]
                          .filter(Boolean)
                          .map((chip) => (
                            <span key={String(chip)} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                              {chip}
                            </span>
                          ))}
                      </div>

                      {req.content_url && (
                        <a href={req.content_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300/80 hover:text-sky-300 truncate block">
                          Example: {req.content_url}
                        </a>
                      )}
                      {req.contact_handle && <p className="text-xs text-white/50">Contact: {req.contact_handle}</p>}
                      {req.note && <p className="text-xs text-white/50">{req.note}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReviewRequest(req.id, true)}
                          disabled={busy}
                          className="flex-1 rounded-full px-3 py-1.5 text-xs disabled:opacity-50 active:scale-95 transition-transform duration-150"
                          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
                        >
                          {busy ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleReviewRequest(req.id, false)}
                          disabled={busy}
                          className="flex-1 rounded-full px-3 py-1.5 text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
