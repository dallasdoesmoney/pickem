import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second `next dev` in the same project is refused - the lock lives
  // under distDir, so one project means one dev server.
  //
  // scripts/profile-ssr.test.mjs needs its own. It is the only suite
  // whose subject is what the SERVER sends rather than what the browser
  // does with it, so it cannot share the dev server CI already has
  // running: it has to start the app pointed at its own Supabase stub,
  // because the fetch it is testing happens in the Next process where
  // Playwright's request router cannot reach.
  //
  // Its own distDir gives it its own lock and its own build output, and
  // leaves plain `npm run dev` exactly as it was.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // The profile OG card reads two font files off disk at module load.
  // File tracing follows imports, and a readFile of a path built at
  // runtime is not an import - so without this the fonts are simply not
  // in the deployed bundle and every profile card 500s in production
  // while working perfectly here.
  outputFileTracingIncludes: {
    "/leaderboard/[username]/opengraph-image": ["./assets/fonts/**"],
  },
};

export default nextConfig;
