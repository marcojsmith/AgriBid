# Task: Implement GitHub issue #221 — seller review/rating system

## Context

GitHub issue #221 (https://github.com/marcojsmith/AgriBid/issues/221): the profile
page's "Seller Rating" trust item and the sidebar star display are both hardcoded
placeholders — there is no reviews table or query backing them yet. Verified against
the current `feat/issue-221-seller-reviews` tip (branched off `feat/issue-233-seller-listings-page`):

- `src/pages/Profile.tsx:162-167` — `getTrustItems()` hardcodes:
  ```tsx
  { id: "rating", icon: Star, label: "Seller Rating", value: "No reviews", verified: false }
  ```
- `src/pages/Profile.tsx:497-505` — the sidebar rating row hardcodes:
  ```tsx
  <p className="text-amber-500 tracking-widest">★★★★★</p>
  <p className="text-[10px] text-muted-foreground">No reviews yet</p>
  ```
- `convex/auctions/queries/browse.ts:370-474` — `getSellerInfoHandler`/`getSellerInfo`
  returns seller stats (`itemsSold`, `activeListings`, `bidsPlaced`, etc.) but nothing
  about ratings/reviews.
- `convex/schema.ts:23-` — the `auctions` table has `status` (union including
  `"sold"`) and `winnerId: v.optional(v.union(v.string(), v.null()))` — use these to
  validate a review submission.
- `convex/schema.ts:95-113` — `auctionFlags` is the closest existing parallel pattern
  for a table keyed by `auctionId` + a reporting user, with a `status` union and
  `createdAt: v.number()`. Follow the same style (table shape, index naming) for the
  new `reviews` table.
- `convex/auctions/mutations/publish.ts:105-145` (`flagAuctionHandler`) is the closest
  existing parallel for a mutation that: resolves the caller via
  `getAuthenticatedUserId(ctx)` (imported from `../../lib/auth` — note there are two
  functions with this same name, one in `convex/lib/auth.ts` and one in
  `convex/auctions/queries/shared.ts`; use the `convex/lib/auth.ts` one, matching
  `publish.ts`), loads a related document, validates state, checks for an existing
  duplicate via an index + `.collect()` + `.some(...)`, then `ctx.db.insert(...)`.
  Follow this same shape for `submitReview`.
- `convex/admin_utils.ts:50` — `countQuery` helper, already used in `browse.ts`, for
  cheap counts without loading full documents.
- `convex/schema.ts:140-170` — the `profiles` table, indexed `by_userId` on
  `userId: v.string()` — use this to resolve reviewer display names for
  `getSellerReviews`.
- Public API re-exports live in `convex/auctions.ts` (e.g. `getSellerInfo`,
  `getSellerListings`, `flagAuction` are re-exported there from their real
  implementation files) — check whether a similar top-level `convex/reviews.ts`
  needs no re-export (it's already a top-level file, so `api.reviews.*` works
  directly) versus whether `convex/auctions.ts`-style aggregation is only used for
  files nested under `convex/auctions/`.

Read `convex/schema.ts` in full for table/index conventions, `convex/auctions/mutations/publish.ts`
(`flagAuctionHandler`/`flagAuction`) for the mutation pattern, `convex/auctions/queries/browse.ts`
(`getSellerInfoHandler`/`getSellerInfo`) for the query pattern to extend, and
`src/pages/Profile.tsx` in full for how `sellerInfo`, `getTrustItems`, and the sidebar
rating row are wired today.

## Instructions

### 1. `convex/schema.ts` — add a `reviews` table

Add near `auctionFlags` (same style: plain `v.string()` for user ids, matching how
`auctionFlags.reporterId` is typed, not `v.id("users")` — this codebase keys users by
string `userId`, not a `users` table id):

```typescript
reviews: defineTable({
  auctionId: v.id("auctions"),
  reviewerId: v.string(), // buyer userId (the auction winner)
  revieweeId: v.string(), // seller userId
  rating: v.number(), // integer 1-5, validated in the mutation handler
  comment: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_reviewee", ["revieweeId"])
  .index("by_reviewee_createdAt", ["revieweeId", "createdAt"])
  .index("by_auction_reviewer", ["auctionId", "reviewerId"]),
```

### 2. Create `convex/reviews.ts` (new top-level file)

Follow the `flagAuctionHandler`/`flagAuction` split pattern (separate exported handler
function + thin `mutation`/`query` wrapper) used in `convex/auctions/mutations/publish.ts`.

#### `submitReviewHandler` / `submitReview` (public mutation)

- Args: `{ auctionId: v.id("auctions"), rating: v.number(), comment: v.optional(v.string()) }`
- Resolve caller via `getAuthenticatedUserId(ctx)` from `convex/lib/auth.ts`.
- Load the auction via `ctx.db.get(args.auctionId)`; throw `ConvexError("Auction not found")` if missing.
- Throw `ConvexError("Only the auction winner can leave a review")` unless
  `auction.winnerId === userId`.
- Throw `ConvexError("Auction is not completed")` unless `auction.status === "sold"`.
- Validate `rating` is an integer between 1 and 5 inclusive; throw
  `ConvexError("Rating must be an integer between 1 and 5")` otherwise.
- Check for an existing review by this reviewer for this auction via the
  `by_auction_reviewer` index + `.unique()`; throw
  `ConvexError("You have already reviewed this auction")` if one exists.
- Insert into `reviews`: `{ auctionId, reviewerId: userId, revieweeId: auction.sellerId, rating, comment: args.comment, createdAt: Date.now() }`.
- Return validator: `v.object({ success: v.boolean() })`; handler returns `{ success: true }`.

Do not implement the "7-day cooldown" or "seller can respond" notes from the issue —
those are explicitly called out as future work, not in scope here.

#### `getSellerReviewsHandler` / `getSellerReviews` (public query)

- Args: `{ sellerId: v.string(), paginationOpts: paginationOptsValidator }` — import
  `paginationOptsValidator` from `convex/auctions/queries/shared.ts` (same source
  `browse.ts` uses) or `convex/server` directly, whichever this file ends up importing
  from `shared.ts`/`convex/server` consistently with the rest of the codebase (check
  `browse.ts` line 4 for the existing import path and prefer matching that if it's
  re-exported from a shared location; otherwise import `paginationOptsValidator`
  straight from `convex/server` per `.claude/rules/convex_rules.md`'s pagination
  example).
- Query `reviews` via `by_reviewee_createdAt` index, `q.eq("revieweeId", args.sellerId)`,
  `.order("desc")`, `.paginate(args.paginationOpts)`.
- For each review in the returned page, look up the reviewer's `profiles` row via
  `by_userId` to attach a display name (fall back to `"Anonymous"` or similar if the
  profile is missing — check how `Profile.tsx`/`browse.ts` handle a missing profile
  name elsewhere for the house convention).
- Return validator: an object matching Convex's paginate return shape
  (`page: v.array(...)`, `isDone: v.boolean()`, `continueCursor: v.string()`), where
  each page item is `v.object({ _id: v.id("reviews"), _creationTime: v.number(), auctionId: v.id("auctions"), rating: v.number(), comment: v.optional(v.string()), createdAt: v.number(), reviewerName: v.optional(v.string()) })`.

#### `getSellerRatingHandler` (internal helper, not a registered function)

Export a plain async helper function (not wrapped in `internalQuery`) that other
handlers can call directly, e.g.:

```typescript
export async function getSellerRatingSummary(
  ctx: QueryCtx,
  sellerId: string
): Promise<{ avgRating: number | undefined; reviewCount: number }> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_reviewee", (q) => q.eq("revieweeId", sellerId))
    .collect();
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : undefined;
  return { avgRating, reviewCount };
}
```

(Prefer a plain helper over an `internalQuery` here since it needs to run inside the
same query transaction as `getSellerInfoHandler` in step 3 — per
`.claude/rules/convex_rules.md`'s guidance to minimize query/mutation call-hops and
avoid the race-condition risk of a separate `ctx.runQuery` round trip.)

### 3. `convex/auctions/queries/browse.ts` — extend `getSellerInfo`

- Import `getSellerRatingSummary` from `../../reviews`.
- In `getSellerInfoHandler`, call `const { avgRating, reviewCount } = await getSellerRatingSummary(ctx, sellerId);` alongside the existing `Promise.all([...])` calls (add it as a 4th parallel call, or a sequential call after — whichever keeps the existing `Promise.all` destructuring clean) and add `avgRating` and `reviewCount` to the returned object.
- Update the `getSellerInfo` query's `returns` validator to add
  `avgRating: v.optional(v.number())` and `reviewCount: v.number()` to the object,
  matching the exact style of the other optional/required fields already there.

### 4. `src/pages/Profile.tsx` — wire up real rating data

- Update `getTrustItems(...)` to accept the seller's `avgRating`/`reviewCount` (add
  parameters or fold into the existing `verification` object — pick whichever keeps
  the function signature cleanest given its current 3 params) and set the `"rating"`
  trust item's `value` to e.g. `` `${avgRating.toFixed(1)} (${reviewCount})` `` when
  `avgRating` is defined, else keep `"No reviews"`; set `verified: reviewCount > 0`.
- Update the sidebar rating row (currently lines ~497-505) to render 0-5 stars
  proportionally from `sellerInfo.avgRating` (e.g. filled stars = `Math.round(avgRating)`,
  simplest correct approach — don't over-engineer partial-star rendering) and show
  `"${reviewCount} review(s)"` instead of the hardcoded "No reviews yet" when
  `reviewCount > 0`, otherwise keep today's "No reviews yet" text and the `★★★★★`
  placeholder styling (muted, not amber) for the zero-review case.
- Do NOT add a Reviews/comments section to the page — the issue marks that "optional"
  and it's a materially bigger UI change; out of scope for this task. Do NOT touch the
  "Contact Seller" or "Report Profile" buttons/TODOs — unrelated, tracked by #231/#232.

## Constraints

- Follow `.claude/rules/convex_rules.md` exactly: new function syntax, argument AND
  return validators on every Convex function (including the plain helper doesn't need
  validators since it's not a registered function, but `submitReview`/`getSellerReviews`
  and the modified `getSellerInfo` all do), no `v.map()`/`v.set()`, index names include
  all indexed fields in order (`by_reviewee`, `by_reviewee_createdAt`, `by_auction_reviewer`
  as specified above — do not rename them).
- No `any` types anywhere.
- Do not modify `auctions`, `auctionFlags`, or `profiles` table definitions in
  `convex/schema.ts` — only add the new `reviews` table.
- Do not implement the review-cooldown or seller-response features mentioned in the
  issue's "Notes" section — explicitly out of scope.
- Do not touch unrelated files (`convex/auth.config.ts`, any CORS helpers, deployment
  config, `package.json` scripts) — version bump per `AGENTS.md`'s semver section only
  if that section exists and applies.
- Match existing code style/conventions in every file touched (imports, JSDoc comment
  style, error message tone via `ConvexError`) rather than inventing new patterns.
- Add tests: `convex/reviews.test.ts` (new) covering `submitReviewHandler` — success
  case, non-winner rejection, non-sold-auction rejection, invalid rating rejection,
  duplicate-review rejection — and `getSellerReviewsHandler` — returns paginated
  reviews with reviewer names, empty page for a seller with no reviews. Update
  `convex/auctions/queries/browse.test.ts` for the new `avgRating`/`reviewCount` fields
  on `getSellerInfo` (both the "has reviews" and "no reviews" cases). Update
  `src/pages/Profile.test.tsx` (check it exists first) for the new rating display
  logic in both states. Follow each file's existing mocking conventions rather than
  introducing new ones.

## Verification

1. `bun run type-check` — zero errors.
2. `npx convex dev --once` — deploys cleanly (schema change: new `reviews` table).
3. `bun run test --run` (full suite) — all green, including new/updated tests.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs. HEAD baseline.
5. Manually confirm (via diff) that `auctions`, `auctionFlags`, `profiles` table
   definitions in `convex/schema.ts` are unchanged, and that "Contact Seller"/"Report
   Profile" in `Profile.tsx` are untouched.

## Results

<!-- opencode: fill this in when done -->

**Status: complete — all scoped work implemented and all Verification items pass.**

### Files changed

| File                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                       | Added `reviews` table (after `auctionFlags`) with `by_reviewee`, `by_reviewee_createdAt`, `by_auction_reviewer` indexes. `auctions`/`auctionFlags`/`profiles` definitions untouched (diff-verified).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `convex/reviews.ts`                      | **New.** `submitReviewHandler`/`submitReview` (public mutation, `flagAuctionHandler` pattern: `getAuthenticatedUserId` from `convex/lib/auth.ts`, `ConvexError` guards for not-found → non-winner → not-sold → invalid rating → duplicate via `by_auction_reviewer` + `.unique()`); `getSellerReviewsHandler`/`getSellerReviews` (public query, `by_reviewee_createdAt` desc + `.paginate`, reviewer display name via `profiles.by_userId`, `reviewerName` optional — house convention is optional name, not "Anonymous", matching `getSellerInfo`); `getSellerRatingSummary` plain helper (not a registered function). Arg + return validators on both registered functions. Top-level file → `api.reviews.*` works directly, no barrel re-export. |
| `convex/auctions/queries/browse.ts`      | `getSellerInfoHandler` calls `getSellerRatingSummary` as a 4th parallel `Promise.all` call; returns `avgRating`/`reviewCount`. `getSellerInfo` validator extended with `avgRating: v.optional(v.number())`, `reviewCount: v.number()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/pages/Profile.tsx`                  | `getTrustItems` gained a 4th `rating?: SellerRating` param; "Seller Rating" trust item shows `${avgRating.toFixed(1)} (${reviewCount})` with `verified: reviewCount > 0`, else "No reviews". Sidebar rating row renders amber `★`/`☆` from `Math.round(avgRating)` when reviewed, muted `★★★★★` placeholder + "No reviews yet" otherwise; shows "N review(s)" when `reviewCount > 0`. No Reviews section added (out of scope); Contact Seller/Report Profile untouched (grep-verified).                                                                                                                                                                                                                                                             |
| `convex/reviews.test.ts`                 | **New.** 13 tests: submitReview success/not-found/non-winner/non-sold/invalid-rating (0, 6, 3.5 via `it.each`)/duplicate; getSellerReviews paginated-with-names/missing-profile/empty-page; getSellerRatingSummary avg+count/empty. Mocks `./lib/auth` per `flagAuction.test.ts` conventions.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `convex/auctions/queries/browse.test.ts` | All 3 `getSellerInfoHandler` tests extended with a `reviews` table mock branch; asserts `avgRating: 4.5 / reviewCount: 2` (has reviews) and `undefined / 0` (no reviews, both remaining tests).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/pages/Profile.test.tsx`             | 5 new tests: amber `★★★★☆` + "2 reviews" state; singular "1 review" + `★★★★★` state; trust item "4.5 (2)" value; verified rating trust item. Existing zero-review tests unchanged and still green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `package.json`                           | Version `0.10.1` → `0.11.0` (minor, new feature, per AGENTS.md semver section which exists and applies).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `convex/_generated/api.d.ts`             | Regenerated by `npx convex dev --once` codegen (+`reviews` module) — expected generated output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Also appended a "Seller Reviews (issue #221)" section to `codebase_notes.md` (incl. a warning that `git stash push -u` is unsafe on this repo and that the background Convex watcher regenerates `api.d.ts` mid-git-operations).

### Verification results

1. **`bun run type-check`** — ✅ zero errors (after fixing one missing `MutationCtx` type import in `convex/reviews.ts` caught by the check).
2. **`npx convex dev --once`** — ✅ deployed cleanly: "Convex functions ready! (5.81s)", no schema/validation errors for the new `reviews` table.
3. **`bun run test --run`** (full suite) — ✅ **168 test files / 2031 tests, all passing**, including 13 new in `convex/reviews.test.ts`, updated `browse.test.ts` (7) and `Profile.test.tsx` (46).
4. **`bunx eslint` on all touched/created files** (`convex/schema.ts`, `convex/reviews.ts`, `convex/reviews.test.ts`, `convex/auctions/queries/browse.ts`, `convex/auctions/queries/browse.test.ts`, `src/pages/Profile.tsx`, `src/pages/Profile.test.tsx`) — ✅ **0 errors, 10 warnings, all pre-existing at HEAD baseline** (6 × `require-await` on `await act(async () => {})` lines and 3 × `no-unnecessary-condition` on `?? 0`, plus `if (!timestamp)` in Profile.tsx — verified present in HEAD versions; all flagged lines sit outside my diff hunks). Zero new warnings.
5. **Scoped diff confirmation** — ✅ `git diff convex/schema.ts` contains only the new `reviews` table (`auctions`, `auctionFlags`, `profiles` unchanged); `git diff src/pages/Profile.tsx` has no changes to "Contact Seller"/"Report Profile" buttons or their TODOs.

Note: `bun run build` was not run — it is not part of this task's Verification section (type-check via tsgo and the Convex function push both passed, covering both compile paths). AGENTS.md's build gate applies before _committing_; no commit was made.

### Out-of-scope items honoured

- No 7-day review cooldown, no seller responses (explicitly future work).
- No Reviews/comments UI section on the profile page (marked optional in the issue).
- No changes to `auth.config.ts`, CORS helpers, deployment config, or `package.json` scripts (version bump only).
- Review-cooldown/seller-response TODOs in the issue's Notes: not implemented.
