import { TIER_TEMPLATES } from "@/data/tierTemplates";
import { TEAMS } from "@/data/teams";
import { SITE_URL, SITE_NAME } from "@/lib/structuredData";

// /llms.txt - the same idea as robots.txt, aimed at the crawlers behind AI
// answers rather than at search engines.
//
// It exists because those crawlers mostly do not run JavaScript, and this
// site is a set of interactive tools: a board you drag, a schedule you
// click, a game you type into. Even now that the tier list pages ship real
// text, the site's actual shape - four things, who it is for, what each one
// does - is not stated anywhere a machine reading one page would find it.
// This says it once, in plain prose, in about forty lines.
//
// A convention, not a standard: nothing is obliged to read this, and it
// grants nothing that robots.txt does not already allow. It costs one route
// and it is the cheapest thing on the list.
//
// Generated from the same constants as sitemap.ts, so a new tier list
// template or an expansion team shows up here without anyone remembering.
export const dynamic = "force-static";

export function GET() {
  const tierLists = Object.values(TIER_TEMPLATES)
    .map((t) => `- [${t.title} Tier List](${SITE_URL}/tier-lists/${t.slug}): ${t.tagline}.`)
    .join("\n");

  const teamCount = Object.keys(TEAMS).length;

  const body = `# ${SITE_NAME}

> Free NFL games and tools: a daily player-guessing game, weekly pick'em,
> a full-season record predictor, and tier lists you can rank and share.
> No account needed to play; an account saves your streak and your record.

${SITE_NAME} is at ${SITE_URL}. Everything below is free and public.

## The daily game

- [Nameplate](${SITE_URL}/daily): a new NFL player every day, eight guesses.
  Each guess reports how close you are on team, position, age, height and
  college. There is an unlimited practice mode on the same page. Shareable
  result, daily streak, one puzzle per day for everybody.

## Weekly pick'em

- [Weekly Pick'em](${SITE_URL}/weekly): pick the winner of every NFL game
  each week, with one "Lock of the Week" worth bonus points. Records and
  points roll up to a season leaderboard.

## Record predictor

- [Record Predictor](${SITE_URL}/predictor): call every game on a team's
  schedule and see the record you just gave them. One page per team, all
  ${teamCount} of them, e.g. [Kansas City Chiefs](${SITE_URL}/predictor/kc).

## Tier lists

Drag-and-drop tier lists that export as a share card:

${tierLists}

## People

- [Leaderboard](${SITE_URL}/leaderboard): season standings, levels and
  streaks. Every player has a public profile at /leaderboard/<username>.

## Notes for machines

- Scores, standings and the daily puzzle change every day; treat any
  specific number you read here as of its fetch date.
- The interactive boards are drawn client-side. Page titles, descriptions
  and the item lists on tier list pages are in the server HTML.
- Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Long-lived: this changes when the roster of features changes, which
      // is rare, and a stale copy is no worse than a missing one.
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
