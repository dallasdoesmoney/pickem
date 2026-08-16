"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GAMES_BY_WEEK } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { fetchWeeks, setWeekOpen, setWeekResultsPublished, fetchGameResults, setGameResult, clearGameResult, WeekRow } from "@/lib/supabase/admin";

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

function AdminDashboard() {
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [results, setResults] = useState<Record<string, TeamAbbr>>({});
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    setResultsLoaded(false);
    fetchGameResults(selectedWeek)
      .then((map) => {
        setResults(map);
        setResultsLoaded(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
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
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
        setResults((prev) => {
          const next = { ...prev };
          delete next[gameId];
          return next;
        });
      } else {
        await setGameResult(gameId, selectedWeek, team);
        setResults((prev) => ({ ...prev, [gameId]: team }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingGameId(null);
    }
  }

  const resultCount = Object.keys(results).length;

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-3xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        ADMIN
      </h1>
      <p className="text-center text-white/50 text-sm mt-2 mb-8">Control which week is open for picking, and record results.</p>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

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
                {w.is_open && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0e1b33]" />}
                {w.results_published && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-sky-400 border-2 border-[#0e1b33]" />}
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
                    <span className="text-sm truncate">{away.city} {away.name}</span>
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
                    <span className="text-sm truncate">{home.city} {home.name}</span>
                    <img src={home.logo} alt="" crossOrigin="anonymous" className="h-6 w-6 object-contain shrink-0" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
