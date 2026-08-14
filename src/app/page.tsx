"use client";

import { useState } from "react";
import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";
import { FlowItem, PickStats, flatten, splitIntoColumns, computePickStats, computePickTags } from "@/lib/pickLayout";
import { renderShareImage } from "@/lib/shareImage";

function PillTexture() {
  return (
    <div
      className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
      style={{ backgroundImage: "url(/noise.png)", backgroundSize: "64px 64px", opacity: 0.1, mixBlendMode: "overlay" }}
    />
  );
}

const PILL_STYLE = { background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" };

function StatPills({ stats }: { stats: PickStats }) {
  return (
    <div className="flex gap-2 lg:gap-5 justify-center flex-wrap">
      <div
        className="relative shrink-0 rounded-full border-2 border-white text-center flex flex-col items-center justify-center w-[88px] h-[56px] lg:w-[172px] lg:h-[88px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <span className="absolute -top-2 -left-1 lg:-top-3 lg:-left-1.5 text-2xl lg:text-5xl rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10">🐶</span>
        <div className="relative z-10 text-base lg:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          {stats.underdogCount}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">UNDERDOGS</div>
      </div>
      <div
        className="relative shrink-0 rounded-full border-2 border-emerald-400 text-center flex flex-col items-center justify-center w-[144px] h-[56px] lg:w-[250px] lg:h-[88px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <span className="absolute -top-2 -left-1 lg:-top-3 lg:-left-1.5 text-2xl lg:text-5xl rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10">💎</span>
        <div
          className="relative z-10 text-base lg:text-2xl flex items-center justify-center gap-1 lg:gap-1.5"
          style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}
        >
          {stats.boldestTeam ? (
            <>
              <img src={stats.boldestTeam.logo} alt="" crossOrigin="anonymous" className="h-8 lg:h-[64px] w-auto" />+{stats.boldestSpread}
            </>
          ) : (
            "-"
          )}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">BOLDEST PICK</div>
      </div>
      <div
        className="relative shrink-0 rounded-full border-2 border-white text-center flex flex-col items-center justify-center w-[88px] h-[56px] lg:w-[172px] lg:h-[88px]"
        style={PILL_STYLE}
      >
        <PillTexture />
        <div className="relative z-10 text-base lg:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          {stats.chalkPct !== null ? `${stats.chalkPct}%` : "-"}
        </div>
        <div className="relative z-10 text-[8px] lg:text-[11px] text-white/55 mt-0.5">CHALK</div>
      </div>
    </div>
  );
}

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, resetPicks, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const groups = groupGamesByDay(games);
  const stats = computePickStats(games, picks);
  const tags = computePickTags(games, picks);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderShareImage({ games, groups, picks, week: CURRENT_WEEK });
      const filename = `pickem-week-${CURRENT_WEEK}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      function download() {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      // Desktop Chrome (especially macOS) frequently advertises file
      // sharing support and then aborts immediately with no working share
      // target - confirmed on-device. Coarse pointer (touch) is a much
      // more reliable signal for "has a real native share sheet" than
      // canShare() alone, which the API spec never ties to that.
      const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: "NFL Pick'em",
            text: `My Week ${CURRENT_WEEK} picks`,
          });
        } catch (shareErr) {
          if (!(shareErr instanceof Error && shareErr.name === "AbortError")) download();
        }
      } else {
        download();
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setSharing(false);
    }
  }

  const items = flatten(groups);
  const { col1, col2 } = splitIntoColumns(groups);
  const rowCount = Math.max(col1.length, col2.length);

  const renderMobileItem = (item: FlowItem, isFirst: boolean) =>
    item.type === "header" ? (
      <h2
        key={item.key}
        className={`text-center whitespace-nowrap px-2 mb-2 text-[clamp(1.25rem,7.5vw,2.75rem)] lg:text-4xl ${
          isFirst ? "mt-0" : "mt-5"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {item.label}
      </h2>
    ) : item.type === "game" ? (
      <div key={item.key} className="mb-4">
        <GameCard
          game={item.game}
          picked={picks[item.game.id]}
          onPick={(team) => setPick(item.game.id, team)}
          tag={tags[item.game.id]}
        />
      </div>
    ) : null;

  const renderGridCell = (item: FlowItem | undefined) => {
    if (!item || item.type === "blank") {
      return <div key={item?.key ?? Math.random()} />;
    }
    if (item.type === "header") {
      return (
        <div key={item.key} className="h-full flex items-end justify-center pb-2">
          <h2
            className="text-center whitespace-nowrap px-2 text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {item.label}
          </h2>
        </div>
      );
    }
    return (
      <GameCard
        key={item.key}
        game={item.game}
        picked={picks[item.game.id]}
        onPick={(team) => setPick(item.game.id, team)}
        tag={tags[item.game.id]}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-8 max-w-4xl w-full mx-auto relative">
        <div className="flex flex-col items-center">
          <div className="text-center">
            <span className="relative inline-block text-xl text-white tracking-[0.1em] mb-1" style={{ fontFamily: "var(--font-display)" }}>
              WEEK {CURRENT_WEEK}
              <span
                className="absolute top-1/2 -right-4 translate-x-full -translate-y-1/2 whitespace-nowrap rotate-[10deg] text-[11px] text-white rounded-full px-2.5 py-0.5 border-2 border-white"
                style={{ fontFamily: "var(--font-display)", background: "#1b2947", boxShadow: "2.5px 2.5px 0 rgba(0,0,0,0.45)" }}
              >
                🏈 {pickedCount}/{games.length}
              </span>
            </span>
            <div className="w-10 h-[2px] bg-white/25 mx-auto mb-3" />
            <h1
              className="text-[clamp(2.25rem,9vw,3.5rem)] leading-none tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              NFL PICK&rsquo;EM
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-10 max-w-4xl w-full mx-auto">
        {loaded && (
          <>
            <div className="flex flex-col lg:hidden">
              {items.map((item, i) => renderMobileItem(item, i === 0))}
            </div>
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 lg:items-stretch">
              {Array.from({ length: rowCount }).flatMap((_, i) => [
                renderGridCell(col1[i]),
                renderGridCell(col2[i]),
              ])}
            </div>

            <div className="mt-8">
              <StatPills stats={stats} />
            </div>

            <div className="flex justify-center mt-5">
              <button
                aria-label="Share your picks"
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-2 rounded-full px-7 py-3.5 text-lg shadow-[0_4px_20px_rgba(74,222,128,0.35)] active:scale-95 transition-transform duration-150 disabled:opacity-60"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  color: "#0e1b33",
                }}
              >
                {sharing ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-[#0e1b33]/40 border-t-[#0e1b33] animate-spin" />
                    SHARING&hellip;
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                    </svg>
                    SHARE MY PICKS 🏈
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-center mt-3">
              <button
                aria-label="Reset your picks"
                onClick={() => {
                  if (window.confirm("Reset all your picks for this week?")) resetPicks();
                }}
                className="text-xs text-white/40 hover:text-white/70 rounded-full px-4 py-1.5 border border-white/15 hover:border-white/30 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              >
                RESET
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
