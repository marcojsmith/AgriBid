# Specification: My Bids Page - Group Bids by Auction

## Overview
The "My Bids" page currently displays each bid as an individual card, which results in duplicate auction listings for users who have bid multiple times on the same item. This track aims to refactor both the backend query and frontend display to group bids by auction, showing the user's highest bid per auction and clear status indicators (Winning, Outbid, Won, Lost, Cancelled).

## User Stories
- As a **Buyer**, I want to see a single card for each auction I've bid on, so I can easily track my status without clutter.
- As a **Buyer**, I want to see my highest bid and the total number of times I've bid on an item.
- As a **Buyer**, I want to quickly see if I am currently winning or if I've been outbid, with a clear action to raise my bid if needed.

## Functional Requirements

### Backend (Convex)
- Modify `getMyBids` query in `app/convex/auctions/queries.ts`.
- Group bids by `auctionId` for the current user.
- For each auction, return:
  - `auction`: A summary object containing `title`, `images`, `currentPrice`, `endTime`, `status`.
  - `myHighestBid`: The highest amount the user has bid on this auction.
  - `bidCount`: Total number of bids placed by the user on this auction.
  - `isWinning`: Boolean (True if user's highest bid == auction's currentPrice AND auction.winnerId matches the user ID. In case of identical bid amounts, the earliest bid wins the tie).
  - `isWon`: Boolean (True if auction status is 'sold' and user is the winner).
  - `isOutbid`: Boolean (True if the auction is active and user is not the current winner).
  - `isCancelled`: Boolean (True if auction status is 'rejected' or 'unsold').

### Frontend (React)
- Update `app/src/pages/dashboard/MyBids.tsx` to handle the new grouped data structure.
- **Dashboard Summary**: Add a top section showing:
  - Total active bids.
  - Winning count.
  - Outbid count.
  - Total exposure: Sum of `myHighestBid` for all active auctions where the user is currently winning (`isWinning` is true).
- **Auction Cards**:
  - Display one card per auction in a compact horizontal layout.
  - Show countdown timer for active auctions.
  - Add status badges with color coding:
    - **Winning**: Blue (Active)
    - **Outbid**: Red (Active)
    - **Won**: Green (Success)
    - **Cancelled**: Warning/Yellow
  - **Quick Action**: "Raise Bid" button for outbid auctions.
- **Sorting/Filtering**:
  - Default sort: Ending Soon (Active auctions first, sorted by end time ascending).
  - Filter by status (All, Winning, Outbid, Ended).

## Non-Functional Requirements
- **Performance**: Optimized grouping query using indexes to minimize latency.
- **Consistency**: Status colors should match the existing platform theme.
- **Responsiveness**: Ensure the "My Bids" grid and dashboard summary are mobile-friendly.

## Acceptance Criteria
- "My Bids" page shows exactly one card per auction.
- `OUTBID` status is clearly visible on relevant cards.
- "Raise Bid" button triggers an inline bidding interface.
- Dashboard summary correctly calculates active bids, winning count, and total exposure.
- Filtering by status works as expected.

## Out of Scope
- Detailed bid history for each auction (available on the auction detail page).
- Notification settings for outbid events (handled by a separate track).
