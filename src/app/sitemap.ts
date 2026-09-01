import type { MetadataRoute } from "next";
import { TIER_TEMPLATES } from "@/data/tierTemplates";
import { TEAMS } from "@/data/teams";

// What search engines are allowed to know exists.
//
// Until now there was no sitemap and no robots.txt at all, which for a
// site whose organic hook is "NFL quarterback tier list" and "NFL record
// predictor" is a lot of free traffic left on the floor.
//
// BUILT FROM THE DATA, not from a list typed out here. A new tier list
// template or an expansion team appears in the sitemap on its own,
// because the alternative is a file that is correct on the day it is
// written and quietly wrong six months later.
//
// Deliberately absent: /account, /admin, /notifications, /reset-password,
// /unsubscribe - all private or single-use - and the tier list SHARE
// codes, which are personal links somebody passes around and set their
// own noindex on purpose. robots.ts says the same thing from the other
// side.
const SITE = "https://sidelinebrew.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // priority is a hint about relative importance WITHIN this site, not a
  // ranking lever - Google treats it as advisory at best. The daily game
  // is the thing worth finding, so it sits above the rest.
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    // /nfl-nameplate, not /daily. /daily is a permanent redirect now and
    // a redirect has no business in a sitemap - it costs a crawl to
    // learn something the redirect would have told the crawler anyway,
    // and listing a URL that is not the canonical one is the single
    // easiest way to keep two addresses alive for one page.
    { url: `${SITE}/nfl-nameplate`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/tier-lists`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/weekly`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/predictor`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];

  const tierLists: MetadataRoute.Sitemap = Object.keys(TIER_TEMPLATES).map((slug) => ({
    url: `${SITE}/tier-lists/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Thirty-two pages that each answer a real search - "Chiefs record
  // prediction" and thirty-one like it. They are already statically
  // generated; they were simply never advertised.
  const teams: MetadataRoute.Sitemap = Object.keys(TEAMS).map((abbr) => ({
    url: `${SITE}/predictor/${abbr.toLowerCase()}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...fixed, ...tierLists, ...teams];
}
