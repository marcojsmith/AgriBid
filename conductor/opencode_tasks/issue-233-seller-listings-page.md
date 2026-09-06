# Task: Implement GitHub issue #233 — seller-filtered auction listing page

## Context

GitHub issue #233 (https://github.com/marcojsmith/AgriBid/issues/233): the profile
page's "Active Auctions" and "Past Sales" sections each have a dead "View all →" label
(`src/pages/Profile.tsx`, currently around lines 553 and 593 — re-verify against the
live file, other work may have shifted lines) with a TODO comment and no link — the
profile page only shows the first page of listings via `getSellerListings`, with no way
to browse the rest. This task adds a dedicated page for that.

Read `convex/auctions/queries/browse.ts` (`getSellerListingsHandler`/
`getSellerListings`), `src/pages/Profile.tsx` (both TODO sites and how `userId`/
`sellerInfo` are obtained), `src/App.tsx` (routing), and an existing paginated-listing
page for house style — `src/pages/dashboard/MyListings.tsx` or `src/pages/Home.tsx` are
the closest references for `usePaginatedQuery` + `AuctionCard` grid conventions in this
repo. Follow their patterns rather than inventing a new one.

## Instructions

### 1. `convex/auctions/queries/browse.ts` — add status filtering to `getSellerListings`

Current `getSellerListingsHandler`/`getSellerListings` (around line 485-550) queries
the `by_seller` index and filters in-memory for `status in (active, sold)`, mixing
both. Add an optional `statusFilter` arg so a caller can request just one:

```typescript
args: {
  userId: v.string(),
  statusFilter: v.optional(v.union(v.literal("active"), v.literal("sold"))),
  paginationOpts: paginationOptsValidator,
}
```

When `statusFilter` is provided, use the existing `by_seller_status` index (already
defined in `convex/schema.ts` on the `auctions` table — no schema change needed) instead
of the current `by_seller` + in-memory `.filter()`:

```typescript
ctx.db
  .query("auctions")
  .withIndex("by_seller_status", (q) =>
    q.eq("sellerId", args.userId).eq("status", args.statusFilter!)
  )
  .paginate(args.paginationOpts);
```

When `statusFilter` is omitted, keep the current behavior (both active and sold,
via `by_seller` + the existing `q.or(...)` filter) — don't break the profile page's
existing unfiltered call. Apply the same conditional to the `countQuery(...)` call
used for `totalCount`. Update the `returns` validator's `args` accordingly (add
`statusFilter: v.optional(v.union(v.literal("active"), v.literal("sold")))` to the
`getSellerListings` query's `args`, matching the handler).

### 2. `src/App.tsx` — add two routes

Add, near the existing `/profile/:userId` route:

```tsx
<Route path="/sellers/:userId/listings" element={<SellerListings status="active" />} />
<Route path="/sellers/:userId/listings/sold" element={<SellerListings status="sold" />} />
```

Adjust the exact prop-passing approach to match how other routes in this file
parameterize reusable pages (check if there's a precedent for passing a literal prop
vs. reading a second route param/query string — pick whichever is more consistent with
existing code, but a `status` prop matching the issue's two distinct URLs is the
simplest approach and is what's specified in the issue).

### 3. Create `src/pages/SellerListings.tsx`

New page, modeled on `src/pages/dashboard/MyListings.tsx`'s pagination/grid pattern:

- Reads `userId` from `useParams<{ userId: string }>()`.
- Takes a `status: "active" | "sold"` prop (from the route, per step 2).
- Fetches the seller's name/summary via the existing `api.auctions.getSellerInfo` query
  (same one `Profile.tsx` uses) to show a page title: `"Active Auctions by
{sellerInfo.name}"` / `"Past Sales by {sellerInfo.name}"` (fall back to something
  reasonable like `"this seller"` if `sellerInfo` or `sellerInfo.name` is null/loading —
  check how `Profile.tsx` handles a null/loading `sellerInfo` for the house pattern).
- Fetches listings via `usePaginatedQuery(api.auctions.getSellerListings, { userId:
userId ?? "", statusFilter: status }, { initialNumItems: <pick a reasonable page size,
e.g. 12> })` — check the exact `api.auctions.*` import path/module name other pages
  use for these queries (may be `api.auctions.queries.browse.getSellerListings` or
  re-exported at a shallower path — grep for how `Profile.tsx`/`MyListings.tsx` import
  `getSellerListings`/`getSellerInfo` and match that).
- Renders results as a grid of `AuctionCard` (same grid classes as the two sections in
  `Profile.tsx`: `grid grid-cols-1 md:grid-cols-2 gap-4`), each needing an `isWatched`
  prop — check how `Profile.tsx` sources `watchedAuctionIds` and replicate that (a
  `useQuery`/watchlist lookup) so watch-state renders correctly here too.
- Includes a "Load more" control or equivalent pagination UI matching whatever pattern
  `MyListings.tsx`/`Home.tsx` already use for `usePaginatedQuery` — don't invent a new
  pagination UI style.
- Includes a back link to `/profile/${userId}` (e.g. "← Back to profile").
- Handles the empty state (no listings matching the filter) with a message consistent
  in tone with the empty states already in `Profile.tsx` (e.g. "No active auctions at
  this time.").

### 4. `src/pages/Profile.tsx` — wire up the two "View all" links

Replace both dead `<span>` placeholders (and their TODO comments) with real links:

```tsx
<Link
  to={`/sellers/${userId}/listings`}
  className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
>
  View all →
</Link>
```

and the sold-listings equivalent pointing to `/sellers/${userId}/listings/sold`
(swap the color classes to match the existing green Sales History styling). `Link` from
`react-router-dom` is already imported in this file (used elsewhere) — reuse it rather
than adding a new import if already present; add it if not.

## Constraints

- Follow `.claude/rules/convex_rules.md`: validators on the modified Convex function,
  no `any` types.
- Do not touch the "Contact Seller" or "Report Profile" buttons/TODOs in `Profile.tsx`
  — those are unrelated, tracked by separate issues (#231, #232).
- Do not modify the `by_seller_status` or `by_seller` index definitions in
  `convex/schema.ts` — both already exist and are sufficient; this task is query-logic
  and frontend-only plus one new optional arg.
- Match existing code style/conventions in the files you touch (imports, component
  structure, Tailwind class patterns) rather than introducing a new pattern.
- Check `convex/auctions/queries/browse.test.ts` for existing `getSellerListings`
  tests; update/extend them to cover: no `statusFilter` (existing mixed behavior
  unchanged), `statusFilter: "active"` (only active returned), `statusFilter: "sold"`
  (only sold returned). Add a `src/pages/SellerListings.test.tsx` covering: renders the
  seller's name in the title, renders auction cards for the fetched page, renders the
  empty state when there are no results, and the back link points to `/profile/:userId`
  — check `src/pages/dashboard/MyListings.test.tsx` for the established mocking pattern
  for `usePaginatedQuery` in this repo and follow it.

## Verification

1. `bun run type-check` — zero errors.
2. `npx convex dev --once` — deploys cleanly (no schema changes expected, but confirms
   the updated validators are consistent).
3. `bun run test --run` (full suite) — all green, including new/updated tests.
4. `bun run lint` — zero errors, no new warnings.
5. Manually confirm (via diff) that the "Contact Seller"/"Report Profile" buttons in
   `Profile.tsx` are untouched.

## Results

### Files changed

- `convex/auctions/queries/browse.ts` — `getSellerListingsHandler`/`getSellerListings` now accept an optional
  `statusFilter: v.optional(v.union(v.literal("active"), v.literal("sold")))` arg. When provided, the query uses the
  existing `by_seller_status` index (`q.eq("sellerId", ...).eq("status", statusFilter)`); when omitted, the previous
  `by_seller` + in-memory `q.or(active, sold)` behaviour is preserved, so the profile page's unfiltered call is
  unaffected. The same conditional applies to the `countQuery(...)` used for `totalCount`. No schema change.
- `src/App.tsx` — lazy-loaded `SellerListings` and added `/sellers/:userId/listings` (status="active") and
  `/sellers/:userId/listings/sold` (status="sold") routes next to `/profile/:userId`, using a literal `status` prop per
  the issue. Updated the route-list JSDoc.
- `src/pages/SellerListings.tsx` (new) — page modelled on the Profile/MyListings/Home conventions: `useParams` userId,
  `status` prop, title `Active Auctions by {name}` / `Past Sales by {name}` via `api.auctions.getSellerInfo`
  (falls back to "this seller" when loading/null), listings via `usePaginatedQuery(api.auctions.getSellerListings, …,
{ initialNumItems: 12 })` using `PAGINATION_INITIAL_ITEMS`/`PAGINATION_LOAD_MORE_ITEMS` constants, watch-state sourced
  from `api.watchlist.getWatchedAuctionIds` (same as Profile), `grid grid-cols-1 md:grid-cols-2 gap-4` of `AuctionCard`,
  Profile-style "Load More Listings" pagination, Profile-style empty states ("No active auctions at this time." /
  "No past sales at this time."), and a "← Back to profile" link to `/profile/:userId`.
- `src/pages/Profile.tsx` — both dead "View all →" spans (and their TODO comments) replaced with `Link`s to
  `/sellers/${userId}/listings` (text-primary) and `/sellers/${userId}/listings/sold` (text-green-600, matching Sales
  History styling), using the already-imported `Link`. **The "Contact Seller"/"Report Profile" buttons and their TODOs
  (#231/#232 — the in-code TODO comments themselves say #220/#221, but both linked issues note that's a
  mislabelling) are untouched** — confirmed via `git diff` (the diff for this file contains only the two link hunks).
- `convex/auctions/queries/browse.test.ts` — added a `getSellerListingsHandler` describe block covering: no
  `statusFilter` (asserts `by_seller` index + in-memory `q.or` status filter used, mixed results returned),
  `statusFilter: "active"` and `statusFilter: "sold"` (assert `by_seller_status` index used with the right status eq and
  paginated/counted results returned). Existing `getSellerInfoHandler` tests unchanged and passing.
- `src/pages/SellerListings.test.tsx` (new) — 13 tests following the `Profile.test.tsx`/`Home.test.tsx` mocking pattern
  (`vi.mock("convex/react")`, `vi.hoisted` mockApi, mocked `AuctionCard`/`LoadingIndicator`, `MemoryRouter` + `Routes`
  for the route param): seller name in title (active + sold), "this seller" fallback, auction cards rendered with
  watch state, empty states for both filters, back-link href `/profile/user1`, `usePaginatedQuery` called with
  `statusFilter: "active"`/`"sold"` and `initialNumItems: 12`, loading-first-page state, `loadMore(12)` on click,
  disabled loading state, and undefined `watchedAuctionIds`.

### Verification output

1. `bun run type-check` — ✅ zero errors (`tsgo -b tsconfig.build.json --noEmit`, no output).
2. `npx convex dev --once` — ✅ `✔ Convex functions ready! (6.52s)` (run twice, incl. after final formatting —
   validators consistent, no schema changes).
3. `bun run test --run` — ✅ **167 test files passed, 2008 tests passed** (includes 7 in `browse.test.ts` and 13 in
   `SellerListings.test.tsx`).
4. `bun run lint` — ✅ **0 errors, 525 warnings** (HEAD baseline: 2 errors + 526 warnings; the 2 errors were transient
   JSDoc errors in the new file, fixed; the 525 remaining warnings are pre-existing, incl. 4 in untouched lines of
   `browse.ts`/`Profile.tsx` verified identical at HEAD via stdin linting).
5. `git diff` on `Profile.tsx` — ✅ only the two "View all" hunks changed; Contact Seller / Report Profile untouched.
   All touched files pass `prettier --check`.
