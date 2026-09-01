import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // THE GAME MOVED, and this is what makes that free.
      //
      // /daily is on every result anybody has ever shared, in the play
      // button of the announcement emails, and in Google's index. A
      // permanent redirect is what hands all of that to the new URL -
      // 308 rather than 301 so the method survives, which matters for
      // nothing here today and costs nothing either.
      //
      // WHEN THE SECOND DAILY GAME ARRIVES this entry comes out and
      // /daily becomes the menu it was always named for. Replacing a
      // redirect with a real page is a normal thing to do and search
      // engines cope with it; what they do not cope with is a URL that
      // used to be a game and is now a 404.
      { source: "/daily", destination: "/nfl-nameplate", permanent: true },
    ];
  },
};

export default nextConfig;
