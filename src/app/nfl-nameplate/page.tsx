import type { Metadata } from "next";
import { NameplateGame } from "@/components/NameplateGame";
import { NameplateAbout, FAQ } from "@/components/NameplateAbout";

// THE GAME'S OWN ADDRESS.
//
// It used to live at /daily, which was the right name for the category
// and the wrong name for the thing: nobody searches "daily". They search
// "NFL Nameplate", and the URL is one of the few places a search engine
// takes you at your word about what a page is. Hyphenated, because a
// crawler splits on hyphens and cannot split "nflnameplate" at all.
//
// /daily still works and always will - it is a permanent redirect in
// next.config.ts, so every result anybody has ever shared, and the play
// links in the announcement emails, land here instead of 404ing.
//
// A SERVER COMPONENT, which is the other half of the point. The game is
// a client component behind a fetch, so the HTML a crawler is served for
// this route used to be a heading and an empty board. Everything on this
// page that says what NFL Nameplate IS is now in that first response.

const SITE = "https://sidelinebrew.com";
const PATH = "/nfl-nameplate";

const DESCRIPTION =
  "Play NFL Nameplate, the free daily NFL player guessing game. One mystery player a day, eight guesses, same player for everyone. New board every morning.";

export const metadata: Metadata = {
  // The name first, because a title is read left to right and truncated
  // from the right. "Sideline Brew - NFL Nameplate" spends the visible
  // half of a phone result on the brand, which is the half somebody
  // searching for the game already does not have.
  title: "NFL Nameplate - Daily NFL Player Guessing Game",
  description: DESCRIPTION,
  // Without this, /daily and /nfl-nameplate can both be treated as
  // candidates for the same content while the redirect propagates.
  alternates: { canonical: PATH },
  keywords: ["NFL Nameplate", "NFL nameplate game", "daily NFL game", "NFL player guessing game", "NFL wordle", "guess the NFL player"],
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "NFL Nameplate - Daily NFL Player Guessing Game",
    description: DESCRIPTION,
    url: PATH,
    images: [{ url: "/og-daily.png", width: 1200, height: 630, alt: "NFL Nameplate - the daily NFL player guessing game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NFL Nameplate - Daily NFL Player Guessing Game",
    description: DESCRIPTION,
    images: ["/og-daily.png"],
  },
};

// Three graphs in one script, which is how Google prefers to be handed
// them. Game says what this is; FAQPage is the same five questions the
// page shows, word for word, because structured data that disagrees with
// the page is worse than none; BreadcrumbList is what turns the grey URL
// line in a result into "Sideline Brew > NFL Nameplate".
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Game",
      "@id": `${SITE}${PATH}#game`,
      name: "NFL Nameplate",
      alternateName: "NFL Nameplate Game",
      url: `${SITE}${PATH}`,
      description: DESCRIPTION,
      inLanguage: "en-US",
      genre: ["Puzzle", "Word game", "Sports"],
      gamePlatform: "Web browser",
      numberOfPlayers: { "@type": "QuantitativeValue", value: 1 },
      isAccessibleForFree: true,
      publisher: { "@type": "Organization", name: "Sideline Brew", url: SITE },
      about: { "@type": "SportsOrganization", name: "National Football League", alternateName: "NFL" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}${PATH}#faq`,
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE}${PATH}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Sideline Brew", item: SITE },
        { "@type": "ListItem", position: 2, name: "NFL Nameplate", item: `${SITE}${PATH}` },
      ],
    },
  ],
};

export default function NflNameplatePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Below the game, inside its column, so a phone reaches it by
          scrolling past the board rather than never. */}
      <NameplateGame below={<NameplateAbout />} />
    </>
  );
}
