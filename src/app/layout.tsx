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
import { JsonLd } from "@/components/JsonLd";
import { SITE_JSON_LD } from "@/lib/structuredData";

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
  title: "Sideline Brew",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Who this site is, in the one form a search engine reads
            directly. See src/lib/structuredData.ts - the short version is
            that "Sideline Brew" reads like a coffee shop, and nothing on
            the site told an engine otherwise. */}
        <JsonLd data={SITE_JSON_LD} />
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
