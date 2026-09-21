# AgriBid - Status

**This is the live source of truth for what is done, in progress, and next.** Read it at the start of every session (human or agent) and update it in the same PR as the work it describes. `conductor/product.md` is the product map, `conductor/tracks/` holds per-feature plans; this file tracks reality against them.

Last updated: 2026-09-21

## How to keep this file useful

- **Starting work:** move the item from _Next_ to _In progress_, add the branch name and one line on scope.
- **Finishing work:** move it to _Done_ with the date and PR number, and record any decision that was not obvious under _Decisions_ (with the reason).
- **Unanswered product questions** go under _Open questions_, tagged with which item they block. Do not guess silently.
- **Keep entries short and specific.** Link to a track plan or PR instead of copying detail here.
- One line per item. If an item needs a page of notes, create a track under `conductor/tracks/` and link it.

## In progress

- PR #323 `chore/conductor-tracks-cleanup`: archive the finished `refactor_auction_mutations` track, fix `tracks.md` links.
- This PR `docs/status-md-and-conductor-cleanup`: add this file, reconcile AGENTS.md auth docs (BetterAuth -> Clerk), normalise archived track metadata.
- Dependabot PRs #324-#328 (radix slot/accordion, @types/node, jest-dom, convex-test): open, unreviewed.

## Next (prioritised)

_Seeded from what is visible in the repo; reprioritise as needed._

1. Bump `@convex-dev/aggregate` 0.2.1 -> 0.3.x and run the `explicit-ids` codemod. Plan: `conductor/opencode_tasks/convex-aggregate-and-codemod.md` (untracked). Verify first whether the aggregate component is actually registered (issue #308).
2. Review the open dependabot PRs (plan: `conductor/opencode_tasks/review-open-prs.md`, untracked).
3. Prune finished files from `conductor/opencode_tasks/` and decide what to do with the loose planning docs at the `conductor/` root.
4. Clear merged remote branches.

## Done

- 2026-09-19: Fix prod crash from manual vendor-react chunk grouping (#322).
- 2026-09: Multi-lot auctions rework finished (#318, #321).
- 2026-09: Dev server served over HTTPS with a Tailscale-issued cert (#320).
- Convex upgraded to 1.45 (`package.json` pins `^1.45.0`).
- Earlier tracks are listed in `conductor/tracks.md` under Archive.

## Operations

Package manager is bun. Run these before opening a PR: `bun run lint`, `bun run test --run`, `bun run type-check`, `bun run build`. The full command list is in `AGENTS.md` (Quick Reference).

- Dev server: `bun run dev` (HTTPS, cert in git-ignored `certs/`; see AGENTS.md for regeneration)
- Convex backend: `bunx convex dev`
- Seed data: `bunx convex run seed`
- Deploy: Vercel; build command `bunx convex deploy --cmd 'bun run build'`

## Decisions

- Auth is Clerk (JWT verified by Convex). AGENTS.md previously said BetterAuth; that was stale (see the discrepancy noted in `codebase_notes.md`).
- `conductor/tracks/` only holds active tracks; finished ones are moved to `conductor/archive/` and their `metadata.json` set to `completed`.

## Open questions

- Is `@convex-dev/aggregate` registered and used at all? Blocks _Next_ item 1 (issue #308).
- Is `bunx coderabbit` still part of the pre-commit flow? AGENTS.md and `conductor/workflow.md` require it, but the husky hook does not run it.
- `AGENTS.md` says "DO NOT RUN `bun run test`" but the `test` script is already `vitest run`, and the README tells contributors to use `bun run test`. Which is right?
