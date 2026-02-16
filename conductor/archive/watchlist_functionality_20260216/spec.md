# Watchlist Functionality Specification

## User Story
As a user, I want to keep track of auctions I'm interested in by adding them to a "Watchlist" so I can easily return to them and monitor their status.

## Functional Requirements
- **Watch/Unwatch**:
    - Users can toggle a "Watch" state on any active auction.
    - If the user is unauthenticated, clicking "Watch" redirects to login.
    - If the user is authenticated, the state toggles immediately (optimistic update).
- **View Watchlist**:
    - Authenticated users can view a list of all watched auctions on the `/watchlist` page.
    - The list displays essential auction details (image, title, current bid, time remaining).
    - Clicking an item navigates to the Auction Detail page.
    - Empty state: "You are not watching any auctions yet. Explore the Marketplace."

## Database Schema
- **watchlist**:
    - `userId` (string): The ID of the watching user.
    - `auctionId` (Id<"auctions">): The ID of the watched auction.
    - Index: `by_user_auction` (userId, auctionId) - used for efficient lookup (uniqueness enforced by application logic).
    - Index: `by_user` (userId) - list retrieval.

## API Specification
- **Mutation**: `toggleWatchlist(auctionId: Id<"auctions">)`
    - Checks if `userId` matches current session (via `auth.ts` or `ctx.auth`).
    - Checks if entry exists for `(userId, auctionId)`.
    - If exists -> DELETE.
    - If not exists -> INSERT.
    - Returns: boolean (new watched state: true/false).
- **Query**: `isWatched(auctionId: Id<"auctions">)`
    - Returns: boolean (true if watched by current user).
- **Query**: `getUserWatchlist()`
    - Returns: Array of `Auction` objects (joined data).
    - Implementation detail: Fetch all `watchlist` entries for user, then fetch associated `auctions` via `Promise.all(ids.map(id => db.get(id)))`. Filter out nulls (deleted auctions).

## UI Requirements
- **AuctionCard**:
    - Add a "Heart" icon button in the top-right corner or footer.
    - State: Filled (watched) vs Outline (unwatched).
    - Color: Primary/Red when watched. Muted when unwatched.
- **AuctionDetail**:
    - Add a "Watch this Auction" button (with Heart icon) in the `BiddingPanel` or header.
- **Watchlist Page**:
    - Grid of `AuctionCard` components.
    - Loading skeleton while fetching.
    - Error state if fetch fails.
    - Empty state if list is empty.

## Acceptance Criteria
- [ ] Clicking the heart on an auction card toggles its state and updates the database.
- [ ] Navigating to `/watchlist` shows the user's watched auctions.
- [ ] Unauthenticated users are redirected to login when clicking "Watch".
- [ ] Removing an item from the watchlist updates the UI immediately.
- [ ] "My Watchlist" link in the header works for authenticated users.
