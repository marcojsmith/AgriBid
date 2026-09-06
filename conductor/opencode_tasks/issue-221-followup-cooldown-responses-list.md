# Task: Extend #221 seller reviews — cooldown, seller responses, reviews list UI

This extends the already-merged-to-branch work on `feat/issue-221-seller-reviews`
(PR #260, `convex/reviews.ts`, `convex/schema.ts`, `convex/auctions/queries/browse.ts`,
`src/pages/Profile.tsx`). GitHub issue #221's "Notes" section explicitly deferred three
items as future work; the user now wants them added to this same PR:

1. A review cooldown period after auction close before a review can be left.
2. Seller responses to reviews.
3. A full reviews list/comments section on the profile page (previously only the
   trust-item summary + star average were wired up, per issue #221's optional "Add a
   Reviews section below past sales" note).

## Context

- `convex/schema.ts` — `reviews` table (search for `// Seller reviews left by auction
winners`), currently: `auctionId`, `reviewerId`, `revieweeId`, `rating`, `comment`,
  `createdAt`, with indexes `by_reviewee`, `by_reviewee_createdAt`,
  `by_auction_reviewer`.
- `convex/reviews.ts` — full file, currently: `getSellerRatingSummary` (plain helper),
  `submitReviewHandler`/`submitReview` (mutation), `getSellerReviewsHandler`/
  `getSellerReviews` (paginated query). `submitReviewHandler` checks: auction exists,
  caller is `auction.winnerId`, `auction.status === "sold"`, rating is integer 1-5, no
  existing review for `(auctionId, reviewerId)` via `by_auction_reviewer`.
- `convex/auctions/queries/browse.ts` — `getSellerInfoHandler` calls
  `getSellerRatingSummary` as a 4th parallel `Promise.all` call, returns
  `avgRating`/`reviewCount` on `getSellerInfo`.
- `src/pages/Profile.tsx` — `getTrustItems` (around line 104-151) uses
  `avgRating`/`reviewCount` for the "Seller Rating" trust item; sidebar star display
  renders `★`/`☆` from `Math.round(avgRating)`. The "Past Sales" section sits around
  line 627-667 (`{/* Past Sales */}` ... `{/* Recent Activity */}` follows it) — this is
  the natural insertion point for a new Reviews section, immediately after Past Sales
  and before Recent Activity. `sellerInfo` comes from
  `useQuery(api.auctions.getSellerInfo, { sellerId: userId ?? "" })` around line 225.
- Auth pattern: `getAuthenticatedUserId(ctx)` from `convex/lib/auth.ts`, same as
  `submitReviewHandler` already uses.
- Test files: `convex/reviews.test.ts` (13 existing tests, mocks `./lib/auth` — follow
  its existing conventions), `convex/auctions/queries/browse.test.ts`, or
  `src/pages/Profile.test.tsx`.

## Instructions

1. **Review cooldown period.** Add a cooldown so a review can only be submitted a
   fixed period after the auction closed — 7 days, per issue #221's Notes
   ("Consider a 7-day cooldown after auction closes before a review can be left").
   - `auctions` table needs a timestamp for when it was settled/closed to measure
     the cooldown from — check `convex/schema.ts`'s `auctions` table and
     `convex/auctions/settleExpiredAuctions.ts` (or wherever an auction transitions to
     `status: "sold"`) for an existing field such as `settledAt`/`closedAt`/`endTime`.
     Use whatever field already marks the sold transition rather than adding a new one,
     if one exists; only add a new field if genuinely none exists, and if you do, wire
     it into the settlement mutation that sets `status: "sold"`.
   - In `submitReviewHandler`, after confirming `auction.status === "sold"`, reject
     (via `ConvexError`) if less than 7 days (in ms) have elapsed since that
     settlement timestamp — clear error message like "Reviews can be left starting 7
     days after the sale completes."
   - Do NOT change existing behavior for auctions that were already reviewable before
     this change in a way that breaks the 13 existing tests in
     `convex/reviews.test.ts` other than what's needed — update/add test fixtures'
     settlement timestamps as needed so existing "success" tests still pass (they'll
     need a settlement timestamp ≥7 days in the past), and add new tests for: reject
     when settled <7 days ago, accept at exactly/just-over 7 days.

2. **Seller responses to reviews.**
   - Add a `response` field to the `reviews` table in `convex/schema.ts`:
     `response: v.optional(v.object({ text: v.string(), createdAt: v.number() }))`.
   - Add a new mutation `respondToReview` in `convex/reviews.ts`:
     args `{ reviewId: v.id("reviews"), text: v.string() }`, returns
     `v.object({ success: v.boolean() })`. Guards: review exists; caller (via
     `getAuthenticatedUserId`) equals `review.revieweeId` (only the reviewed seller
     may respond); review does not already have a `response` (one response per
     review — reject with `ConvexError` if already set, no edit/update flow needed);
     `text` is non-empty (reject blank/whitespace-only). Use `ctx.db.patch` to set
     `response: { text, createdAt: Date.now() }`.
   - Update `getSellerReviewsHandler`'s returned shape (and `getSellerReviews`'s
     `returns` validator) to include the optional `response` field so the UI can
     render it.
   - Add tests to `convex/reviews.test.ts` mirroring `submitReview`'s test structure:
     success, not-found review, non-seller caller rejected, duplicate-response
     rejected, blank-text rejected.

3. **Full reviews list/comments section on the profile page.**
   - In `src/pages/Profile.tsx`, add a new section using `getSellerReviews` (paginated
     query, args `{ sellerId: userId ?? "", paginationOpts: { numItems: N, cursor:
null } }` — check how other paginated queries are consumed elsewhere in this repo,
     e.g. `usePaginatedQuery` from `convex/react` if that's the established pattern in
     this codebase; grep for `usePaginatedQuery` first and follow it if used, otherwise
     a simple one-page `useQuery` call is fine for now with a "load more" button wired
     to `continueCursor`).
   - Insert this new "Reviews" section between the existing "Past Sales" section
     (ends ~line 667) and "Recent Activity" section (starts ~line 669), styled
     consistently with the surrounding `Card`/`CardContent` sections (compare to the
     Past Sales card's markup for the pattern: `Card` > `CardContent` > header row with
     icon + heading, then content, empty-state fallback when `reviewCount === 0`).
   - Each review row should show: star rating (reuse whatever star-rendering
     approach the sidebar summary already uses, e.g. `Math.round(rating)` → filled
     `★`/empty `☆`), `reviewerName` (fallback like "Anonymous" or similar if
     undefined — follow this file's existing convention for missing names elsewhere
     on the page), `comment` if present, relative/formatted `createdAt` (check if this
     file already imports a date-formatting util/lib and reuse it), and the seller's
     `response.text` indented/styled distinctly underneath if present.
   - Only render the section (or render it in an empty state) when `sellerInfo` is
     loaded; gate on `reviewCount > 0` similar to how "Past Sales" gates on
     `sellerInfo.itemsSold > 0`, but show a small "No reviews yet" empty card rather
     than hiding entirely, so the section reads as complete rather than missing.
   - Add/extend tests in `src/pages/Profile.test.tsx` for: reviews list rendering with
     data, empty state, and a review with a seller response rendered.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument + return
  validators on every mutation/query, no `any` types, use existing indexes rather than
  `.filter()` where possible.
- Do not touch `auth.config.ts`, CORS helpers, deployment config, or any file outside
  what's described above.
- Do not modify or remove the existing `submitReview`/`getSellerReviews` behavior
  beyond what's needed to add the cooldown check and the `response` field — don't
  restructure working code.
- Follow this file's/repo's existing code style, error messages via `ConvexError`,
  and component patterns rather than inventing new ones.
- Handle the `package.json` version bump per `AGENTS.md`'s semver section if it
  documents one (this branch already bumped to `0.11.0` for the base #221 work — bump
  again appropriately for this additive follow-up, likely another minor bump).

## Verification

Run all of these yourself and record actual results (not assumptions) in the Results
section below:

1. `bun run type-check` — zero errors.
2. `npx convex dev --once` — deploys cleanly (schema change: `reviews.response`
   field, and an `auctions` settlement-timestamp field only if newly added).
3. `bun run test --run` (full suite) — all green, including new/updated tests for
   cooldown, seller responses, and the reviews list UI.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs. the
   current HEAD of this branch.
5. Manually confirm (via diff) that unrelated table definitions in
   `convex/schema.ts` (`auctionFlags`, `profiles`, etc.) are unchanged, and that
   "Contact Seller"/"Report Profile" in `Profile.tsx` are untouched.

## Results

All three items implemented and verified on `feat/issue-221-seller-reviews`.

### 1. Review cooldown (7 days after settlement)

- `convex/schema.ts` — added `settledAt: v.optional(v.number())` to the `auctions`
  table (reuses the existing sold-transition point rather than inventing a new one).
- `convex/auctions/internal.ts` — `settleExpiredAuctionsHandler` now writes
  `settledAt: now` when patching an auction to `sold`/`unsold`.
- `convex/auctions/mutations/publish.ts` — `closeAuctionEarlyHandler` now writes
  `settledAt: Date.now()` on the same patch.
- `convex/reviews.ts` — added `REVIEW_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000`;
  `submitReviewHandler` resolves `auction.settledAt ?? auction.endTime` and throws
  `ConvexError("Reviews can be left starting 7 days after the sale completes.")`
  when `Date.now() - settledAt < REVIEW_COOLDOWN_MS`. If neither timestamp exists
  (legacy auctions) the check is skipped, so pre-existing behaviour is preserved.
- Tests: `convex/reviews.test.ts` grew from 13 to 24 tests — includes reject when
  settled <7 days ago, accept at just-over 7 days, and legacy fixtures (settlement
  timestamp ≥7 days in the past) so all pre-existing success tests still pass.

### 2. Seller responses to reviews

- `convex/schema.ts` — added `response: v.optional(v.object({ text: v.string(),
createdAt: v.number() }))` to the `reviews` table.
- `convex/reviews.ts` — new `respondToReview` mutation (`args: { reviewId:
v.id("reviews"), text: v.string() }`, `returns: v.object({ success:
v.boolean() })`) with guards: review exists (`ConvexError("Review not found")`),
  caller equals `review.revieweeId` (`"Only the reviewed seller can respond to this
review"`), no existing response (`"This review has already been responded to"`),
  non-blank text (`"Response text cannot be empty"`). Persists via
  `ctx.db.patch(..., { response: { text, createdAt: Date.now() } })`. One response
  per review; no edit/delete flow.
- `getSellerReviewsHandler` / `getSellerReviews` now include the optional
  `response` field in the returned shape and `returns` validator.
- Tests: 5 new `respondToReview` cases in `convex/reviews.test.ts` (success,
  not-found, non-seller caller, duplicate response, blank text).

### 3. Reviews list section on the profile page

- `src/pages/Profile.tsx` — added a `usePaginatedQuery(api.reviews.getSellerReviews,
{ sellerId: userId ?? "" }, { initialNumItems: 5 })` call (matching the existing
  `usePaginatedQuery` pattern used for Past Sales) and a "Reviews" section inserted
  between "Past Sales" and "Recent Activity", styled like the surrounding
  `Card`/`CardContent` sections. Each row shows the star rating (filled `★`/empty
  `☆` from `Math.round(rating)`, with an `aria-label` for accessibility),
  `reviewerName ?? "Anonymous"`, `formatActivityDate(createdAt)` (reusing the
  file's existing date formatter), the `comment`, and the seller's
  `response.text` in a distinct indented block with a left border. "Load More
  Reviews" button (disabled while `LoadingMore`) when `CanLoadMore`; a "No reviews
  yet." empty state renders when `reviewCount === 0` so the section always reads
  as complete.
- Tests: 3 new cases in `src/pages/Profile.test.tsx` (reviews list renders names/
  ratings/comments/dates, seller response renders, empty state renders) plus mock
  wiring for `reviews:getSellerReviews` via `usePaginatedQuery`.

### Lint follow-up (final session)

The earlier run left 7 `@typescript-eslint/no-unsafe-assignment` warnings on
`expect.any(Number)` used for typed fields. Fixed by appending `as number` per the
repo convention already used in `convex/auctions/proxy_bidding.test.ts:362` —
test behaviour unchanged:

- `convex/auctions/closeAuctionEarly.test.ts` — lines 119, 163 (`settledAt`)
- `convex/auctions/settleExpiredAuctions.test.ts` — lines 102, 139, 165, 210
  (`settledAt`)
- `convex/reviews.test.ts` — line 391 (`createdAt` inside `response`)

### Verification (all actually run)

1. `bun run type-check` — pass, zero errors.
2. `npx convex dev --once` — deployed cleanly ("Convex functions ready!", 5.3s),
   including the new `auctions.settledAt` and `reviews.response` schema fields.
3. `bun run test --run` (full suite) — **168 test files / 2045 tests, all passed**
   (incl. the 24 review tests, 8 closeAuctionEarly tests, 4 settleExpiredAuctions
   tests, and the new Profile reviews-section tests).
4. Targeted run of the three lint-fixed files
   (`bun run test --run convex/reviews.test.ts convex/auctions/closeAuctionEarly.test.ts
convex/auctions/settleExpiredAuctions.test.ts`) — 36 tests passed.
5. `bunx eslint` on `convex/reviews.ts convex/reviews.test.ts convex/schema.ts
convex/auctions/mutations/publish.ts convex/auctions/internal.ts
convex/auctions/closeAuctionEarly.test.ts convex/auctions/settleExpiredAuctions.test.ts
src/pages/Profile.tsx src/pages/Profile.test.tsx` — **0 errors, 8 warnings, all
   pre-existing vs HEAD, 0 new warnings**:
   - `convex/auctions/internal.ts:24` — `jsdoc/check-tag-names` (`@sideEffects`),
     pre-existing (this task's diff only touches the `settledAt` patch line).
   - `src/pages/Profile.test.tsx` — 6× `require-await` on pre-existing
     `await act(async () => { fireEvent... })` callbacks (all outside this task's
     new hunks).
   - `src/pages/Profile.tsx:68` — `no-unnecessary-condition`, pre-existing code
     untouched by this task (diff starts at line 238).
     The 7 new `no-unsafe-assignment` warnings were the only new warnings and are
     now fixed (0 errors, 0 new warnings vs HEAD).
6. Diff scope check (via `git diff`) — `convex/schema.ts` touches only the two
   intended lines (`auctions.settledAt`, `reviews.response`); unrelated tables
   (`auctionFlags`, `profiles`, etc.) unchanged. `src/pages/Profile.tsx` hunks are
   limited to the new reviews query (~line 241) and the Reviews section (~line
   679); "Contact Seller" and "Report Profile" are untouched. `internal.ts` /
   `publish.ts` diffs are single-line `settledAt` additions inside existing patch
   calls. `package.json` bumped `0.11.0 → 0.12.0` (minor, additive feature).

### Touched files

`convex/schema.ts`, `convex/reviews.ts`, `convex/auctions/internal.ts`,
`convex/auctions/mutations/publish.ts`, `convex/reviews.test.ts`,
`convex/auctions/closeAuctionEarly.test.ts`,
`convex/auctions/settleExpiredAuctions.test.ts`, `src/pages/Profile.tsx`,
`src/pages/Profile.test.tsx`, `package.json` (+559/−8 across 10 files).
