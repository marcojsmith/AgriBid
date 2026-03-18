# Bidding Data Flow

This document describes the bidding system architecture, data flows, and processes in AgriBid.

## Bidding Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ BiddingPanel │    │   BidForm    │  │ BidHistory   │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
└─────────┼───────────────────┼───────────────────┼───────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Convex Mutations                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              app/convex/auctions/bidding.ts          │  │
│  │                                                      │  │
│  │  • placeBid()                                        │  │
│  │  • placeProxyBid()                                   │  │
│  │  • cancelProxyBid()                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Database                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │   auctions   │    │     bids      │   │ proxy_bids │  │
│  │  (current)   │    │  (history)   │   │ (automated)│  │
│  └──────────────┘    └──────────────┘    └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Bid Placement Flow

### Manual Bidding

```text
User Views Auction Detail
           │
           ▼
    Checks Current Price
    + Minimum Increment
           │
           ▼
    Enters Bid Amount
           │
           ▼
    Clicks "Place Bid"
           │
           ▼
    BidConfirmation Modal
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
 Confirm     Cancel
     │           │
     ▼           ▼
 Submit Bid   Return
     │
     ▼
┌─────────────────────────────┐
│   Convex placeBid()        │
│                             │
│  1. Validate auction active │
│  2. Validate bid >= minimum │
│  3. Validate not self-bid   │
│  4. Check proxy bids        │
│  5. Update auction price    │
│  6. Handle soft close      │
│  7. Record bid in history  │
│  8. Trigger notifications  │
└─────────────────────────────┘
           │
           ▼
    Update UI (real-time)
           │
           ▼
    Show Success/Error
```

### Core Bidding Mutation

```typescript
// app/convex/auctions/bidding.ts

export const placeBid = mutation({
  args: {
    auctionId: v.id("auctions"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const { profile, userId } = await requireProfile(ctx);

    // 2. Get auction
    const auction = await ctx.db.get(args.auctionId);

    // 3. Validate auction is active
    if (auction.status !== "active") {
      throw new Error("Auction is not active");
    }

    // 4. Calculate minimum bid
    const minBid = auction.currentPrice + auction.minIncrement;
    if (args.amount < minBid) {
      throw new Error(`Minimum bid is ${minBid}`);
    }

    // 5. Prevent self-bidding
    if (auction.sellerId === userId) {
      throw new Error("Cannot bid on your own auction");
    }

    // 6. Check for proxy bids
    const proxyBids = await ctx.db
      .query("proxy_bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .collect();

    // ... proxy bid processing

    // 7. Handle soft close
    const now = Date.now();
    const timeRemaining = (auction.endTime || 0) - now;
    const SOFT_CLOSE_THRESHOLD = 120000; // 2 minutes

    const newEndTime =
      timeRemaining < SOFT_CLOSE_THRESHOLD
        ? now + SOFT_CLOSE_THRESHOLD
        : auction.endTime;

    // 8. Update auction
    await ctx.db.patch(args.auctionId, {
      currentPrice: args.amount,
      endTime: newEndTime,
      isExtended: timeRemaining < SOFT_CLOSE_THRESHOLD,
    });

    // 9. Record bid
    await ctx.db.insert("bids", {
      auctionId: args.auctionId,
      bidderId: userId,
      amount: args.amount,
      timestamp: now,
      status: "valid",
    });

    // 10. Create notification for outbid user
    // ... notification logic
  },
});
```

---

## Soft Close Mechanism

### Anti-Sniping Logic

The soft close feature extends auctions by 2 minutes if a bid is placed in the final 2 minutes.

```text
┌─────────────────────────────────────────┐
│         Auction End Time                 │
│                                         │
│    ┌─────────────────────────────────┐   │
│    │                                 │   │
│    │      Normal Bidding            │   │
│    │      (0 - 2 min remaining)      │   │
│    │                                 │   │
│    └─────────────────────────────────┘   │
│                   │                        │
│                   ▼                        │
│    ┌─────────────────────────────────┐   │
│    │     Final 2 Minutes             │   │
│    │     (timeRemaining < 2 min)    │   │
│    └─────────────────────────────────┘   │
│                   │                        │
│        ┌─────────┴─────────┐               │
│        ▼                   ▼               │
│   No New Bid           New Bid             │
│        │                   │               │
│        ▼                   ▼               │
│   Auction Ends      Extend +2 min          │
│                          │                 │
│                          ▼                 │
│                    Check Again             │
│                    (loop continues)        │
└─────────────────────────────────────────┘
```

### Implementation Details

- **Threshold**: 120,000ms (2 minutes)
- **Extension**: Adds 120,000ms to current time
- **Flag**: `isExtended` field tracks if soft close occurred
- **Cron Job**: Settles expired auctions every minute

---

## Proxy Bidding

### Overview

Proxy bidding allows users to set a maximum amount they're willing to pay. The system automatically bids on their behalf up to their maximum.

### Flow

```text
User Sets Maximum Bid (Proxy Bid)
           │
           ▼
    Save Proxy Bid Config
    (auctionId, bidderId, maxBid)
           │
           ▼
    ┌─────────────────────────────┐
    │ When Another Bid is Placed │
    └─────────────────────────────┘
           │
           ▼
    Check for Proxy Bids
    (sorted by maxBid descending)
           │
           ▼
    ┌───────────────────────────────────┐
    │ Is There a Higher Proxy Bid?      │
    └───────────────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
    Yes         No
     │           │
     ▼           ▼
┌────────────────────┐
│ Auto-Place Bid    │
│ at:               │
│ min(otherBid +    │
│  minIncrement,    │
│  proxyMaxBid)     │
└────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ If proxyBid.maxBid reached:     │
│ Notify user they were outbid    │
│ at their maximum               │
└──────────────────────────────────┘
```

### Proxy Bid Mutation

```typescript
export const placeProxyBid = mutation({
  args: {
    auctionId: v.id("auctions"),
    maxBid: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile, userId } = await requireProfile(ctx);

    // Validate auction exists and is active
    // Validate maxBid >= currentPrice + minIncrement

    // Upsert proxy bid
    const existing = await ctx.db
      .query("proxy_bids")
      .withIndex("by_bidder_auction", (q) =>
        q.eq("bidderId", userId).eq("auctionId", args.auctionId)
      )
      .unique();

    if (existing) {
      // Update if new max is higher
      if (args.maxBid > existing.maxBid) {
        await ctx.db.patch(existing._id, {
          maxBid: args.maxBid,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("proxy_bids", {
        auctionId: args.auctionId,
        bidderId: userId,
        maxBid: args.maxBid,
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## Auction Settlement

### Cron Job Process

```text
Scheduled Function (every 1 minute)
           │
           ▼
    Query Active Auctions
    where endTime < now
           │
           ▼
    For Each Expired Auction:
           │
           ├────────────────────┐
           ▼                    ▼
    Has Bids?            No Bids?
           │                    │
           ▼                    ▼
    Reserve Met?         Status: unsold
    │                    │
    ├────┐               │
    ▼    ▼               ▼
   Yes   No          ┌─────────────────┐
    │    │           │ Notify Seller   │
    ▼    ▼           └─────────────────┘
Status: Status:
sold   unsold
    │               │
    ▼               ▼
┌─────────────────────────┐
│ • Set winnerId         │
│ • Set status: sold     │
│ • Notify winner        │
│ • Notify seller        │
└─────────────────────────┘
```

### Settlement Implementation

```typescript
// app/convex/auctions/internal.ts

export const settleExpiredAuctions = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Find all active auctions that have ended
    const expiredAuctions = await ctx.db
      .query("auctions")
      .withIndex("by_status_endTime", (q) =>
        q.eq("status", "active").lt("endTime", now)
      )
      .collect();

    for (const auction of expiredAuctions) {
      // Get highest bid
      const highestBid = await ctx.db
        .query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .order("desc")
        .first();

      if (highestBid && auction.currentPrice >= auction.reservePrice) {
        // Sold
        await ctx.db.patch(auction._id, {
          status: "sold",
          winnerId: highestBid.bidderId,
        });

        // Notify winner and seller
        await createNotification(
          auction.sellerId,
          "success",
          "Your item sold!",
          `Sold for ${auction.currentPrice}`
        );
        await createNotification(
          highestBid.bidderId,
          "success",
          "You won!",
          `Won for ${auction.currentPrice}`
        );
      } else {
        // Unsold
        await ctx.db.patch(auction._id, {
          status: "unsold",
        });

        // Notify seller
        await createNotification(
          auction.sellerId,
          "info",
          "Auction ended",
          "Your item did not meet reserve"
        );
      }
    }
  },
});
```

---

## Bid History & Audit

### Bid Recording

All bids are recorded in the `bids` table with:

- `auctionId`: Reference to auction
- `bidderId`: User who placed bid
- `amount`: Bid amount
- `timestamp`: Unix timestamp
- `status`: `valid` or `voided`

### Voiding Bids

In cases requiring bid voiding (e.g., fraud detection):

- Bid status changed to `voided` rather than deleted
- Maintains audit trail
- Auction price recalculated if needed

---

## Real-Time Updates

### Frontend Subscription

```typescript
// React component using Convex hooks
const auction = useQuery("auctions:get", { auctionId });

const bids = useQuery("bids:getByAuction", { auctionId });

// Real-time updates automatically
// when bids change
```

### Notification System

When a bid is placed:

1. Check previous highest bidder
2. Create notification for outbid user
3. Notification appears in real-time via Convex

---

_Last Updated: 2026-03-02_
