# Watchlist Functionality Plan

This track implements user-specific auction tracking (Watchlist) to complete the "User Engagement" loop.

## Phase 1: Database Schema
- [x] Define `watchlist` table in `convex/schema.ts` with fields:
    - `userId` (string)
    - `auctionId` (Id<"auctions">)
    - Compound index `by_user_auction` for efficient lookups.
    - Index `by_user` for list retrieval.
- [x] Implement `isWatched` query: Check if the current user is watching a specific auction.
- [x] Implement `toggleWatchlist` mutation: Add/remove an entry for the user.
- [x] Implement `getUserWatchlist` query: Return auctions watched by the user (fetching auction data via `Promise.all` or `db.get`).

## Phase 2: UI Integration
- [x] **AuctionCard**: Add a "Heart" icon button.
    - Only show filled/active if authenticated and `isWatched` is true.
    - Clicking toggles state (optimistic update).
    - Unauthenticated click redirects to login (already handled by `AuctionCard` logic, verify).
- [x] **AuctionDetail**: Add a prominent "Watch / Unwatch" button in the `BiddingPanel` or header.
- [x] **Watchlist Page**: Update `app/src/pages/Watchlist.tsx`.
    - Fetch user's watched auctions using `getUserWatchlist`.
    - Render grid of `AuctionCard`s or a list view.
    - Show loading/empty states.

## Phase 3: Integration & Testing
- [x] Verify functionality with `RoleProtectedRoute` and `Header` link.
- [x] Add tests for `isWatched` query and `toggleWatchlist` mutation.
- [x] Add integration tests for `Watchlist.tsx` page rendering and `AuctionCard` interactions.

## Phase 4: Security & Quality Hardening (Completed)
- [x] Implement `isValidCallbackUrl` utility to prevent open redirect vulnerabilities.
- [x] Refactor all UI tests to use `MemoryRouter` for better routing isolation.
- [x] Fix `useQuery` test mocks to return correct data types (booleans/arrays) instead of functions.
- [x] Improve Heart icon visibility for better UX on light backgrounds.
