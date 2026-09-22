# AgriBid - Status

**This is the live source of truth for what is done, in progress, and next.** Read it at the start of every session (human or agent) and update it in the same PR as the work it describes. Full history is in [`CHANGELOG.md`](./CHANGELOG.md), lessons in [`LESSONS.md`](./LESSONS.md), decisions in [`decisions/`](./decisions/), detailed plans in `conductor/tracks/`.

Last updated: 2026-09-21

## How to keep this file useful

- **Starting work:** move the item from _Next_ to _In progress_, add the branch name and one line on scope, and link its track in `conductor/tracks/` if it has one.
- **Finishing work:** move it to _Done_ with the date and PR number. Keep only the last ~10 items here; older ones live in `CHANGELOG.md`.
- **Non-obvious lesson or real choice:** add a line to `LESSONS.md` or an ADR to `decisions/` instead of writing it here.
- **Unanswered product questions** go under _Open questions_, tagged with which item they block. Do not guess silently.
- One line per item; link to a track, issue or PR instead of copying detail.

## In progress

- Branch `feat/marketplace-auction-cards`: `/` shows auction-event cards with Active/Closed/All tabs (search still returns lots); `/auctions/:id` reuses the full lot browser scoped via `getActiveLots(auctionId)`.
- PR #330 `docs/restructure-docs`: one home per kind of information. Adds CHANGELOG, LESSONS, decisions, architecture overview, product docs; slims `AGENTS.md`; retires `Brief.md`, `Checklist.md`, `codebase_notes.md` and most of `conductor/` (originals kept in `docs/archive/`).
- Dependabot PRs #324-#328 (radix slot/accordion, @types/node, jest-dom, convex-test): open, unreviewed.

## Next (prioritised)

1. Bump `@convex-dev/aggregate` 0.2.1 -> 0.3.x and run the `explicit-ids` codemod. Verify first whether the component is registered (issue #308).
2. Review the open dependabot PRs.
3. Add an ESLint override disabling `consistent-type-definitions` for `convex/**` (recorded as pending in the old notes).
4. Clear merged remote branches.
5. Decide the open questions below, then tidy `AGENTS.md` accordingly.

## Done (last 10)

- 2026-09-21: STATUS.md added and stale auth docs fixed (#329); finished `refactor_auction_mutations` track archived (#323).
- 2026-09-19: Fix prod crash from manual vendor-react chunk grouping (#322).
- 2026-09: Multi-lot auctions rework finished (#318, #321).
- 2026-09: Dev server served over HTTPS with a Tailscale-issued cert (#320).
- 2026-09: Convex upgraded to 1.45.
- Older items: see [`CHANGELOG.md`](./CHANGELOG.md).

## Operations

Package manager is bun. Run before opening a PR: `bun run lint`, `bun run test --run`, `bun run type-check`, `bun run build`. Full command list: `AGENTS.md` (Quick reference).

- Dev server: `bun run dev` (HTTPS, cert in git-ignored `certs/`; regeneration in `AGENTS.md`)
- Convex backend: `bunx convex dev`
- Seed data: `bunx convex run seed`
- Deploy: Vercel; build command `bunx convex deploy --cmd 'bun run build'`
- Showcase bootstrap needs `seed.weeklyReset` run once when there are no Clerk sign-ins.

## Open questions

- Is `@convex-dev/aggregate` registered and used at all? Blocks _Next_ 1 (issue #308).
- Is `bunx coderabbit` still part of the flow? `AGENTS.md` requires it, but the husky hook does not run it, and the old notes say the documented CLI syntax is outdated.
- `AGENTS.md` says "DO NOT RUN `bun run test`" but the `test` script is already `vitest run`, and the README says to use `bun run test`. Which is right?
- Why was Clerk chosen over Better Auth? Not recorded anywhere (see ADR 0001).
- `phoneVerified`, `bankingVerified` and `taxNumberVerified` have no write path yet (OTP, payments or a manual admin process are undecided).
- Should `AGENTS.md` keep the Tailscale/Clerk-origin notes, or should they move to an operations doc?
