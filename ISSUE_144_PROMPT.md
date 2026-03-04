# Issue #144: My Bids Page - Group Bids by Auction

## Issue Summary
The My Bids page currently shows each bid as a separate card, causing duplicate listings of the same auction item. Users see the same item appearing multiple times (e.g., "Case IH Magnum 380" appears 5-6 times).

## Root Cause
The backend query `getMyBids` in `app/convex/auctions/queries.ts` (lines ~405-481) returns all bids individually, but the frontend should display one card per auction with the user's highest bid.

## Requirements

### 1. Backend Changes
**File:** `app/convex/auctions/queries.ts`

Modify the `getMyBids` query to:
- Group bids by auction ID (use the existing `by_bidder_auction` index)
- Return only the user's highest bid per auction
- Include auction end time for countdown display
- Include bid count per auction (how many times user bid)

**Expected return shape:**
```typescript
{
  auction: AuctionSummary,
  myHighestBid: number,
  bidCount: number,
  endTime: number,
  isWinning: boolean,
  isWon: boolean,
  isOutbid: boolean,  // NEW: explicit outbid status
}
```

### 2. Frontend Changes
**File:** `app/src/pages/dashboard/MyBids.tsx`

- Update to handle new data structure (one card per auction)
- Add auction end time with countdown timer
- Add OUTBID status badge (currently missing - critical)
- Add status summary dashboard at top:
  - Total active bids
  - Winning count
  - Outbid count
  - Total exposure (sum of winning bid amounts)
- Add sorting/filtering by status (Winning/Active/Outbid/Ended)
- Fix card layout to be less image-heavy and more information-dense

### 3. UI/UX Improvements
- Add visual hierarchy: Winning (green), Outbid (red), Active (grey)
- Add "Raise Bid" quick action button on outbid cards
- Add bid count indicator on each card
- Show next bid increment needed to win

## Files to Modify
1. `app/convex/auctions/queries.ts` - `getMyBids` query
2. `app/src/pages/dashboard/MyBids.tsx` - Frontend component

## Testing
- Verify bids group correctly (one card per auction)
- Verify OUTBID status displays correctly
- Verify auction end times show countdown
- Verify sorting/filtering works

## Notes
- Worktree: `../AgriBid-144`
- Branch: `feature/issue-144-my-bids-grouping`
- The icon change (wrench → hammer) is low priority
