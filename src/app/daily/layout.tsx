import { Metadata } from "next";

// The daily game's own card, and the only reason this file exists: a
// result is shared far more often than the site is, so the link a result
// carries should unfurl as the GAME rather than as the home page. Its
// page.tsx is a client component and cannot export metadata, so the
// route's layout carries it instead.
//
// Absolute URLs come from metadataBase in the root layout.
export const metadata: Metadata = {
  title: "Nameplate - Sideline Brew",
  description: "One mystery player a day. Eight guesses. Same player for everyone.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "Nameplate",
    description: "One mystery player a day. Eight guesses. Same player for everyone.",
    url: "/daily",
    images: [{ url: "/og-daily.png", width: 1200, height: 630, alt: "Nameplate - the Sideline Brew daily game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nameplate",
    description: "One mystery player a day. Eight guesses. Same player for everyone.",
    images: ["/og-daily.png"],
  },
};

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
