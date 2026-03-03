# Database Relationships

This document describes the relationships between tables in the AgriBid database.

## Entity Relationship Diagram

```text
┌─────────────────┐       ┌─────────────────┐
│     users       │       │    profiles     │
│  (Better Auth)  │◄──────│                 │
│                 │ 1:1   │ userId          │
└─────────────────┘       └────────┬────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│      bids       │ │    auctions     │ │   proxy_bids   │
│                 │ │                 │ │                 │
│ auctionId ◄──┐  │ │ sellerId ◄─────┼─┤│ auctionId       │
│ bidderId ──┘│  │ │ winnerId       │ ││ bidderId ◄──────┘
└─────────────┘  │ └────────┬────────┘ └─────────────────┘
                 │          │
                 │          │ 1:N
                 │          ▼
                 │ ┌─────────────────┐
                 │ │   watchlist     │
                 │ │                 │
                 │ │ auctionId       │
                 │ │ userId ◄────────┘
                 │ └─────────────────┘
                 │
                 ▼
┌─────────────────┐       ┌─────────────────┐
│  notifications │       │  readReceipts   │
│                 │◄──────│                 │
│ recipientId ───┼───────│ notificationId  │
│                 │ 1:N   │ userId          │
└────────┬────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│ supportTickets  │       │    auditLogs    │
│                 │       │                 │
│ userId ◄───────┼───────┤ adminId         │
│ auctionId (opt)│       │ targetId        │
└─────────────────┘       └─────────────────┘
```

> **Note:** This diagram shows primary relationships. Additional relationships are documented in the sections below.

## Relationship Details

### users (Better Auth) → profiles

**Relationship:** One-to-One (optional)

The `profiles` table extends the Better Auth user with application-specific data. Each auth user may have at most one profile.

- **Auth Side:** `users.id` → profiles via `userId` field
- **Profile Side:** Each profile has exactly one associated auth user

**Cardinality:** 1 : 0..1

---

### profiles → auctions (as Seller)

**Relationship:** One-to-Many

A user with role `seller` can create multiple auction listings.

- **Profile Side:** `sellerId` field in `auctions` references profile's `userId`
- **Auction Side:** Each auction has exactly one seller

**Cardinality:** 1 : 0..N

**Index Usage:** `by_seller`, `by_seller_status`

---

### profiles → auctions (as Winner)

**Relationship:** One-to-Many

A user can win multiple auctions as the highest bidder.

- **Profile Side:** `winnerId` field in `auctions` references profile's `userId`
- **Auction Side:** Each auction has exactly one optional winner (only if status is `sold`)

**Cardinality:** 1 : 0..N (profiles → auctions as Winner)

> **Note:** The `winnerId` field in the `auctions` table is optional (nullable), meaning an auction may have zero or one winner (0..1 cardinality on the auction side).

---

### profiles → bids

**Relationship:** One-to-Many

A user can place multiple bids across different auctions.

- **Profile Side:** `bidderId` field in `bids` references profile's `userId`
- **Bid Side:** Each bid is placed by exactly one user

**Cardinality:** 1 : 0..N

**Index Usage:** `by_bidder`

---

### auctions → bids

**Relationship:** One-to-Many

An auction can have multiple bids from various users.

- **Auction Side:** Primary entity
- **Bid Side:** `auctionId` field references auction

**Cardinality:** 1 : 0..N

**Index Usage:** `by_auction` (with timestamp for ordering)

---

### auctions → proxy_bids

**Relationship:** One-to-Many

An auction can have multiple proxy bid configurations from different users.

- **Auction Side:** Primary entity
- **Proxy Bid Side:** `auctionId` field references auction

**Cardinality:** 1 : 0..N

**Index Usage:** `by_auction`, `by_auction_maxBid`

---

### profiles → proxy_bids

**Relationship:** One-to-Many

A user can set up proxy bidding for multiple auctions.

- **Profile Side:** `bidderId` field references profile's `userId`
- **Proxy Bid Side:** Each proxy bid is for exactly one user

**Cardinality:** 1 : 0..N

**Index Usage:** `by_bidder_auction`

---

### profiles → watchlist

**Relationship:** One-to-Many

A user can watch multiple auctions.

- **Profile Side:** Primary entity
- **Watchlist Side:** `userId` field references profile's `userId`

**Cardinality:** 1 : 0..N

**Index Usage:** `by_user`

---

### watchlist → auctions

**Relationship:** Many-to-One

Each watchlist entry references exactly one auction.

- **Watchlist Side:** `auctionId` field references a single auction
- **Auction Side:** An auction can be watched by many users (0..N entries)

**Cardinality:** 0..N : 1 (watchlist : auctions)

**Index Usage:** `by_auction` (through auctions table)

---

### profiles → notifications

**Relationship:** One-to-Many

A user can receive multiple notifications.

- **Profile Side:** Primary entity
- **Notification Side:** `recipientId` field references profile's `userId` or holds the literal "all" for platform-wide announcements. This is a polymorphic reference managed at the application level and not enforced by a database foreign key constraint.

**Cardinality:** 1 : 0..N

**Index Usage:** `by_recipient`, `by_recipient_createdAt`

---

### notifications → readReceipts

**Relationship:** One-to-Many

A notification can be read by multiple users (for announcements).

- **Notification Side:** Primary entity
- **Receipt Side:** `notificationId` field references notification

**Cardinality:** 1 : 0..N

**Index Usage:** `by_notification`

---

### profiles → readReceipts

**Relationship:** One-to-Many

A user can mark multiple notifications as read.

- **Profile Side:** Primary entity
- **Receipt Side:** `userId` field references profile's `userId`

**Cardinality:** 1 : 0..N

**Index Usage:** `by_user_notification`

---

### profiles → supportTickets

**Relationship:** One-to-Many

A user can create multiple support tickets.

- **Profile Side:** Primary entity
- **Ticket Side:** `userId` field references profile's `userId`

**Cardinality:** 1 : 0..N

**Index Usage:** `by_user`, `by_user_updatedAt`

---

### auctions → supportTickets (optional)

**Relationship:** Zero-to-Many

A support ticket may be related to a specific auction.

- **Auction Side:** Optional referenced entity
- **Ticket Side:** `auctionId` field optionally references auction

**Cardinality:** 0..N : 0..1 (auctions : supportTickets)

---

### profiles → auditLogs

**Relationship:** One-to-Many

An admin user can perform multiple actions that are logged.

- **Profile Side:** Primary entity (must have role `admin`)
- **Audit Log Side:** `adminId` field references profile's `userId`

**Cardinality:** 1 : 0..N

**Index Usage:** `by_adminId`

---

## Foreign Key Summary

| Child Table | Parent Table | Field | Relationship Type |
|-------------|-------------|-------|-------------------|
| `auctions` | `profiles` | `sellerId` | Many-to-One |
| `auctions` | `profiles` | `winnerId` | Many-to-One (optional) |
| `bids` | `auctions` | `auctionId` | Many-to-One |
| `bids` | `profiles` | `bidderId` | Many-to-One |
| `proxy_bids` | `auctions` | `auctionId` | Many-to-One |
| `proxy_bids` | `profiles` | `bidderId` | Many-to-One |
| `watchlist` | `auctions` | `auctionId` | Many-to-One |
| `watchlist` | `profiles` | `userId` | Many-to-One |
| `notifications` | `profiles` | `recipientId` | Many-to-One (Application-level) |
| `readReceipts` | `notifications` | `notificationId` | Many-to-One |
| `readReceipts` | `profiles` | `userId` | Many-to-One |
| `supportTickets` | `profiles` | `userId` | Many-to-One |
| `supportTickets` | `auctions` | `auctionId` | Many-to-One (optional) |
| `auditLogs` | `profiles` | `adminId` | Many-to-One |

---

## Query Patterns

### Common Query Patterns

1. **Get user's active bids:**
   ```text
   profiles (userId) → bids (bidderId) → auctions (status = 'active')
   ```

2. **Get auction with all bids:**
   ```text
   auctions (id) → bids (auctionId) ordered by timestamp
   ```

3. **Get user's watchlist with auction details:**
   ```text
   profiles (userId) → watchlist (userId) → auctions (auctionId)
   ```

4. **Get notifications for user:**
   ```text
   profiles (userId) → notifications (recipientId) ordered by createdAt
   ```

5. **Get seller's auction statistics:**
   ```text
   profiles (userId) → auctions (sellerId) grouped by status
   ```

---

## Cascade Behaviors

Convex does not support foreign key constraints with automatic cascades. Application-level logic handles:

- **Deleting a user:** Requires manual deletion of related records (bids, watchlist, notifications, etc.)
- **Deleting an auction:** Requires manual deletion of related bids, proxy_bids, watchlist items, and support tickets
- **Voiding a bid:** Status is changed to `voided` rather than deleted to preserve audit trail

---

*Last Updated: 2026-03-02*
