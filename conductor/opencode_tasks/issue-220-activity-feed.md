# Task: User activity feed system (GitHub issue #220)

## Context

- `src/pages/Profile.tsx` — `getActivityItems(role, createdAt)` (~line 116-144) is a
  pure function that fabricates 2-3 fake activity items from just `role`/`createdAt`
  (every item shows the same date). Called at ~line 365:
  `const activityItems = getActivityItems(sellerInfo.role, sellerInfo.createdAt);`.
  Rendered in the "Recent Activity" section around line 1000
  (`{activityItems.map((item) => (...`). The `ActivityItem` interface (~line 62-68)
  has `id`/`type`/`title`/`description`/`date` (a formatted string, not a timestamp).
- `convex/schema.ts` — no `userActivity` table exists yet.
- Mutations to instrument (verified against current code, not just the issue text):
  - `convex/users.ts`:
    - `syncUserHandler` (~line 94-133) — inserts a new `profiles` row only in the
      `!existingProfile` branch. Log `account_created` there, not on every sync call.
    - `submitKYCHandler` (~line 486-543) — always transitions `kycStatus` to
      `"pending"`. Log `verification_requested` here (every submission, not just the
      first — a rejected-then-resubmitted user should get a fresh activity entry).
    - `promoteToAdminHandler` (~line 431-463) — patches `role: "admin"`, but has an
      early `if (profile.role === "admin") return { success: true }` no-op guard —
      only log `role_changed` on the branch that actually patches, not the no-op.
  - `convex/admin/kyc.ts` — `reviewKYC` mutation (~line 60-165) is the **actual**
    approve/reject flow (not `verifyUserHandler` in `users.ts`, which is a separate,
    rarely-used manual-override path — check both but instrument `reviewKYC` as the
    primary one; instrumenting `verifyUserHandler` too is fine and low-risk if it's
    quick, but `reviewKYC` is the one that matters). Log
    `verification_approved`/`verification_rejected` in the respective branches,
    matching the existing pattern of inserting a `notifications` row right there —
    add the `userActivity` insert alongside it.
  - `convex/auctions/mutations/create.ts` — `createAuctionHandler` (~line 77-183)
    inserts the `auctions` row with `status` either `"draft"` or `"pending_review"`
    depending on `isDraft`. Log `listing_created` only when `status !==
"draft"` (a draft isn't a real "listing" event yet) — i.e. when the auction is
    actually submitted for review at creation time.
  - `convex/auctions/mutations/publish.ts` — `publishAuctionHandler` (~line 49-72,
    exported as both `submitForReview` and `publishAuction`) transitions
    `draft -> pending_review`. Log `listing_created` here too, for auctions that were
    saved as a draft first and submitted later (the two call sites are mutually
    exclusive per auction — a given auction only ever gets ONE `listing_created`
    entry, either at creation-as-non-draft or at later publish-from-draft; do not
    double-log by instrumenting both create-as-non-draft AND a later publish call for
    the same auction, since an auction that's created non-draft never goes through
    `publishAuctionHandler` again).
  - `convex/auctions/mutations/publish.ts` — `closeAuctionEarlyHandler` (~line
    370-460ish) and `convex/auctions/internal.ts` —
    `settleExpiredAuctionsHandler` (~line 125-193) are the two parallel paths where an
    auction transitions to `"sold"`/`"unsold"` with a `winnerId`. Both need: log
    `listing_sold` for the seller (`auction.sellerId`) when `finalStatus === "sold"`,
    and log `bid_won` for the winner (`winnerId`) when set. Since both handlers patch
    the same shape (`status`, `winnerId`, `settledAt`) in parallel, add the same two
    log calls to both — don't try to unify them into a shared helper unless it's a
    trivial, safe refactor (these handlers aren't identical enough to blindly merge;
    a shared `logAuctionSettlementActivity(ctx, auction, finalStatus, winnerId)`
    helper you call from both is fine and reduces duplication).
  - `convex/auctions/mutations/bidding.ts` — `placeBidHandler` (~line 18-56) calls
    `handleNewBid` and returns a result with `success`. Log `bid_placed` after a
    successful `handleNewBid` call, for the bidder (`userId`), with `relatedId:
args.auctionId`.
- `convex/admin_utils.ts` has `logAudit`/`updateCounter` helpers already — model the
  new `logActivity` helper's calling convention on `logAudit`'s (an internal async
  function you call directly from other mutations' handlers in the same transaction,
  not a separate `ctx.runMutation` round trip — see the Convex rules note on this).
- Only `convex/admin_debug.ts`'s `promoteToAdmin` is a **dev-only** promotion tool
  (bypasses admin check when `ALLOW_DEV_ADMIN_PROMOTION=true` in non-production) —
  do NOT instrument this one; only `convex/users.ts`'s `promoteToAdminHandler` (the
  real admin-only path) should log activity.

## Instructions

1. **Schema** — add `userActivity` to `convex/schema.ts`, exactly per the issue's
   proposal:

   ```typescript
   userActivity: defineTable({
     userId: v.string(),
     type: v.union(
       v.literal("account_created"),
       v.literal("verification_requested"),
       v.literal("verification_approved"),
       v.literal("verification_rejected"),
       v.literal("role_changed"),
       v.literal("listing_created"),
       v.literal("listing_sold"),
       v.literal("bid_placed"),
       v.literal("bid_won")
     ),
     description: v.optional(v.string()),
     relatedId: v.optional(v.string()),
     createdAt: v.number(),
   })
     .index("by_userId", ["userId"])
     .index("by_userId_createdAt", ["userId", "createdAt"]);
   ```

2. **`logActivity` helper** — add to `convex/users.ts` (or a new
   `convex/userActivity.ts` if that reads cleaner given this file's existing size;
   your call, but keep it consistent with how `logAudit` is organized in
   `convex/admin_utils.ts`) as a plain async function (not a registered
   `internalMutation` — it needs to run inside the same transaction as the calling
   mutation, exactly like `logAudit`/`updateCounter` already do):

   ```typescript
   async function logActivity(
     ctx: MutationCtx,
     args: {
       userId: string;
       type: /* the 9 literals above */;
       description?: string;
       relatedId?: string;
     }
   ): Promise<void> {
     await ctx.db.insert("userActivity", { ...args, createdAt: Date.now() });
   }
   ```

   (The issue's proposal calls this an `internalMutation` — don't do that; per the
   Convex rules constraint "use as few calls from actions to queries/mutations as
   possible" and to avoid the extra round trip / transaction-boundary risk, a
   same-transaction helper function is correct here, matching this codebase's
   existing `logAudit` convention.)

3. **Instrument the 7 call sites** listed in Context, each with a short, specific
   `description` (e.g. "Account created", "Identity documents submitted for review",
   "Verification approved", "Verification rejected: <reason>", "Promoted to admin",
   "Listing created: <title>", "Listing sold for R<amount>", "Bid placed: R<amount>",
   "Won auction for R<amount>") and the appropriate `relatedId` (auctionId where
   relevant, omit otherwise).

4. **`getSellerActivity` query** — add to `convex/users.ts`, per the issue's
   proposal, with **one addition**: the issue's Notes say "Only show publicly
   appropriate activity... on the public profile; keep KYC/role changes visible only
   to the profile owner." Implement this as a `viewerIsOwner: v.optional(v.boolean())`
   or (cleaner) compute ownership server-side by comparing the authenticated caller's
   ID to `args.userId` inside the handler (no separate arg needed — `getAuthUser`/
   `getAuthenticatedUserId` already exists for this). Filter the activity list to
   exclude `verification_requested`/`verification_approved`/`verification_rejected`/
   `role_changed` types when the caller is not the profile owner (an unauthenticated
   viewer, or a different logged-in user, sees only `account_created`,
   `listing_created`, `listing_sold`, `bid_placed`, `bid_won`).

   ```typescript
   export const getSellerActivity = query({
     args: { userId: v.string(), limit: v.optional(v.number()) },
     returns: v.array(v.object({
       _id: v.id("userActivity"),
       _creationTime: v.number(),
       type: v.union(/* the 9 literals */),
       description: v.optional(v.string()),
       relatedId: v.optional(v.string()),
       createdAt: v.number(),
     })),
     handler: async (ctx, args) => { ... }
   })
   ```

5. **`src/pages/Profile.tsx`**: replace the fake feed with real data.
   - Add `const activity = useQuery(api.users.getSellerActivity, { userId, limit:
10 })` (or similar — check how other `useQuery` calls in this file handle the
     loading/`undefined` state and follow that convention).
   - Remove `getActivityItems` and the `ActivityItem` interface's fabricated-shape
     assumptions; render directly from the query result (map `type` to a
     title/icon — the existing rendering code around line 1000 already switches on
     `item.type` for icon/color, reuse that switch logic against the real `type`
     literal, just widen it to cover all 9 types, not just 3). Format `createdAt`
     with the existing `formatActivityDate` helper (~line 110-114) rather than
     inventing a new one.
   - Add a clear empty state ("No activity yet") when the query returns an empty
     array, matching this page's existing empty-state visual style elsewhere (e.g.
     the "No active auctions" empty state ~line 604-610).
   - Loading state: follow this file's existing pattern for `useQuery` results that
     start `undefined` (check how `sellerInfo`/`watchedAuctionIds` are handled
     elsewhere on this page).

6. **Tests**: add/extend test coverage for each instrumented mutation confirming a
   `userActivity` row is inserted with the correct `type`/`userId`/`relatedId` (check
   existing test files for `syncUser`, `submitKYC`, `promoteToAdmin`, `reviewKYC`,
   `createAuction`, `publishAuction`/`submitForReview`, `closeAuctionEarly`,
   `settleExpiredAuctions`, `placeBid` — extend them rather than duplicating whole
   test files). Add `convex/users.test.ts` (or wherever `getSellerActivity`'s
   handler lives) coverage for: returns all types for the owner, filters out
   KYC/role types for a non-owner viewer, respects `limit`, empty array for a user
   with no activity. Update `src/pages/Profile.test.tsx` for the new query-driven
   activity feed (loading/empty/populated states, at least one of each visible
   type rendering correctly).

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument + return
  validators on every mutation/query, no `any` types, prefer indexes over `.filter()`.
- Do not use `ctx.runMutation`/an `internalMutation` for `logActivity` — it must run
  in the same transaction as the calling mutation (see Instructions step 2).
- Do not touch `convex/admin_debug.ts`'s dev-only `promoteToAdmin` — only
  `convex/users.ts`'s admin-only `promoteToAdminHandler`.
- Do not add pagination to `getSellerActivity` in this pass — the issue's Notes say
  "Consider adding pagination for prolific users," explicitly a future
  nice-to-have, not a requirement; `limit`-based truncation (as the issue's own
  proposed implementation does) is sufficient here.
- Do not change any auction/bidding/KYC business logic beyond adding the
  `logActivity` calls — no altering thresholds, guards, or return shapes of the
  instrumented mutations.
- Follow this repo's existing code style and JSDoc conventions.
- Bump `package.json` version per `AGENTS.md`'s semver section (this branch continues
  from `0.14.2`).

## Verification

Run these yourself and record actual results in the Results section — do not assume:

1. `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`
   AND `bun run type-check` — both must pass.
2. `npx convex dev --once` — deploys cleanly (schema change: new `userActivity`
   table).
3. `bun run test --run` (full suite) — all green, including new/updated tests for
   every instrumented mutation and the new query.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs the
   current HEAD of this branch.
5. Manually confirm (via diff) that no instrumented mutation's existing business
   logic, return shape, or guard conditions changed — only additive `logActivity`
   calls were inserted. Confirm `convex/admin_debug.ts` is untouched.

## Results

**Status: complete.** All instructions implemented; opencode's implementation run was
interrupted by a sandbox permission denial partway through its own final eslint
baseline comparison (it was trying to write scratch files to `%TEMP%` from a `/tmp`
path, which this sandbox blocks) before it could fill in this section — the
orchestrator (Claude) finished verification directly and a follow-up opencode run
fixed 17 `no-unsafe-assignment` warnings the first pass had introduced (see below).

### Files changed

- `convex/schema.ts` — added `userActivity` table (9-literal `type` union,
  `by_userId`/`by_userId_createdAt` indexes), placed near `notifications`.
- `convex/userActivity.ts` (new) — `logActivity` (plain async helper, not a
  registered mutation, per the Convex-rules-driven deviation from the issue's own
  `internalMutation` proposal), `getSellerActivityHandler`/`getSellerActivity`
  (filters out `verification_requested`/`verification_approved`/
  `verification_rejected`/`role_changed` for non-owner viewers, computed
  server-side from the authenticated caller; over-fetches to `MAX_ACTIVITY_SCAN`
  for non-owners so filtering doesn't under-return a `limit`-sized page).
- Instrumented 7 call sites with `logActivity`, each additive-only (verified via
  diff — no business logic, guard, or return-shape changes):
  - `convex/users.ts`: `syncUserHandler` (`account_created`, new-profile branch
    only), `submitKYCHandler` (`verification_requested`, every submission),
    `promoteToAdminHandler` (`role_changed`, non-no-op branch only),
    `verifyUserHandler` (`verification_approved`, bonus — the rarely-used manual
    override path).
  - `convex/admin/kyc.ts`: `reviewKYC` (`verification_approved`/
    `verification_rejected` in the respective branches — the actual approve/reject
    flow).
  - `convex/auctions/mutations/create.ts`: `createAuctionHandler`
    (`listing_created`, only when `status !== "draft"`).
  - `convex/auctions/mutations/publish.ts`: `publishAuctionHandler`
    (`listing_created` for the draft→pending_review path — mutually exclusive with
    the create-time log, since an auction only ever takes one of these two paths).
  - `convex/auctions/internal.ts`: new shared
    `logAuctionSettlementActivity(ctx, auction, finalStatus, winnerId)` helper
    (`listing_sold` for the seller, `bid_won` for the winner), called from both
    `settleExpiredAuctionsHandler` and (via `publish.ts`)
    `closeAuctionEarlyHandler` — avoids duplicating the sold/won logging logic
    across the two parallel settlement paths.
  - `convex/auctions/mutations/bidding.ts`: `placeBidHandler` (`bid_placed`, after
    a successful `handleNewBid` call).
  - `convex/admin_debug.ts` (dev-only promotion tool) — confirmed untouched, as
    instructed.
- `src/pages/Profile.tsx` — replaced `getActivityItems`/`ActivityItem` with a real
  `useQuery(api.userActivity.getSellerActivity, { userId, limit: 10 })`; added an
  `ACTIVITY_META` lookup table covering all 9 activity types (icon/color/title per
  type, widening the old 3-type switch); loading state via `LoadingIndicator`,
  empty state ("No activity yet") matching this page's existing empty-state style,
  populated state rendering `item.description ?? meta.title` and
  `formatActivityDate(item.createdAt)` (reusing the existing helper, not a new one).
- Tests: extended `convex/users.test.ts`, `convex/auctions/internal.test.ts`,
  `convex/auctions/mutations/create.test.ts`, `convex/auctions/mutations/publish.test.ts`,
  `convex/auctions/mutations/bidding.test.ts` for each instrumented call site;
  new `convex/admin/kyc.test.ts` (this file had no prior test coverage at all) and
  `convex/userActivity.ts`'s own `convex/userActivity.test.ts` (owner vs non-owner
  filtering, `limit`, empty array); `src/pages/Profile.test.tsx` updated for the
  query-driven feed (loading/empty/populated, multiple activity types rendering).
- `package.json`: `0.14.2` → `0.15.0` (minor, new feature).

### Verification results (all independently confirmed by the orchestrator)

1. **Type checks** — `bunx tsgo -p tsconfig.json --noEmit`, `bunx tsgo -p
convex/tsconfig.json --noEmit`, and `bun run type-check` all pass, zero errors.
2. **`npx convex dev --once`** — deploys cleanly: "Convex functions ready! (6.72s)",
   new `userActivity` table included.
3. **`bun run test --run`** (full suite) — **173 test files / 2156 tests, all
   passing** (final run, after the eslint follow-up fix below).
4. **`bunx eslint`** — 0 errors throughout. The first implementation pass introduced
   10+ (actually 17, once precisely counted) new `no-unsafe-assignment` warnings,
   all from `createdAt: expect.any(Number)` in the new `userActivity`-insert
   assertions missing this repo's established `expect.any(Number) as number` cast
   convention (already documented in `codebase_notes.md`, and already correctly
   applied in `convex/admin/kyc.test.ts`/`convex/userActivity.test.ts` by the same
   pass — just missed in 5 other test files). A follow-up opencode run fixed all
   17 occurrences across `convex/users.test.ts`, `convex/auctions/internal.test.ts`,
   `convex/auctions/mutations/bidding.test.ts`,
   `convex/auctions/mutations/create.test.ts`,
   `convex/auctions/mutations/publish.test.ts` (some were `expect.any(String)`/
   `expect.stringContaining` needing `as string`, not just `as number` — verified
   in the final diff). Final baseline comparison (path-scoped `git stash` on the 18
   pre-existing touched files): **53 warnings now vs 60 at HEAD** — net fewer, not
   more, since the cast fix also cleaned up warning noise the diff touched. The 3
   new files (`convex/userActivity.ts`, `convex/userActivity.test.ts`,
   `convex/admin/kyc.test.ts`) are fully clean (0 warnings).
5. **Diff confirmation** — every instrumented mutation's diff is a pure addition
   (a `logActivity`/`logAuctionSettlementActivity` call inserted, nothing removed
   or restructured); `convex/admin_debug.ts` untouched; no auction/bidding/KYC
   guard conditions, thresholds, or return shapes changed.

### Process note (for whoever reads this later)

The implementing opencode run's own sandbox rejected a permission request to write
scratch comparison files under `%TEMP%\*` (using a `/tmp` path, which doesn't
resolve there on this Windows machine) partway through its final eslint baseline
check, and the run ended without filling in this section or flagging the 17 new
warnings it had introduced. The orchestrator caught this independently (per its own
"don't trust an agent's self-report at face value" verification step) by re-running
the full baseline comparison itself, found the real regression, and dispatched a
second, narrowly-scoped opencode run to fix it. Worth noting for future large
multi-file instrumentation tasks: run the eslint baseline check incrementally
per-file as each file is edited, rather than once at the very end — it would have
caught this immediately instead of needing a second pass.
