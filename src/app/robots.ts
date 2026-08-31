import type { MetadataRoute } from "next";

// The other half of sitemap.ts: what a crawler should not bother with.
//
// Everything disallowed here is either private (your account, the admin
// screens, your notifications) or single-use (a password reset link, an
// unsubscribe confirmation). None of it is secret - disallow is a request,
// not a lock, and anything that actually needs protecting is protected by
// RLS and a security-definer function rather than by this file. It is here
// so a crawler spends its budget on the pages that are worth ranking.
//
// The tier list share routes carry their own noindex, so they need no
// entry: /tier-lists/[list]/share/[code] is a personal link somebody
// passes around, and a rule here would only duplicate a decision the page
// already makes for itself.
const SITE = "https://sidelinebrew.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/notifications", "/reset-password", "/unsubscribe"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
    // AI crawlers are covered by the `*` rule above, which allows them -
    // and that is the intended answer, not an oversight. Being read by the
    // things that answer "what should I play this NFL season" is the point.
    // To change your mind later, add per-agent rules here for GPTBot,
    // ClaudeBot, PerplexityBot and Google-Extended.
  };
}
