# AgriBid - Status

**This is the live source of truth for what is done, in progress, and next.** Read it at the start of every session (human or agent) and update it in the same PR as the work it describes. Full history is in [`CHANGELOG.md`](./CHANGELOG.md), lessons in [`LESSONS.md`](./LESSONS.md), decisions in [`decisions/`](./decisions/), detailed plans in `conductor/tracks/`.

Last updated: 2026-10-03

## How to keep this file useful

- **Starting work:** move the item from _Next_ to _In progress_, add the branch name and one line on scope, and link its track in `conductor/tracks/` if it has one.
- **Finishing work:** move it to _Done_ with the date and PR number. Keep only the last ~10 items here; older ones live in `CHANGELOG.md`.
- **Non-obvious lesson or real choice:** add a line to `LESSONS.md` or an ADR to `decisions/` instead of writing it here.
- **Unanswered product questions** go under _Open questions_, tagged with which item they block. Do not guess silently.
- One line per item; link to a track, issue or PR instead of copying detail.

## In progress

- Branch `feat/marketplace-auction-cards`: `/` shows auction-event cards with Active/Closed/All tabs (search still returns lots); `/auctions/:id` reuses the full lot browser scoped via `getActiveLots(auctionId)`.
- Same branch, storage-and-query cleanup: storage-aware seed/reset clears (`runSeed`/`clearAuctions`/`clearAllData`/`weeklyReset` now delete image/KYC/banner blobs), daily orphaned-upload sweep cron (`convex/storageCleanup.ts`), client-side image compression before upload (`src/lib/image-resize.ts` + `useFileUpload`), `getPublishedAuctions` paginated with capped takes + manual cursor (consumed via `usePaginatedQuery` on Home/AuctionGallery), and 500-cap safety caps on admin `.collect()` queues.
- Same branch, admin Performance & Demo Mode settings: runtime-editable `demo_mode_enabled` + `presence_heartbeat_interval_ms` settings keys (atomic `updatePerformanceConfig` mutation), public `presence.getHeartbeatIntervalMs` read, `PresenceListener` paces itself from it (60s fallback while loading), `AdminPerformance` page at `/admin/performance` + System Settings tile; cron schedules stay code-fixed (stated in the UI copy). Presence 90s online threshold intentionally not yet derived from the interval (see `convex/constants.ts` note).
- Same branch, review follow-ups: moderation queue badges now disclose capped results, public event status buckets retain newest rows before their cap, storage cleanup scans an overlapping creation-time window, image resizing is limited to two concurrent jobs, and Performance settings copy reflects current behaviour.
- PR #330 `docs/restructure-docs`: one home per kind of information. Adds CHANGELOG, LESSONS, decisions, architecture overview, product docs; slims `AGENTS.md`; retires `Brief.md`, `Checklist.md`, `codebase_notes.md` and most of `conductor/` (originals kept in `docs/archive/`).
- Dependabot PRs #324-#328 (radix slot/accordion, @types/node, jest-dom, convex-test): open, unreviewed.

## Next (prioritised)

1. Bump `@convex-dev/aggregate` 0.2.1 -> 0.3.x and run the `explicit-ids` codemod. Verify first whether the component is registered (issue #308).
2. Review the open dependabot PRs.
3. Add an ESLint override disabling `consistent-type-definitions` for `convex/**` (recorded as pending in the old notes).
4. Clear merged remote branches.
5. Decide the open questions below, then tidy `AGENTS.md` accordingly.

## Done (last 10)

- 2026-10-03: Admin audit skeleton, category empty state, tooltips, wizard/search/bid-form polish (#343) (v0.17.13).
- 2026-10-03: Format the finance fee tooltip amount with formatCurrency (other call sites already used the shared helper) (#301) (v0.17.12).
- 2026-10-03: Add regression tests for auction startTime enforcement (already enforced; stale issue) (#296) (v0.17.11).
- 2026-10-03: Derive presence threshold from heartbeat interval, fix flag counter race, add audit logging, show cooldown seconds (#338) (v0.17.10).
- 2026-10-03: Filter Home status tabs server-side and scope the time tick (#339) (v0.17.9).
- 2026-10-03: Use shadcn Checkbox and AlertDialog, remove eslint-disable in BidForm (#342) (v0.17.8).
- 2026-10-03: Add per-route error boundaries (#341) (v0.17.7).
- 2026-10-03: Paginate support tickets and use shared pagination constants (#340) (v0.17.6).
- 2026-10-03: Noindex private pages, dev-safe site URL fallback, toast on mark-read failure (#344) (v0.17.5).
- 2026-10-03: Add catch-all 404 route and NotFound page (#306) (v0.17.4).
- 2026-10-03: Reconcile stale docs: fix app/ paths, regenerate schema reference, correct test command (#307) (v0.17.3).
- 2026-10-03: Tablet/phone layout polish on auctions, lots and lot-detail pages (wrapping/overflow fixes via container queries, tighter spacing, sticky bid bar hides over panel/footer) (v0.17.2).
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
