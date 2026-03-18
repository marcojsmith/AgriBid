# Plan: Proxy Bidding (Auto-bid System)

This track implements a proxy bidding system where users can set a maximum bid, and the system automatically increments their bid to maintain their lead.

## Phase 1: Schema & Backend Logic

- [ ] 1. Update `app/convex/schema.ts` to include `maxBid` and `autoBidEnabled` fields in the `bids` or `auctions` related logic.
- [ ] 2. Create `app/convex/auctions/proxy_bidding.ts` to handle the logic for calculating the next bid increment.
- [ ] 3. Update `placeBid` mutation in `app/convex/auctions/mutations.ts` to trigger proxy bidding checks when a new bid is placed.
- [ ] 4. Implement logic to prevent self-outbidding and handle ties (first bidder wins).

## Phase 2: Frontend Implementation

- [ ] 5. Update `AuctionDetail` page to include a "Set Max Bid" input field in the bidding panel.
- [ ] 6. Implement a toggle or checkbox for "Enable Auto-bid".
- [ ] 7. Add validation to ensure max bid is at least the current minimum required amount.
- [ ] 8. Update the bidding status UI to show if the user's current lead is via a proxy bid.

## Phase 3: Testing & Verification

- [ ] 9. Write unit tests for proxy increment logic (Vitest).
- [ ] 10. Perform integration tests for competing proxy bids.
- [ ] 11. Verify soft-close logic still functions correctly with proxy bids.
- [ ] 12. Run lint and build to ensure project standards.
