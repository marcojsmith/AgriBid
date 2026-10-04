# AgriBid - Status

**This is the live source of truth for what is done, in progress, and next.** Read it at the start of every session (human or agent) and update it in the same PR as the work it describes. Full history is in [`CHANGELOG.md`](./CHANGELOG.md), lessons in [`LESSONS.md`](./LESSONS.md), decisions in [`decisions/`](./decisions/), detailed plans in `conductor/tracks/`.

Last updated: 2026-10-04

## How to keep this file useful

- **Starting work:** move the item from _Next_ to _In progress_, add the branch name and one line on scope, and link its track in `conductor/tracks/` if it has one.
- **Finishing work:** move it to _Done_ with the date and PR number. Keep only the last ~10 items here; older ones live in `CHANGELOG.md`.
- **Non-obvious lesson or real choice:** add a line to `LESSONS.md` or an ADR to `decisions/` instead of writing it here.
- **Unanswered product questions** go under _Open questions_, tagged with which item they block. Do not guess silently.
- One line per item; link to a track, issue or PR instead of copying detail.

## In progress

- Stacked PRs #345 -> #373 (audit follow-ups: docs, 404, SEO, pagination, error boundaries, UI, security, performance, accessibility, coverage). Each PR bases on the previous; merging #373 merges them all.
- Branch `feat/marketplace-auction-cards`: `/` shows auction-event cards with Active/Closed/All tabs (search still returns lots); `/auctions/:id` reuses the full lot browser scoped via `getActiveLots(auctionId)`.
- Same branch, storage-and-query cleanup: storage-aware seed/reset clears (`runSeed`/`clearAuctions`/`clearAllData`/`weeklyReset` now delete image/KYC/banner blobs), daily orphaned-upload sweep cron (`convex/storageCleanup.ts`), client-side image compression before upload (`src/lib/image-resize.ts` + `useFileUpload`), `getPublishedAuctions` paginated with capped takes + manual cursor (consumed via `usePaginatedQuery` on Home/AuctionGallery), and 500-cap safety caps on admin `.collect()` queues.
- Same branch, admin Performance & Demo Mode settings: runtime-editable `demo_mode_enabled` + `presence_heartbeat_interval_ms` settings keys (atomic `updatePerformanceConfig` mutation), public `presence.getHeartbeatIntervalMs` read, `PresenceListener` paces itself from it (60s fallback while loading), `AdminPerformance` page at `/admin/performance` + System Settings tile; cron schedules stay code-fixed (stated in the UI copy). Presence 90s online threshold intentionally not yet derived from the interval (see `convex/constants.ts` note).
- Same branch, review follow-ups: moderation queue badges now disclose capped results, public event status buckets retain newest rows before their cap, storage cleanup scans an overlapping creation-time window, image resizing is limited to two concurrent jobs, and Performance settings copy reflects current behaviour.
- PR #330 `docs/restructure-docs`: one home per kind of information. Adds CHANGELOG, LESSONS, decisions, architecture overview, product docs; slims `AGENTS.md`; retires `Brief.md`, `Checklist.md`, `codebase_notes.md` and most of `conductor/` (originals kept in `docs/archive/`).
- Dependabot PRs #324-#328 (radix slot/accordion, @types/node, jest-dom, convex-test): open, unreviewed.

## Next (prioritised)

1. Merge the stacked PRs #345-#373 (merging #373 lands them all), then run `bunx convex run admin_utils:recomputeLotFeeCounters '{"cursor":null,"buyerTotal":0,"sellerTotal":0}'` against each deployment with existing fees.
2. Finish the partial issues: #302 (backend duplication: highest-bid reduce, cursor parsing, bidder-name lookup; large files such as FeeManager, MyBids, seed.ts), #303 (duplicate subscriptions, AdminAuctions re-renders), #304 (vitest-axe checks), #308 (Radix import strategy), #299 (Playwright E2E for the money paths).
3. Review the open dependabot PRs.
4. Add an ESLint override disabling `consistent-type-definitions` for `convex/**` (recorded as pending in the old notes).
5. Clear merged remote branches.
6. Decide the open questions below, then tidy `AGENTS.md` accordingly.

## Done (last 10)

- 2026-10-04: Coverage now measures unimported files and writes `test-coverage/latest-coverage-output.txt`; thresholds raised; broad unit-test additions (E2E still open) (#299) (v0.17.26).
- 2026-10-04: Cursor-based `getMyBids` pagination over a bidder/timestamp index (ending sort bounded to 200 lots) with integration tests (#335) (v0.17.25).
- 2026-10-04: Index-driven batched settlement, unified reserve check, fee-total counters (run `admin_utils:recomputeLotFeeCounters` once after deploy) (#305) (v0.17.24).
- 2026-10-04: Dedupe `useListingWizard` and split the Profile page into components (backend duplication and other 500+ line files still open) (#302) (v0.17.23).
- 2026-10-04: Drop unused autoprefixer/postcss/coverage-istanbul deps, add `engines`, align packageManager, ignore stale `app/` dir (Radix import strategy still open) (#308) (v0.17.22).
- 2026-10-04: Accessibility fixes: focus trap, table scope, label links, live regions, hidden decorative icons (#304) (v0.17.21).
- 2026-10-04: Split convex/errors.ts helpers into convex/lib modules (#282) (v0.17.20).
- 2026-10-04: Batch lot summary lookups, bound the storage sweep, add platformFees/equipmentMetadata indexes (#337) (v0.17.19).
- 2026-10-04: Paginate notifications with bounded per-stream reads and a compound cursor (#336) (v0.17.18).
- 2026-10-03: Replace hardcoded palette classes with theme tokens and add a guard test (#300) (v0.17.17).
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
