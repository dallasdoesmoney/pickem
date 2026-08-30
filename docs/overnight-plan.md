# Overnight plan

State for an unattended `/loop` run. **The loop reads this file, does the next
unchecked item, and ticks it off.** State lives here rather than in the
conversation because a long run gets summarized and detail is lost; a file
does not forget.

## Rules for the loop

1. **Never merge to `main`.** Branch, implement, push, open or update a PR.
   Dallas reviews in the morning. A deploy that nobody watched is the thing
   this whole plan exists to prevent.
2. **Everything green before the commit**: `npx tsc --noEmit`, `npx eslint src scripts`,
   `npm run build`, and every `npm run test:*` suite against a dev server. If a
   suite fails, fix it before moving on — do not tick the item.
3. **One item per commit**, with the reasoning in the message.
4. **If an item needs a decision only Dallas can make** — a product call, a
   secret, a visual direction — mark it `BLOCKED` with the exact question and
   move to the next one. Do not guess and build something he did not ask for.
5. **Do not run migrations.** There is no way to reach the database from here.
   Write the SQL, leave it for him to run, and say so in the PR.

## The queue

### 1. CI that gates production
- [ ] `.github/workflows/ci.yml` — on pull_request and push to main.
      Install, `tsc --noEmit`, `eslint`, `next build`, then the six suites
      against a dev server. Add `playwright` as a devDependency — the suites
      currently import it optionally and silently exit if it is missing, which
      means CI would pass by doing nothing.
- [ ] Make the check required on `main` (needs a repo setting Dallas flips —
      note it in the PR).

**Do this first.** Every item below is safer once it exists, and it is hours
of work rather than days.

### 2. Search surface
- [ ] `src/app/sitemap.ts` — home, /daily, /leaderboard, /weekly, /predictor,
      /tier-lists and each tier list template route. Not the share codes; those
      are deliberately `noindex`.
- [ ] `src/app/robots.ts` — allow all, point at the sitemap, disallow /admin
      and /account.
- [ ] Per-route metadata for /leaderboard, /weekly, /predictor, /tier-lists/[list].
      `/daily` already has its own layout; copy that shape.

### 3. The 45 setState-in-effect errors, and the demo routes
- [ ] Work through `npx eslint src` — 45 of the 48 errors are one rule. Each is
      a cascading render. Fix in small batches, running the suites between them.
- [ ] Delete `/animation-demo`, `/qb-chip-demo`, `/texture-demo` and their
      layouts. Unlinked, crawlable, and three of eighteen routes.

Only after item 1 — these are mechanical edits across many files, which is
exactly the change a test suite should be watching.

### 4. The creator profile
- [ ] Convert `/leaderboard/[username]` to a server component that reads the
      profile server-side, with the interactive parts split into a client child.
- [ ] `generateMetadata` — their display name, rank and record in the title and
      description.
- [ ] `opengraph-image.tsx` — avatar, name, rank, streak. `shareImage.ts` and
      `tierShareImage.ts` are the existing craft to draw on.

The highest-ratio item on the review. It is also the one most likely to need a
judgment call about what the card should say — if the layout is genuinely
ambiguous, build the plainest honest version and flag it rather than stalling.

### 5. Error monitoring
- [ ] Add Sentry (or PostHog error tracking), initialised from
      `NEXT_PUBLIC_SENTRY_DSN`. **BLOCKED on Dallas for the DSN** — wire it so
      it is inert without the env var, and leave him one line to fill in.
- [ ] Pass over every silent `catch` — the stats fetch, the board number, the
      play-again focus — so each reports before it swallows. The swallow is
      correct for the player; the silence is not correct for us.

## Not in this queue, on purpose

**#1 push/PWA, #2 the Today screen, #3 friends on today's board, #5 the creator
gallery, #9 the broad move to server rendering.**

Every one of these is a product decision as much as a build: what the
notification says and when it fires, what the Today screen leads with, what a
friend can see before they have played, what "publishing" a tier list means.
Built unattended, Dallas wakes up to a product somebody else designed. They are
the better features — they should be built with him awake, not instead of him.

Push also needs a VAPID keypair, and Sentry needs a DSN. Neither can be created
from here.
