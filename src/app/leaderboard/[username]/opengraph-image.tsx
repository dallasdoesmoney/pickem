import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchProfileRow, fetchProfileRank } from "@/lib/supabase/server";
import { getLevelInfo, subLevelRoman } from "@/lib/levels";

// The card a shared profile link unfurls as. Until now every one of them
// was /og-default.png - the same generic site card for every player on
// the site, which is a strange thing to hand a creator whose whole reason
// for sharing the link is that it is about them.
//
// Drawn with Satori rather than the canvas in shareImage.ts, because
// those run in a browser and this has to run on a request with no DOM.
// The palette and the shapes are deliberately the ones the profile page
// itself uses, so the card and the page it opens are the same object.

export const alt = "Sideline Brew player profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The site's own two faces, vendored rather than fetched. next/font
// downloads these at build time for the app itself, but it hands back CSS
// class names, not bytes, and Satori needs bytes. Fetching them from
// Google at render time would put a network call the card cannot recover
// from between a shared link and its preview.
const FONT_DIR = join(process.cwd(), "assets/fonts");
const [bungee, fredoka, fredokaBold] = await Promise.all([
  readFile(join(FONT_DIR, "Bungee-Regular.ttf")),
  readFile(join(FONT_DIR, "Fredoka-Medium.ttf")),
  readFile(join(FONT_DIR, "Fredoka-SemiBold.ttf")),
]);

const GROUND = "#070e1c";
const PANEL = "#101d38";
const RULE = "rgba(255,255,255,0.12)";

// What is left for the name after the 64px page padding on both sides, the
// 196px avatar and the 40px beside it.
const NAME_WIDTH = 1200 - 64 * 2 - 196 - 40;

// Bungee's uppercase advance is a shade over two thirds of the em, near
// enough that dividing gets the largest size that still fits on one line.
// Clamped at the top so a four-letter handle is not absurd, and at the
// bottom so the longest allowed display name is still readable at a
// glance in a feed.
function nameSize(name: string) {
  return Math.max(34, Math.min(82, Math.floor(NAME_WIDTH / (name.length * 0.68))));
}

// Inlined, because Satori fetches remote images itself and a slow or dead
// avatar host would take the whole card down with it. A missing avatar
// falls back to the initial, which is what the profile page does too.
async function avatarDataUri(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Well past any avatar this app stores, and small enough that a
    // hostile URL cannot turn one link preview into a memory problem.
    if (buf.byteLength > 2_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 26px",
        borderRadius: 18,
        background: PANEL,
        border: `1px solid ${RULE}`,
        minWidth: 168,
      }}
    >
      <div style={{ fontFamily: "Fredoka", fontSize: 20, letterSpacing: 3, color: "rgba(255,255,255,0.45)" }}>{label}</div>
      <div style={{ fontFamily: "Bungee", fontSize: 44, color }}>{value}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const row = await fetchProfileRow(username).catch(() => null);

  // No player, or no database: still a valid card. A link preview that
  // fails to render is a broken-looking link, which is worse than a
  // plain one.
  if (!row) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: GROUND,
            fontFamily: "Bungee",
            fontSize: 84,
            color: "#ffffff",
            letterSpacing: 2,
          }}
        >
          SIDELINE BREW
        </div>
      ),
      { ...size, fonts: [{ name: "Bungee", data: bungee, style: "normal", weight: 400 }] }
    );
  }

  const [rank, avatar] = await Promise.all([fetchProfileRank(row).catch(() => null), avatarDataUri(row.avatar_url)]);
  const level = getLevelInfo(row.total_points);
  const name = row.display_name || row.username;
  const accent = level.rankColor;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: GROUND,
          // The rank colour, once, behind the avatar. It is the one thing
          // on the card that differs by player rather than by number, so
          // it is worth more than a border somewhere.
          backgroundImage: `radial-gradient(circle at 18% 34%, ${accent}33 0%, ${accent}00 46%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={196}
              height={196}
              style={{ width: 196, height: 196, borderRadius: 98, objectFit: "cover", border: `6px solid ${accent}` }}
            />
          ) : (
            <div
              style={{
                width: 196,
                height: 196,
                borderRadius: 98,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: PANEL,
                border: `6px solid ${accent}`,
                fontFamily: "Bungee",
                fontSize: 86,
                color: accent,
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: NAME_WIDTH }}>
            <div style={{ fontFamily: "Fredoka", fontSize: 24, letterSpacing: 8, color: "rgba(255,255,255,0.42)" }}>
              SIDELINE BREW
            </div>
            {/* Sized to fit rather than clipped. Bungee is a wide face and
                display names run to twenty characters, so one fixed size
                either cuts somebody's name off the edge of the card or
                sets every short name too small to carry it. Wrapping is
                not the alternative - a second line pushes the stat row off
                the bottom. */}
            <div
              style={{
                fontFamily: "Bungee",
                fontSize: nameSize(name),
                color: "#ffffff",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* One template literal, not `@` plus an expression: Satori
                  treats two children as a layout and demands an explicit
                  display on the parent, and the failure mode is the whole
                  card 500ing rather than a warning. */}
              <div style={{ fontFamily: "Fredoka", fontSize: 32, color: accent }}>{`@${row.username}`}</div>
              {!level.isUnranked && (
                <div
                  style={{
                    fontFamily: "Fredoka",
                    fontSize: 22,
                    letterSpacing: 2,
                    padding: "6px 16px",
                    borderRadius: 999,
                    color: accent,
                    border: `2px solid ${accent}66`,
                    background: `${accent}1a`,
                  }}
                >
                  {`${level.rankName.toUpperCase()} ${subLevelRoman(level.subLevel)}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zeroes rather than dashes: a player who has not been graded yet
            is 0-0, which is true and reads as a scoreboard, where a row of
            em dashes reads as missing data. Rank is the one exception,
            because it genuinely is unknown when the count query fails. */}
        <div style={{ display: "flex", gap: 20 }}>
          <Stat label="RANK" value={rank !== null ? `#${rank}` : "\u2014"} color="#ffffff" />
          <Stat label="RECORD" value={`${row.correct}-${row.graded - row.correct}`} color="#ffffff" />
          <Stat label="LEVEL" value={`${level.level}`} color={accent} />
          <Stat label="STREAK" value={`${row.streak}`} color={row.streak > 0 ? "#ffce3a" : "#ffffff"} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bungee", data: bungee, style: "normal", weight: 400 },
        { name: "Fredoka", data: fredoka, style: "normal", weight: 500 },
        { name: "Fredoka", data: fredokaBold, style: "normal", weight: 600 },
      ],
    }
  );
}
