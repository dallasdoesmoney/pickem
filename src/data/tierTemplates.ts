import { TEAMS, TEAMS_SORTED } from "@/data/teams";

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

export type TierTemplate = {
  // Route segment AND the DB `template` discriminator - stable forever.
  slug: string;
  title: string;
  // Sits under the title. Voice is the site's: short, a little cocky.
  tagline: string;
  defaultListTitle: string;
  // Singular/plural noun for progress + warning copy ("7 unranked teams").
  itemNoun: [singular: string, plural: string];
  items: TierItem[];
};

const NFL_TEAMS: TierTemplate = {
  slug: "nfl-teams",
  title: "NFL Team Tier List",
  tagline: "32 teams. Six tiers. No fence sitting.",
  defaultListTitle: "My NFL Team Tier List",
  itemNoun: ["team", "teams"],
  items: TEAMS_SORTED.map((t) => ({
    id: t.abbr,
    label: `${t.city} ${t.name}`,
    imageUrl: t.logo,
    accent: t.color,
  })),
};

export const TIER_TEMPLATES: Record<string, TierTemplate> = {
  [NFL_TEAMS.slug]: NFL_TEAMS,
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
  return { id, label: id, imageUrl: "", accent: "#64748b" };
}
