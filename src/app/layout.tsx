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
        <svg aria-hidden="true" className="fixed inset-0 -z-10 h-full w-full opacity-60">
          <pattern
            id="press-backdrop"
            width="300"
            height="300"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <image href="/press-logo.png" xlinkHref="/press-logo.png" x="50" y="50" width="200" height="200" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#press-backdrop)" />
        </svg>
        {children}
      </body>
    </html>
  );
}
