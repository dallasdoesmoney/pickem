// The machine-readable half of "who is Sideline Brew".
//
// A search engine has to decide that the words "Sideline Brew" name THIS
// site, and it has very little to go on: the name reads like a coffee shop
// or a brewery, so it is competing with every real one. Titles and a
// sitemap say what each page is; nothing on the site said what the site is.
//
// Two objects do that job, and they are the ones Google's own docs point at
// for brand identity: Organization (the entity) and WebSite (the thing at
// this domain). `sameAs` is the important field - it is how an engine links
// the site to accounts it already knows about, and it is the single
// strongest signal available here short of inbound links.
//
// Deliberately small. Marking up things that are not on the page is how a
// site gets a structured-data penalty rather than a rich result.

export const SITE_URL = "https://sidelinebrew.com";
export const SITE_NAME = "Sideline Brew";

// Every profile that is unmistakably this brand or its owner.
//
// EMPTY EXCEPT THE DISCORD, on purpose. The Discord invite is in the repo
// already (src/data/achievements.ts) so it is known to be real; the social
// accounts are not, and a `sameAs` pointing at an account that is not
// actually ours is worse than no `sameAs` at all - it teaches the engine a
// wrong fact about the brand and there is no quick way to unteach it.
//
// Add the real handles here and they take effect on the next deploy:
//   "https://www.tiktok.com/@...", "https://www.instagram.com/...",
//   "https://www.youtube.com/@...", "https://x.com/..."
export const BRAND_PROFILES: string[] = ["https://discord.gg/pcteJyuJXj"];

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/header-logo.png`,
  description: "NFL pick'em, tier lists, a season predictor and a daily guessing game.",
  ...(BRAND_PROFILES.length > 0 ? { sameAs: BRAND_PROFILES } : {}),
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en-US",
};

// One graph rather than two blocks, so the WebSite can point at the
// Organization by id instead of describing it a second time.
export const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [ORGANIZATION, WEBSITE],
};

// Where a page sits, for the crumb trail search results draw under a
// result and for the "this site has sections" signal underneath it.
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}
