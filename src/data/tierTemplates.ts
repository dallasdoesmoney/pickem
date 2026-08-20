import { TEAMS, TEAMS_SORTED } from "@/data/teams";
import { QUARTERBACKS, espnHeadshot } from "@/data/qbs";

// A tier-list template is "what's being ranked" - the item set plus the
// copy that frames it. The engine (src/lib/tierList.ts) knows nothing
// about football; adding QBs, uniforms, stadiums or movies later means
// adding an entry here, not touching the engine.
export type TierItem = {
  id: string;
  // Full accessible name. Items render as logo-only, so this is what
  // screen readers and tooltips get.
  label: string;
  imageUrl: string;
  // Used for the item's glow/backdrop while dragging or selected.
  accent: string;
};

// How an item's picture wants to be drawn.
//
// "mark" is a logo: a square, transparent, already-composed graphic that
// is fitted whole inside its chip and needs no caption, because the
// picture IS the name.
//
// "portrait" is a photograph of a person: wide, framed at the shoulders,
// and useless fitted whole into a small square - the head ends up a
// third of the chip. Those are cropped to fill instead, and they carry a
// caption, because thirty-two faces with no names is a memory test
// rather than a ranking.
export type TierItemStyle = "mark" | "portrait";

export type TierTemplate = {
  // Route segment AND the DB `template` discriminator - stable forever.
  slug: string;
  // What is being ranked, and nothing else: "NFL Teams", "NFL
  // Quarterbacks". No "Tier List" suffix on the end of any of these.
  // Everywhere a title appears, something beside it already says what
  // kind of thing it is - the rail above the board, the eyebrow on the
  // share card, the page it is a card on - so the suffix was the same
  // two words repeated on every line of every screen.
  title: string;
  // Sits under the title. Voice is the site's: short, a little cocky.
  tagline: string;
  defaultListTitle: string;
  // Singular/plural noun for progress + warning copy ("7 unranked teams").
  itemNoun: [singular: string, plural: string];
  // Defaults to "mark" - every category before quarterbacks was logos.
  itemStyle?: TierItemStyle;
  // Mark for the category itself, shown beside it in the tier list menus.
  // Optional because a category is perfectly usable without one - callers
  // fall back to a neutral glyph rather than a broken image.
  icon?: string;
  items: TierItem[];
};

const NFL_TEAMS: TierTemplate = {
  slug: "nfl-teams",
  title: "NFL Teams",
  tagline: "Rank all 32 NFL Teams",
  // Matches `title` above rather than personalising it: this is what the
  // exported image is captioned with, and a card that says something
  // different from the page it was built on reads as a different thing.
  defaultListTitle: "NFL Teams",
  itemNoun: ["team", "teams"],
  // Same CDN the 32 team logos already come from, so this needs no new
  // asset and no new host. If the league path ever moves, the menus fall
  // back to a glyph rather than showing a broken image - drop a file in
  // /public and point this at it to pin it locally instead.
  icon: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  items: TEAMS_SORTED.map((t) => ({
    id: t.abbr,
    label: `${t.city} ${t.name}`,
    imageUrl: t.logo,
    accent: t.color,
  })),
};

const NFL_QBS: TierTemplate = {
  slug: "nfl-quarterbacks",
  title: "NFL Quarterbacks",
  tagline: "Rank every starting QB",
  defaultListTitle: "NFL Quarterbacks",
  itemNoun: ["quarterback", "quarterbacks"],
  itemStyle: "portrait",
  icon: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  // Accent is the player's team colour, so a board of faces still reads
  // as a board of teams at a glance - and so a headshot that fails to
  // load falls back to something meaningful rather than a grey tile.
  items: QUARTERBACKS.map((qb) => ({
    // Namespaced: resolveItem() falls back to a TEAMS lookup by raw id,
    // and a bare ESPN id has no business colliding with that.
    id: `qb-${qb.espnId}`,
    label: qb.name,
    imageUrl: espnHeadshot(qb.espnId),
    accent: TEAMS[qb.team].color,
  })),
};

export const TIER_TEMPLATES: Record<string, TierTemplate> = {
  [NFL_TEAMS.slug]: NFL_TEAMS,
  // Registered only once the roster has actually been synced. An
  // unsynced checkout offers one category rather than two, which is
  // recoverable; offering an empty board is not - see qbs.ts.
  ...(NFL_QBS.items.length > 0 ? { [NFL_QBS.slug]: NFL_QBS } : {}),
};

export function getTierTemplate(slug: string): TierTemplate | null {
  return TIER_TEMPLATES[slug] ?? null;
}

// Item lookup for renderers that only carry ids (share snapshots, the
// canvas exporter) - falls back to a synthetic item rather than throwing,
// so a snapshot referencing a since-removed item still renders.
export function resolveItem(template: TierTemplate, id: string): TierItem {
  const found = template.items.find((i) => i.id === id);
  if (found) return found;
  const team = TEAMS[id as keyof typeof TEAMS];
  if (team) return { id, label: `${team.city} ${team.name}`, imageUrl: team.logo, accent: team.color };
  // A quarterback who has since left the roster the template is built
  // from. Saved boards keep the ids they were ranked with, so this is not
  // an edge case - it is what every saved QB list turns into the week a
  // starter changes, and it gets likelier the more often the roster is
  // synced. The id carries ESPN's player id, and a headshot is keyed on
  // nothing else, so the face survives even when the row is gone. Only
  // the name is lost, and a face with no name still beats a grey tile
  // captioned "qb-3139477".
  const espnId = id.startsWith("qb-") ? id.slice(3) : null;
  if (espnId) return { id, label: "", imageUrl: espnHeadshot(espnId), accent: "#64748b" };
  return { id, label: id, imageUrl: "", accent: "#64748b" };
}
