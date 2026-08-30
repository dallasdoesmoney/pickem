import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly Pick'em - Sideline Brew",
  description: "Pick the winner of every NFL game, every week. Lock one for a bonus, and see how you did when the results land.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "Weekly Pick'em",
    description: "Pick the winner of every NFL game, every week.",
    url: "/weekly",
  },
  twitter: { card: "summary_large_image", title: "Weekly Pick'em" },
};

export default function WeeklyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
