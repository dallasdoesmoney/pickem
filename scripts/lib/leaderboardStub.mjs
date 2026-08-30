import { createServer } from "node:http";

// A PostgREST stand-in, just wide enough for the leaderboard view.
//
// The profile page is the first thing in this codebase that reads the
// database FROM THE SERVER, which means Playwright's request router -
// what every other suite stubs Supabase with - cannot see it: that
// intercepts the browser, and this fetch happens in the Next process
// before a browser is involved. So the stub has to be a real server, and
// NEXT_PUBLIC_SUPABASE_URL has to point at it.
//
// Only what the two queries in src/lib/supabase/server.ts actually send:
// a single row by username, and an exact count of the rows ahead of it.
export function startLeaderboardStub(rows) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const accept = req.headers.accept ?? "";
    const prefer = req.headers.prefer ?? "";

    if (!url.pathname.startsWith("/rest/v1/leaderboard")) {
      res.writeHead(404).end("[]");
      return;
    }

    // The rank query: an exact count with no body. The `or` filter is not
    // re-implemented - the suite passes the answer it expects in as
    // `rankAhead`, because what is under test is the page, not PostgREST.
    if (prefer.includes("count=exact")) {
      const ahead = Number(url.searchParams.get("__ahead") ?? server.rankAhead ?? 0);
      res.writeHead(200, {
        "content-type": "application/json",
        "content-range": `*/${ahead}`,
      });
      res.end(req.method === "HEAD" ? "" : "[]");
      return;
    }

    const eq = url.searchParams.get("username") ?? "";
    const username = eq.startsWith("eq.") ? eq.slice(3) : null;
    const row = rows.find((r) => r.username === username) ?? null;

    // maybeSingle asks for a single object. PostgREST answers 406 with
    // PGRST116 when there is no row, and supabase-js turns that into
    // {data: null, error: null} - which is exactly the "no such player"
    // the page branches on, so the stub has to answer the same way.
    if (accept.includes("vnd.pgrst.object+json")) {
      if (!row) {
        res.writeHead(406, { "content-type": "application/json" });
        res.end(JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/vnd.pgrst.object+json" });
      res.end(JSON.stringify(row));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(row ? [row] : []));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      server.rankAhead = 0;
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
        setRankAhead: (n) => {
          server.rankAhead = n;
        },
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
