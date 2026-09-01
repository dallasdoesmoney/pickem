import type { Metadata } from "next";
import { Geist, Geist_Mono, Bungee, Fredoka } from "next/font/google";
import { NavShell } from "@/components/NavShell";
import { UsernameGate } from "@/components/UsernameGate";
import { AvatarPromptGate } from "@/components/AvatarPromptGate";
import { FollowRecsGate } from "@/components/FollowRecsGate";
import { ReferralPromptGate } from "@/components/ReferralPromptGate";
import { ChunkReload } from "@/components/ChunkReload";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: "400",
});

// The daily games' face. Rounded and friendly where Geist is neutral -
// the sticker board is meant to read as a toy, and the type is half of
// that. Scoped to the games rather than made the site's body face.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Everything below openGraph is new, and it is the reason a shared link
// used to paste as a bare URL: there were no card tags on this site at
// all, so nothing - not a result, not an invite - had anything to unfurl
// into. metadataBase is what turns "/og-default.png" into the absolute
// URL every scraper requires; without it Next emits a relative path and
// the card silently comes back blank.
const SITE = "https://sidelinebrew.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // A template rather than a bare string, so a page that sets its own
  // title gets the brand appended without every route remembering to.
  // `default` is what the home page and anything untitled falls back to.
  //
  // The page's own name comes FIRST and the brand second, because a
  // title is truncated from the right and a phone shows about the first
  // sixty characters: leading with "Sideline Brew" spends the visible
  // half of every result on the one word the searcher already has.
  title: {
    default: "Sideline Brew - NFL Pick'em, Tier Lists and the NFL Nameplate Daily Game",
    template: "%s | Sideline Brew",
  },
  description: "Picks, tier lists and a daily game. Pick the winner of every NFL game, every week.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "Sideline Brew",
    description: "Picks, tier lists and a daily game.",
    url: SITE,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Sideline Brew" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sideline Brew",
    description: "Picks, tier lists and a daily game.",
    images: ["/og-default.png"],
  },
};

// WHO THIS SITE IS, said once, on every page.
//
// The site had no structured data at all, which means every search
// engine has been inferring "Sideline Brew" is a brand from the words on
// the page and nothing else. This is the machine-readable version:
// Organization for the name and the logo, WebSite so the name attaches
// to the domain, and `hasPart` so the daily game is a named entity in
// its own right rather than one of forty URLs. The game's own page says
// far more about itself; this is what makes it findable from the root.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}#org`,
      name: "Sideline Brew",
      url: SITE,
      logo: `${SITE}/press-logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}#website`,
      name: "Sideline Brew",
      url: SITE,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE}#org` },
      hasPart: {
        "@type": "Game",
        "@id": `${SITE}/nfl-nameplate#game`,
        name: "NFL Nameplate",
        url: `${SITE}/nfl-nameplate`,
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <svg aria-hidden="true" className="fixed inset-0 -z-10 h-full w-full opacity-20">
          {/*
            Brick-style stagger: each pattern tile holds two logos, one at
            the normal spot and one offset by half a tile in both axes, so
            adjacent columns (post-rotation, adjacent diagonals) fall
            out of phase with each other and only every OTHER column
            lines up. The three extra copies of the offset logo are
            wraparound duplicates - <pattern> clips to its own tile, so
            without them the offset logo would be cut off at the tile
            edges instead of continuing seamlessly into the next tile.
          */}
          <pattern
            id="press-backdrop"
            width="500"
            height="500"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="140" y="140" width="220" height="220" />
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="390" y="390" width="220" height="220" />
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="-110" y="390" width="220" height="220" />
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="390" y="-110" width="220" height="220" />
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="-110" y="-110" width="220" height="220" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#press-backdrop)" />
        </svg>
        {/* Outside AuthProvider on purpose: a chunk failure can happen
            before any provider has mounted, and this has to be listening
            by then. It renders nothing. */}
        <ChunkReload />
        <AuthProvider>
          <NavShell>{children}</NavShell>
          <UsernameGate />
          <AvatarPromptGate />
          <FollowRecsGate />
          <ReferralPromptGate />
        </AuthProvider>
      </body>
    </html>
  );
}
