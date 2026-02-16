# Auction Lifecycle & Settlement Plan

This track completes the "Bidding Engine" loop by handling the finalization of auctions.

## Phase 1: Settlement & Schema
- [ ] Add `description` (v.string) to `auctions` table in `convex/schema.ts`.
- [ ] Implement `settleExpiredAuctions` internal mutation:
    - Queries for `active` auctions where `endTime <= now()`.
    - For each: Checks if `currentPrice >= reservePrice`.
    - Updates status to `sold` or `unsold`.
- [ ] Set up `convex/crons.ts` to run settlement every minute.
- [ ] Update `ListingWizard` to collect and save the equipment description.

## Phase 2: Buyer & Seller Dashboards
- [ ] Implement `getMyBids` query: Join `bids` and `auctions` to show user's activity.
- [ ] Implement `getMyListings` query: Show user's equipment (Draft, Active, Sold, Unsold).
- [ ] Create `/dashboard/bids` and `/dashboard/listings` pages.
- [ ] Update `Header.tsx` dropdown to replace "Coming Soon" with active links.

## Phase 3: Notifications & UI Polish
- [ ] Show "Winning Bidder" and "Winner Found" badges on settled auctions.
- [ ] Add toast notifications for users when an auction they are watching or bidding on ends.
