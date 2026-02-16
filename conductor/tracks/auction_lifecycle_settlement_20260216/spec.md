# Auction Lifecycle & Settlement Specification

## User Story
As a seller, I want my auctions to automatically close and declare a winner once the time is up, so I can finalize the sale. 
As a buyer, I want to know if I won an auction immediately after it ends.

## Functional Requirements
- **Automated Settlement**:
    - The system must check for expired auctions every 60 seconds.
    - An auction is "Sold" if it has at least one bid AND the `currentPrice` is greater than or equal to the `reservePrice`.
    - If no bids are placed or the reserve is not met, the auction is "Unsold".
- **Equipment Descriptions**:
    - Users must be able to enter a rich text or plain text description during the Sell flow.
    - This description must be displayed on the Auction Detail page.
- **Dashboards**:
    - Users need a central place to see "Auctions I'm Bidding On" and "Auctions I've Won/Lost".
    - Sellers need to see "My Active Listings" and "Settled Items".

## Database Changes
- **auctions**:
    - Add `description: v.string()`.
- **new table: notifications** (optional, for later):
    - `userId`, `message`, `type`, `isRead`.

## API Specification
- **Internal Mutation**: `settleExpiredAuctions()`
    - Logic:
      ```ts
      const expired = db.query("auctions").withIndex("by_status", q => q.eq("status", "active")).collect().filter(a => a.endTime <= Date.now());
      for (const a of expired) {
        const bids = db.query("bids").withIndex("by_auction", q => q.eq("auctionId", a._id)).collect();
        const hasReserveMet = a.currentPrice >= a.reservePrice;
        const status = (bids.length > 0 && hasReserveMet) ? "sold" : "unsold";
        db.patch(a._id, { status });
      }
      ```
- **Query**: `getMyBids()`
    - Unique list of auctions where the current user has placed at least one bid.

## Acceptance Criteria
- [ ] Auctions automatically move to `sold` or `unsold` within 1 minute of expiring.
- [ ] The Home page only shows `active` auctions.
- [ ] Users can enter custom descriptions in the `ListingWizard`.
- [ ] The "My Bids" and "My Listings" pages correctly display filtered auction data.
