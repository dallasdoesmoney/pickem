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

## 2 · Search surface  ·  ~1h

- [ ] `src/app/sitemap.ts` — `/`, `/daily`, `/weekly`, `/predictor`,
      `/leaderboard`, `/tier-lists`, and the seven template routes:
      `nfl-teams`, `nfl-quarterbacks`, `nfl-running-backs`, `nfl-wide-receivers`,
      `nfl-tight-ends`, `nfl-kickers`, `nfl-head-coaches`. Read them from
      `tierTemplates.ts` rather than retyping them, so a new template appears on
      its own.
- [ ] `src/app/robots.ts` — allow, point at the sitemap, disallow `/admin`,
      `/account`, `/notifications`, `/reset-password`, `/unsubscribe`.
      Leave the tier list share codes alone; they set their own `noindex`
      deliberately and that is correct.
- [ ] Route layouts with metadata for `/leaderboard`, `/weekly`, `/predictor`,
      `/tier-lists/[list]`. They are client components, so metadata has to live
      in a `layout.tsx` — `src/app/daily/layout.tsx` is the working example.

## 3 · The 45 setState errors, and the demo routes  ·  ~2h

- [ ] Work `npx eslint src` down to zero, in small batches, running the suites
      between them. Each one is a cascading render: React commits, the effect
      fires, state changes, React commits again. Some are only waste; a few are
      the shape of a real bug, where a value is read one render before it is
      correct.
- [ ] Delete `src/app/animation-demo/`, `src/app/qb-chip-demo/` (and its
      `layout.tsx`), `src/app/texture-demo/`. Unlinked, crawlable, and three of
      eighteen routes.
- [ ] Remove the CI lint downgrade from item 1. **This is what makes item 1
      finished**, so do not skip it.

## 4 · The creator profile  ·  ~2h

- [ ] Split `src/app/leaderboard/[username]/page.tsx` — currently `"use client"`
      — into a server component that fetches the row, plus a
      `ProfileClient.tsx` for the interactive parts (follow button, modals).
- [ ] `generateMetadata` on the server page: display name, rank and record in
      the title and description, and a canonical URL.
- [ ] `src/app/leaderboard/[username]/opengraph-image.tsx` — avatar, name,
      rank, streak. `src/lib/shareImage.ts` and `src/lib/tierShareImage.ts` are
      the existing craft to draw on.
- [ ] Verify with a Playwright pass that the HTML contains the name and the
      meta tags **before** any JavaScript runs. That is the whole point, and it
      is the one thing a screenshot cannot show.

If the card layout is genuinely ambiguous, build the plainest honest version
and flag it. Do not stall the queue on a taste question.

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
