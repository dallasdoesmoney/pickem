import type { Metadata } from "next";

// Temporary demo route - kept out of search while it exists.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
