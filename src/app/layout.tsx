import type { Metadata } from "next";
import { Geist, Geist_Mono, Bungee } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Pickem",
  description: "Pick the winner of every NFL game, every week.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
        {children}
      </body>
    </html>
  );
}
