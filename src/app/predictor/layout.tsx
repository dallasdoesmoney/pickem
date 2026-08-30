import type { Metadata } from "next";

// Covers /predictor AND every /predictor/[team] beneath it, except where a
// team page overrides the title with its own generateMetadata - which it
// does, because "Chiefs record predictor" is the search this route is for.
export const metadata: Metadata = {
  title: "Record Predictor - Sideline Brew",
  description: "Call every game on an NFL team's schedule and see the record you just gave them.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "NFL Record Predictor",
    description: "Call every game on a team's schedule and see the record you just gave them.",
    url: "/predictor",
  },
  twitter: { card: "summary_large_image", title: "NFL Record Predictor" },
};

export default function PredictorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
