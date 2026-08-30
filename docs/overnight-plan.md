# Overnight plan

State for an unattended `/loop` run. **The loop reads this file, does the next
unchecked item, and ticks it off.** State lives here rather than in the
conversation because a long run gets summarized and detail is lost; a file does
not forget.

## Rules for the loop

1. **Never merge to `main`.** Dallas reviews in the morning. A deploy nobody
   watched is the thing this whole plan exists to prevent.
2. **One branch, one PR** — `claude/mobile-pill-sizing-86dtgh`, his decision.
   Five commits on it, one per item, and the PR body updated as each lands so
   it reads as a list of what is done rather than a wall at the end.
3. **Everything green before the commit**: `npx tsc --noEmit`,
   `npx eslint src scripts`, `npm run build`, and every suite against a dev
   server. If a suite fails, fix it before moving on — do not tick the item.
4. **One item per commit**, with the reasoning in the message.
5. **If an item needs a decision only Dallas can make** — a product call, a
   secret, a visual direction — mark it `BLOCKED` with the exact question and
   move on. Do not guess and build something he did not ask for.
6. **Do not run migrations.** There is no way to reach the database from here.

---

## 1 · CI that gates production  ·  ~1h  ·  DONE

Two things will break this on its first run, both found before starting:

- **`scripts/mobile-run.test.mjs:375` writes a screenshot to a hard-coded
  path** under a local scratchpad directory that does not exist on a runner.
- **`scripts/sync-results.test.mjs` has no npm script.** It is on disk and has
  most likely never run. CI must not "pass" by quietly skipping it.

Steps:

- [x] `package.json`: add `playwright` to devDependencies — the suites
      `import("playwright")` in a try/catch and **exit 1 with a hint if it is
      missing**, so a runner without it would fail loudly, but nothing declares
      it. Add `test:results` for the orphan, and a `test:all` that runs the two
      node-only suites then the six browser ones.
- [x] Replace the hard-coded screenshot path with
      `process.env.SHOT_DIR ?? "artifacts"`, and `mkdir -p` it. Add
      `artifacts/` to `.gitignore`.
- [x] `.github/workflows/ci.yml`, on `pull_request` and `push` to `main`:
      checkout, node 20, `npm ci`, `npx playwright install --with-deps chromium`,
      `npx tsc --noEmit`, `npm run build`, start `next dev` in the background
      with the placeholder Supabase env the suites already expect, wait for
      `:3000`, then `npm run test:all`. Upload `artifacts/` on failure.
- [x] **Lint is the one wrinkle.** `eslint src` currently reports 48 errors, 45
      of them one rule, so a blocking lint step fails on day one. Run it
      blocking with that single rule downgraded to `warn` **in the CI config
      only**, and leave a comment saying item 3 removes the downgrade. Do not
      use `continue-on-error` — a step that always passes is not a check.
- [x] Note in the PR that making the check **required** on `main` is a repo
      setting only Dallas can flip.

**Both first-run blockers were real and are fixed.** Verified by running the
workflow's exact sequence locally end to end: typecheck clean, CI lint 0
errors, build compiled, app up in 2s, `test:all` exit 0 across 70 checks, and
the screenshot landing in the gitignored `artifacts/`.

Three errors that were NOT the setState rule turned up while wiring the lint
step - unescaped apostrophes in LevelsAchievementsModal and MyReferralsModal.
Fixed rather than exempted, so the lint step is genuinely green from day one
rather than green by carve-out.

Left for Dallas: making the check **required** on `main` is a repo setting
only he can flip. Settings -> Branches -> add a rule for `main` -> require
status checks -> `check`.

## 2 · Search surface  ·  ~1h  ·  DONE

- [x] `src/app/sitemap.ts` — `/`, `/daily`, `/weekly`, `/predictor`,
      `/leaderboard`, `/tier-lists`, and the seven template routes:
      `nfl-teams`, `nfl-quarterbacks`, `nfl-running-backs`, `nfl-wide-receivers`,
      `nfl-tight-ends`, `nfl-kickers`, `nfl-head-coaches`. Read them from
      `tierTemplates.ts` rather than retyping them, so a new template appears on
      its own.
- [x] `src/app/robots.ts` — allow, point at the sitemap, disallow `/admin`,
      `/account`, `/notifications`, `/reset-password`, `/unsubscribe`.
      Leave the tier list share codes alone; they set their own `noindex`
      deliberately and that is correct.
- [x] Route layouts with metadata for `/leaderboard`, `/weekly`, `/predictor`,
      `/tier-lists/[list]`. They are client components, so metadata has to live
      in a `layout.tsx` — `src/app/daily/layout.tsx` is the working example.

**44 URLs**: 6 fixed, 6 tier lists, 32 team pages. Verified against a real
build — sitemap.xml and robots.txt both serve, and every route's `<title>`
renders server-side ("Kansas City Chiefs Record Predictor", "NFL Quarterbacks
Tier List").

**Two things turned up that were not in the plan.**

The tier list routes carried `robots: index:false` from a soft launch, and both
files said to drop it "when the nav entry goes in". The nav entry is in
NavShell.tsx line 44. The condition their own comments named had been met, so
the noindex came off — it was the difference between a sitemap covering 44
pages and one covering 6. **One line each to put back if Dallas disagrees**;
nothing is live until he merges.

`nfl-head-coaches` is correctly absent: `HEAD_COACHES` is empty in this
checkout, so `TIER_TEMPLATES` does not register it, and the sitemap reads the
same constant `generateStaticParams` does. The two cannot disagree. Worth
knowing separately that `/tier-lists/nfl-head-coaches` answers 200 rather than
404 in dev — pre-existing, not advertised anywhere, and not this item's job.

## 3 · The 45 setState errors, and the demo routes  ·  ~2h  ·  DONE

- [x] Work `npx eslint src` down to zero, in small batches, running the suites
      between them. Each one is a cascading render: React commits, the effect
      fires, state changes, React commits again. Some are only waste; a few are
      the shape of a real bug, where a value is read one render before it is
      correct.
- [x] Delete `src/app/animation-demo/`, `src/app/qb-chip-demo/` (and its
      `layout.tsx`), `src/app/texture-demo/`. Unlinked, crawlable, and three of
      eighteen routes.
- [x] Remove the CI lint downgrade from item 1. **This is what makes item 1
      finished**, so do not skip it.

**48 errors to 0.** `eslint.config.ci.mjs` is deleted and the CI lint step is
plain `npx eslint src scripts`, so item 1 is now genuinely finished: every rule
blocks, with no carve-out.

Four patterns did the work, in rough order of how often they applied:

1. **Key the held value by what it belongs to**, and decide at render.
   `results` in the admin screen and in `/weekly` is now `{ week, map }`;
   `picks`, `progress`, `myRecord` and the saved tier lists are keyed by
   `userId`. The effect that used to clear them ran one commit LATE, and that
   commit is a real one: the admin screen enabled its winner buttons while the
   map was still last week's, and `/weekly` counted last week's results against
   this week's games for a frame.
2. **React's documented "adjust state during render"** — compare against the
   previous value, set during render, React re-runs without committing — for
   the eleven-field reset in LevelsAchievementsModal and for `useSignInModal`.
   Reopening the Levels modal showed the previous account's numbers for a frame
   before the reset landed.
3. **Derive instead of storing.** `savedAt` in the tier list editor became
   `state === savedSnapshot`, which is what "SAVED" always meant. The toast
   `current` became `checkInToast ?? queue[0]`, removing the pump effect and
   with it the empty render between one toast and the next.
4. **Delete the write.** `FollowRecsGate` cleared a value that a guard three
   lines down already covered.

**One `eslint-disable` remains, in the whole codebase**, on the tier list
editor's resume-after-OAuth save. The rule follows a call into an async
function and finds a setState there, but it does not model `await` — verified
with a scratch component: `void go()` where `go` awaits a fetch before its
setState is flagged, while the same setState inside a `.then` is not. Every
setState in `doSave` lands after the round trip to `saveTierList`, so it is a
network callback and not the cascading render the rule is looking for. It is
labelled as a false positive rather than as an exemption.

**Nothing referenced the three demo routes** but Next's own build manifests -
grepped before deleting. Eighteen routes down to fifteen.

Verified end to end after the last batch: typecheck clean, `eslint src scripts`
0 errors (83 `<img>` warnings, all pre-existing), build compiled, all eight
suites green against a dev server, and every page whose state handling changed
loaded with a clean console.

## 4 · The creator profile  ·  ~2h  ·  DONE

- [x] Split `src/app/leaderboard/[username]/page.tsx` — currently `"use client"`
      — into a server component that fetches the row, plus a
      `ProfileClient.tsx` for the interactive parts (follow button, modals).
- [x] `generateMetadata` on the server page: display name, rank and record in
      the title and description, and a canonical URL.
- [x] `src/app/leaderboard/[username]/opengraph-image.tsx` — avatar, name,
      rank, streak. `src/lib/shareImage.ts` and `src/lib/tierShareImage.ts` are
      the existing craft to draw on.
- [x] Verify with a Playwright pass that the HTML contains the name and the
      meta tags **before** any JavaScript runs. That is the whole point, and it
      is the one thing a screenshot cannot show.

A shared profile link now unfurls as that player:
`Ripcord Randall (@ripcord_randall) - Sideline Brew`, described as
`#4 on the leaderboard · 40-22 on picks · Role Player V · 7 day streak`, with a
card drawn for them rather than `/og-default.png`.

**The verification found a real bug that nothing else would have.** The split
alone was not enough: `src/app/leaderboard/loading.tsx` covered the whole
segment, and a `loading.tsx` is a Suspense boundary — so the first bytes of a
profile were still a spinner, with the player hidden behind it until
JavaScript ran. Exactly the thing the split was for. The fix is a route group,
`(index)/`, which is URL-transparent: `/leaderboard` still has its loading
state, `/leaderboard/[username]` no longer sits inside it. Confirmed by loading
the page in a browser **with JavaScript disabled** and finding the name and the
handle on screen.

**Four supporting pieces, each with a reason:**

- `src/lib/supabase/server.ts` — the first server-side reader in the codebase.
  Per-call, holds no session, same ANON key, so RLS still applies. Not a
  service-role client and must never become one.
- Rank is a COUNT of who is ahead, not an index into the whole board — same
  three sort keys as `leaderboard.ts`, so the number and the board cannot
  disagree, and it does not fetch forty thousand rows to number one of them.
- `not-found.tsx` and `error.tsx`. The old page answered 200 with "no player
  found", which told crawlers every misspelling was a real page; it is a real
  404 now. And a server page that throws gets the framework's error screen,
  which this app did not have — a Supabase outage is still a 500, but it says
  so in the site's own voice with a retry.
- The two fonts are vendored under `assets/` and named in
  `outputFileTracingIncludes`. File tracing follows imports, and a `readFile`
  is not an import: without that line the fonts are absent from the deployed
  bundle and every card 500s in production while working perfectly locally.

`scripts/profile-ssr.test.mjs` — 24 checks — is the only suite that starts its
own dev server. It has to: what it tests happens inside the Next process,
where Playwright's request router cannot reach, so Supabase is stubbed by a
real HTTP server (`scripts/lib/leaderboardStub.mjs`) and the app is started
pointed at it. `distDir` is now settable by env so its server and a normal
`npm run dev` do not fight over the dev lock.

**Left for Dallas: the card's look.** Both renders are in the commit's
description — a level-15 player and a fresh account. If the palette or the
proportions are wrong, `opengraph-image.tsx` is one file and nothing else
depends on it.

## 5 · Error monitoring  ·  ~45m

- [ ] Add `@sentry/nextjs`, initialised from `NEXT_PUBLIC_SENTRY_DSN`, **inert
      when the variable is absent** so nothing changes for anybody until Dallas
      adds it. `BLOCKED` on him for the DSN itself.
- [ ] Pass over every silent `catch` — the Nameplate stats fetch, the guest
      board number, the play-again focus — so each reports before it swallows.
      The swallow is right for the player; the silence is not right for us.

---

## Not in this queue, on purpose

**Push/PWA, the Today screen, friends on today's board, the creator gallery,
and the broad move to server rendering.**

Every one is a product decision as much as a build: what the notification says
and when it fires, what the Today screen leads with, what a friend can see
before they have played, what "publishing" a tier list means. Built
unattended, Dallas wakes up to a product somebody else designed. They are the
better features — they should be built with him awake, not instead of him.

Push also needs a VAPID keypair and Sentry needs a DSN; neither can be created
from here.
