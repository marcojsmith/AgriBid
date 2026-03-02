# Database Schema Documentation

This document describes the complete database schema for AgriBid, including all tables, fields, indexes, and relationships.

## Tables Overview

| Table Name | Description |
|------------|-------------|
| `equipmentMetadata` | Static lookup table for equipment makes and models |
| `auctions` | Core auction listings for farming equipment |
| `bids` | Bid records for all auction bidding activity |
| `proxy_bids` | Automated proxy bidding configurations |
| `profiles` | User profiles linking auth users to application metadata |
| `auditLogs` | Administrative action audit trail |
| `supportTickets` | User support ticket system |
| `notifications` | User notifications and announcements |
| `readReceipts` | Notification read status tracking |
| `watchlist` | User watchlist for auction monitoring |
| `counters` | Aggregated statistics counters |

---

## equipmentMetadata

Static lookup table containing equipment makes, models, and categories.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `make` | `string` | Yes | Equipment manufacturer name (e.g., "John Deere") |
| `models` | `string[]` | Yes | Array of model names for this make |
| `category` | `string` | Yes | Equipment category (e.g., "Tractor", "Combine") |

### Indexes

- `by_make`: Index on `make` field for fast lookups

---

## auctions

Core table for auction listings. Contains all equipment details, pricing, and auction lifecycle information.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Auction listing title |
| `make` | `string` | Yes | Equipment manufacturer |
| `model` | `string` | Yes | Equipment model name |
| `year` | `number` | Yes | Manufacturing year |
| `operatingHours` | `number` | Yes | Equipment operating hours |
| `location` | `string` | Yes | Equipment location |
| `reservePrice` | `number` | Yes | Seller's minimum acceptable price |
| `startingPrice` | `number` | Yes | Initial auction starting price |
| `currentPrice` | `number` | Yes | Current highest bid amount |
| `minIncrement` | `number` | Yes | Minimum bid increment amount |
| `startTime` | `number` (optional) | No | Auction start timestamp (Unix ms) |
| `endTime` | `number` (optional) | No | Auction end timestamp (Unix ms) |
| `durationDays` | `number` (optional) | No | Auction duration in days |
| `sellerId` | `string` | Yes | Auth user ID of the seller |
| `status` | `union` | Yes | Auction status: `draft`, `pending_review`, `active`, `sold`, `unsold`, `rejected` |
| `winnerId` | `string` (optional) | No | Auth user ID of winning bidder |
| `images` | `union` | Yes | Image storage IDs (object with front/engine/cabin/rear or legacy array) |
| `description` | `string` (optional) | No | Equipment description |
| `conditionReportUrl` | `string` (optional) | No | URL to condition report document |
| `isExtended` | `boolean` (optional) | No | Whether auction was extended due to soft close |
| `seedId` | `string` (optional) | No | Seed data identifier for development |
| `conditionChecklist` | `object` (optional) | No | Equipment condition checklist |

### Condition Checklist Structure

```typescript
{
  engine: boolean,
  hydraulics: boolean,
  tires: boolean,
  serviceHistory: boolean,
  notes?: string
}
```

### Indexes

- `by_status`: Filter auctions by status
- `by_seller`: Find auctions by seller
- `by_seller_status`: Find auctions by seller with specific status
- `by_end_time`: Find auctions ending soon
- `by_seedId`: Find seed data auctions
- `by_status_make`: Filter by status and make
- `by_status_year`: Filter by status and year
- `by_status_endTime`: Filter by status and end time
- `search_title`: Full-text search on title with status filter
- `search_make_model`: Full-text search on make with status/model filters

---

## bids

Immutable record of all bids placed on auctions.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auctionId` | `id("auctions")` | Yes | Reference to auction |
| `bidderId` | `string` | Yes | Auth user ID of bidder |
| `amount` | `number` | Yes | Bid amount |
| `timestamp` | `number` | Yes | Bid timestamp (Unix ms) |
| `status` | `union` (optional) | No | Bid integrity status: `valid`, `voided` |

### Indexes

- `by_auction`: Find bids by auction, sorted by timestamp
- `by_bidder`: Find bids by bidder
- `by_timestamp`: Sort all bids by timestamp

---

## proxy_bids

Automated proxy bidding configurations for users who want the system to bid on their behalf.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auctionId` | `id("auctions")` | Yes | Reference to auction |
| `bidderId` | `string` | Yes | Auth user ID of bidder |
| `maxBid` | `number` | Yes | Maximum amount the bidder is willing to pay |
| `updatedAt` | `number` | Yes | Last update timestamp |

### Indexes

- `by_auction`: Find proxy bids by auction
- `by_bidder_auction`: Find proxy bid by bidder and auction
- `by_auction_maxBid`: Find highest proxy bid for auction

---

## profiles

User application profiles linking auth users to role-based metadata. Contains KYC verification status and encrypted PII.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | Auth user ID |
| `role` | `union` | Yes | User role: `buyer`, `seller`, `admin` |
| `isVerified` | `boolean` | Yes | Whether user is verified |
| `kycStatus` | `union` (optional) | No | KYC status: `pending`, `verified`, `rejected` |
| `kycDocuments` | `id("_storage")[]` (optional) | No | KYC document storage IDs |
| `kycRejectionReason` | `string` (optional) | No | Reason for KYC rejection |
| `firstName` | `string` (optional) | No | Encrypted PII - First name |
| `lastName` | `string` (optional) | No | Encrypted PII - Last name |
| `idNumber` | `string` (optional) | No | Encrypted PII - ID number |
| `kycEmail` | `string` (optional) | No | Encrypted PII - Email |
| `bio` | `string` (optional) | No | User bio |
| `phoneNumber` | `string` (optional) | No | Encrypted PII - Phone number |
| `companyName` | `string` (optional) | No | Company name (for sellers) |
| `createdAt` | `number` | Yes | Profile creation timestamp |
| `updatedAt` | `number` | Yes | Last update timestamp |

### Indexes

- `by_userId`: Find profile by user ID
- `by_kycStatus`: Find profiles by KYC status
- `by_role`: Find profiles by role
- `by_isVerified`: Filter verified/unverified profiles

---

## auditLogs

Immutable audit trail for all administrative actions.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adminId` | `string` | Yes | Admin user ID performing action |
| `action` | `string` | Yes | Action type (e.g., "approve_kyc", "reject_listing") |
| `targetId` | `string` (optional) | No | ID of target entity |
| `targetType` | `string` (optional) | No | Type of target entity |
| `details` | `string` (optional) | No | Additional action details |
| `targetCount` | `number` (optional) | No | Count for bulk operations |
| `timestamp` | `number` | Yes | Action timestamp |

### Indexes

- `by_timestamp`: Sort all audit logs by time
- `by_adminId`: Find logs by admin

---

## supportTickets

User support ticket system for handling user inquiries.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | User ID creating ticket |
| `auctionId` | `id("auctions")` (optional) | No | Related auction (if applicable) |
| `subject` | `string` | Yes | Ticket subject |
| `message` | `string` | Yes | Ticket message |
| `status` | `union` | Yes | Ticket status: `open`, `resolved`, `closed` |
| `priority` | `union` | Yes | Priority: `low`, `medium`, `high` |
| `createdAt` | `number` | Yes | Creation timestamp |
| `updatedAt` | `number` | Yes | Last update timestamp |
| `resolvedBy` | `string` (optional) | No | Admin ID that resolved ticket |

### Indexes

- `by_status`: Find tickets by status
- `by_user`: Find tickets by user
- `by_updatedAt`: Sort by last update
- `by_user_updatedAt`: Find user's tickets sorted by update

---

## notifications

User notifications including announcements and personal alerts.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recipientId` | `string` | Yes | Recipient user ID ("all" for announcements) |
| `type` | `union` | Yes | Notification type: `info`, `success`, `warning`, `error` |
| `title` | `string` | Yes | Notification title |
| `message` | `string` | Yes | Notification message |
| `link` | `string` (optional) | No | Optional link for navigation |
| `isRead` | `boolean` | Yes | Read status |
| `createdAt` | `number` | Yes | Creation timestamp |

### Indexes

- `by_recipient`: Find notifications by recipient and read status
- `by_recipient_createdAt`: Sort recipient notifications by time
- `by_recipient_isRead_createdAt`: Complex index for filtering and sorting

---

## readReceipts

Tracks when users have read specific notifications.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | User who read the notification |
| `notificationId` | `id("notifications")` | Yes | Reference to notification |
| `readAt` | `number` | Yes | Timestamp when read |

### Indexes

- `by_user_notification`: Find receipt by user and notification
- `by_notification`: Find all receipts for a notification

---

## watchlist

User's saved auctions for monitoring.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | User ID |
| `auctionId` | `id("auctions")` | Yes | Watched auction |

### Indexes

- `by_user`: Find all watchlist items for user
- `by_user_auction`: Unique index per user-auction pair

---

## counters

Aggregated statistics counters for dashboard and analytics.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Counter name (e.g., "auctions", "profiles") |
| `total` | `number` | Yes | Total count |
| `active` | `number` (optional) | No | Active count |
| `pending` | `number` (optional) | No | Pending count |
| `verified` | `number` (optional) | No | Verified count |
| `open` | `number` (optional) | No | Open count |
| `resolved` | `number` (optional) | No | Resolved count |
| `updatedAt` | `number` | Yes | Last update timestamp |

### Indexes

- `by_name`: Find counter by name

---

## Data Types Reference

### Status Enums

**Auction Status:**
- `draft` - Created but not submitted for review
- `pending_review` - Submitted, awaiting admin approval
- `active` - Live and accepting bids
- `sold` - Won by highest bidder (reserve met)
- `unsold` - Ended without meeting reserve
- `rejected` - Rejected by admin

**Bid Status:**
- `valid` - Active valid bid
- `voided` - Bid has been voided

**KYC Status:**
- `pending` - Under review
- `verified` - Approved
- `rejected` - Rejected

**Support Ticket Status:**
- `open` - Awaiting resolution
- `resolved` - Resolved by admin
- `closed` - Closed by user or system

**Notification Type:**
- `info` - Informational
- `success` - Success message
- `warning` - Warning message
- `error` - Error message

**User Role:**
- `buyer` - Can bid on auctions
- `seller` - Can create listings
- `admin` - Full platform access

---

*Last Updated: 2026-03-02*
*Source: `app/convex/schema.ts`*
