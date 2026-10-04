# Database Schema Documentation

This document describes the complete database schema for AgriBid, including all tables, fields, indexes, and relationships.

## Tables Overview

| Table Name          | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `equipmentCategories` | Equipment category lookup (e.g., Tractor, Combine) |
| `equipmentMetadata` | Static lookup table for equipment makes and models       |
| `auctions`          | Auction containers with time windows and fee defaults    |
| `lots`              | Individual equipment listings within auctions            |
| `lotFlags`          | Community moderation flags on lots                       |
| `profileFlags`      | Community moderation flags on profiles                  |
| `reviews`           | Seller reviews from auction winners                     |
| `bids`              | Bid records for all bidding activity                    |
| `bidCooldowns`      | Per-user bid cooldown state                             |
| `proxy_bids`        | Automated proxy bidding configurations                   |
| `profiles`          | User profiles linking auth users to application metadata |
| `auditLogs`         | Administrative action audit trail                        |
| `supportTickets`    | User support ticket system                               |
| `notifications`     | User notifications and announcements                     |
| `readReceipts`      | Notification read status tracking                        |
| `userActivity`      | Per-user activity feed entries                          |
| `conversations`     | Two-party buyer/seller messaging                        |
| `messages`          | Individual messages within conversations                 |
| `watchlist`         | User watchlist for lot monitoring                       |
| `presence`          | Real-time user presence tracking                        |
| `userPreferences`   | Per-user UI and notification preferences                |
| `counters`          | Aggregated statistics counters                           |
| `settings`          | Global application configuration                         |
| `faqItems`          | Public FAQ items managed by admins                      |
| `platformFees`      | Platform fee configuration                              |
| `lotFees`           | Fee ledger per lot at settlement                        |
| `errorReports`      | Error reports queued for GitHub issues                  |

---

## equipmentCategories

Equipment category lookup table.

### Fields

| Field      | Type      | Required | Description                    |
| ---------- | --------- | -------- | ------------------------------ |
| `name`     | `string`  | Yes      | Category name (e.g., "Tractor") |
| `isActive` | `boolean` | Yes      | Whether category is active     |

### Indexes

- `by_name`: Index on `name` field

---

## equipmentMetadata

Static lookup table containing equipment makes, models, and categories.

### Fields

| Field        | Type                   | Required | Description                                      |
| ------------ | ---------------------- | -------- | ------------------------------------------------ |
| `make`       | `string`               | Yes      | Equipment manufacturer name (e.g., "John Deere") |
| `models`     | `string[]`             | Yes      | Array of model names for this make               |
| `categoryId` | `id("equipmentCategories")` (optional) | No | Reference to equipment category |
| `category`   | `string` (optional)    | No       | Legacy category field                            |
| `isActive`   | `boolean` (optional)   | No       | Whether this make is active                      |
| `updatedAt`  | `number` (optional)    | No       | Last update timestamp                            |

### Indexes

- `by_make`: Index on `make` field
- `by_category`: Index on `categoryId` field

---

## auctions

Auction containers with time windows and default fee settings.

### Fields

| Field                   | Type                              | Required | Description                                          |
| ----------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `title`                 | `string`                          | Yes      | Auction title                                        |
| `description`           | `string` (optional)               | No       | Auction description                                   |
| `bannerImage`           | `id("_storage")` (optional)       | No       | Banner image storage ID                              |
| `startTime`             | `number`                          | Yes      | Auction start timestamp (Unix ms)                    |
| `endTime`               | `number`                          | Yes      | Auction end timestamp (Unix ms)                      |
| `status`                | `union`                           | Yes      | Status: `draft`, `published`, `closed`               |
| `defaultBuyerPremiumPct`  | `number` (optional)             | No       | Default buyer premium percentage                     |
| `defaultSellerCommissionPct` | `number` (optional)          | No       | Default seller commission percentage                  |
| `createdBy`             | `string`                          | Yes      | Admin userId who created the auction                  |
| `createdAt`             | `number`                          | Yes      | Creation timestamp                                    |
| `updatedAt`             | `number`                          | Yes      | Last update timestamp                                 |

### Indexes

- `by_status`: Filter by status
- `by_startTime`: Sort by start time
- `by_status_startTime`: Composite index for status + start time
- `search_title`: Full-text search on title with status filter

---

## lots

Individual equipment listings within auctions.

### Fields

| Field                      | Type                              | Required | Description                                          |
| -------------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `title`                    | `string`                          | Yes      | Lot title                                            |
| `make`                     | `string`                          | Yes      | Equipment manufacturer                                |
| `model`                    | `string`                          | Yes      | Equipment model name                                  |
| `year`                     | `number`                          | Yes      | Manufacturing year                                    |
| `operatingHours`           | `number`                          | Yes      | Equipment operating hours                             |
| `location`                 | `string`                          | Yes      | Equipment location                                    |
| `categoryId`               | `id("equipmentCategories")` (optional) | No | Reference to category |
| `reservePrice`             | `number`                          | Yes      | Seller's minimum acceptable price                     |
| `startingPrice`            | `number`                          | Yes      | Initial starting price                                |
| `currentPrice`             | `number`                          | Yes      | Current highest bid amount                            |
| `minIncrement`             | `number`                          | Yes      | Minimum bid increment                                 |
| `settledAt`                | `number` (optional)               | No       | When the lot was settled (sold/unsold)               |
| `durationDays`             | `number` (optional)               | No       | Auction duration in days                              |
| `sellerId`                 | `string`                          | Yes      | Auth user ID of the seller                             |
| `status`                   | `union`                           | Yes      | Status: `draft`, `pending_review`, `approved`, `assigned`, `sold`, `unsold`, `rejected` |
| `auctionId`                | `id("auctions")` (optional)       | No       | Parent auction reference                              |
| `extendedEndTime`          | `number` (optional)               | No       | Soft close extension time                             |
| `resolvedBuyerPremiumPct`  | `number` (optional)               | No       | Snapshot of buyer premium at assignment              |
| `resolvedSellerCommissionPct` | `number` (optional)            | No       | Snapshot of seller commission at assignment          |
| `winnerId`                 | `string` or `null` (optional)     | No       | Winning bidder userId                                 |
| `images`                   | `union`                           | Yes      | Image storage IDs (object with slots or legacy array) |
| `description`              | `string` (optional)               | No       | Equipment description                                  |
| `conditionReportUrl`       | `id("_storage")` (optional)       | No       | PDF condition report storage ID                       |
| `isExtended`              | `boolean` (optional)              | No       | Whether soft close was triggered                       |
| `hiddenByFlags`            | `boolean` (optional)              | No       | Whether hidden due to flags                           |
| `seedId`                   | `string` (optional)               | No       | Seed data identifier                                  |
| `conditionChecklist`       | `object` (optional)               | No       | Equipment condition checklist                         |

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

### Image Structure

```typescript
// Current format
{
  front?: string,      // storageId
  engine?: string,
  cabin?: string,
  rear?: string,
  additional?: string[]
}
// Or legacy format
string[]  // array of storageIds
```

### Indexes

- `by_status`: Filter by status
- `by_seller`: Find lots by seller
- `by_seller_status`: Composite index for seller + status
- `by_category`: Filter by category
- `by_seedId`: Find seed data lots
- `by_status_make`: Composite for status + make filtering
- `by_status_year`: Composite for status + year filtering
- `by_status_settledAt`: Composite for settled lot queries
- `by_auctionId`: Find lots by auction
- `by_status_auctionId`: Composite for status + auction
- `search_title`: Full-text search on title with status filter
- `search_title_simple`: Simple full-text search on title
- `search_make_model`: Full-text search on make with status/model filters

---

## lotFlags

Community moderation flags on lots.

### Fields

| Field        | Type                         | Required | Description                                          |
| ------------ | ---------------------------- | -------- | ---------------------------------------------------- |
| `lotId`      | `id("lots")`                 | Yes      | Reference to flagged lot                              |
| `reporterId` | `string`                     | Yes      | User ID of reporter                                   |
| `reason`     | `union`                      | Yes      | Reason: `misleading`, `inappropriate`, `suspicious`, `other` |
| `details`    | `string` (optional)          | No       | Additional details                                    |
| `status`     | `union`                      | Yes      | Status: `pending`, `reviewed`, `dismissed`            |
| `createdAt`   | `number`                     | Yes      | Creation timestamp                                    |

### Indexes

- `by_lot`: Find flags by lot
- `by_reporter`: Find flags by reporter
- `by_status`: Filter by status
- `by_lot_status`: Composite for lot + status

---

## profileFlags

Community moderation flags on profiles.

### Fields

| Field           | Type                | Required | Description                                          |
| --------------- | ------------------- | -------- | ---------------------------------------------------- |
| `reportedUserId` | `string`           | Yes      | User ID of reported profile                           |
| `reporterId`    | `string`            | Yes      | User ID of reporter                                   |
| `reason`        | `union`             | Yes      | Reason: `fake_account`, `fraudulent_listings`, `abusive_behaviour`, `identity_misrepresentation`, `other` |
| `details`       | `string` (optional) | No       | Additional details                                    |
| `status`        | `union`             | Yes      | Status: `pending`, `reviewed`, `dismissed`            |
| `adminNotes`    | `string` (optional) | No       | Admin notes on resolution                             |
| `createdAt`     | `number`            | Yes      | Creation timestamp                                    |

### Indexes

- `by_reported_user`: Find flags by reported user
- `by_reporter`: Find flags by reporter
- `by_status`: Filter by status
- `by_reported_status`: Composite for reported user + status

---

## reviews

Seller reviews left by lot winners.

### Fields

| Field        | Type                         | Required | Description                                          |
| ------------ | ---------------------------- | -------- | ---------------------------------------------------- |
| `lotId`      | `id("lots")`                 | Yes      | Reference to lot                                      |
| `reviewerId` | `string`                     | Yes      | Buyer userId (auction winner)                         |
| `revieweeId` | `string`                     | Yes      | Seller userId                                         |
| `rating`     | `number`                     | Yes      | Integer 1-5                                           |
| `comment`    | `string` (optional)          | No       | Review comment                                        |
| `response`   | `object` (optional)          | No       | Seller's response                                     |
| `createdAt`  | `number`                     | Yes      | Creation timestamp                                    |

### Response Structure

```typescript
{
  text: string,
  createdAt: number
}
```

### Indexes

- `by_reviewee`: Find reviews by seller
- `by_reviewee_createdAt`: Sort reviews by time
- `by_lot_reviewer`: Unique index per lot + reviewer

---

## bids

Immutable record of all bids placed.

### Fields

| Field       | Type                         | Required | Description                                          |
| ----------- | ---------------------------- | -------- | ---------------------------------------------------- |
| `lotId`     | `id("lots")`                 | Yes      | Reference to lot                                      |
| `bidderId`  | `string`                     | Yes      | Auth user ID of bidder                                |
| `amount`    | `number`                     | Yes      | Bid amount                                           |
| `timestamp` | `number`                     | Yes      | Bid timestamp (Unix ms)                              |
| `status`    | `union` (optional)           | No       | Bid integrity status: `valid`, `voided`              |

### Indexes

- `by_lot`: Find bids by lot, sorted by timestamp
- `by_bidder`: Find bids by bidder
- `by_bidder_lot`: Find bid by bidder + lot
- `by_timestamp`: Sort all bids by timestamp

---

## bidCooldowns

Per-user bid cooldown state.

### Fields

| Field        | Type     | Required | Description                    |
| ------------ | -------- | -------- | ------------------------------ |
| `userId`     | `string` | Yes      | User ID                        |
| `lastBidAt`  | `number` | Yes      | Last bid timestamp (Unix ms)   |

### Indexes

- `by_userId`: Find cooldown by user

---

## proxy_bids

Automated proxy bidding configurations.

### Fields

| Field       | Type                         | Required | Description                                          |
| ----------- | ---------------------------- | -------- | ---------------------------------------------------- |
| `lotId`     | `id("lots")`                 | Yes      | Reference to lot                                      |
| `bidderId`  | `string`                     | Yes      | Auth user ID of bidder                                |
| `maxBid`    | `number`                     | Yes      | Maximum amount bidder is willing to pay              |
| `updatedAt` | `number`                     | Yes      | Last update timestamp                                 |

### Indexes

- `by_lot`: Find proxy bids by lot
- `by_bidder_lot`: Find proxy bid by bidder + lot
- `by_lot_maxBid`: Sort proxy bids by max bid for a lot

---

## profiles

User application profiles linking auth users to role-based metadata. Contains KYC verification status and encrypted PII.

### Fields

| Field               | Type                              | Required | Description                                          |
| ------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `userId`            | `string`                          | Yes      | Auth user ID                                         |
| `name`              | `string` (optional)               | No       | Display name                                         |
| `email`             | `string` (optional)               | No       | Email address                                        |
| `role`              | `union`                           | Yes      | Role: `buyer`, `seller`, `admin`                      |
| `isVerified`        | `boolean`                         | Yes      | Whether user is verified                             |
| `kycStatus`         | `union` (optional)                | No       | KYC status: `pending`, `verified`, `rejected`         |
| `kycDocuments`      | `id("_storage")[]` (optional)     | No       | KYC document storage IDs                              |
| `kycRejectionReason`| `string` (optional)               | No       | Reason for KYC rejection                              |
| `firstName`         | `string` (optional)               | No       | Encrypted PII - First name                            |
| `lastName`          | `string` (optional)               | No       | Encrypted PII - Last name                             |
| `idNumber`          | `string` (optional)               | No       | Encrypted PII - ID number                             |
| `kycEmail`          | `string` (optional)               | No       | Encrypted PII - KYC email                             |
| `bio`               | `string` (optional)               | No       | User bio                                             |
| `phoneNumber`       | `string` (optional)               | No       | Encrypted PII - Phone number                          |
| `companyName`       | `string` (optional)               | No       | Company name (for sellers)                            |
| `location`          | `string` (optional)               | No       | User location                                        |
| `emailVerified`     | `boolean` (optional)              | No       | Email verification status                             |
| `phoneVerified`     | `boolean` (optional)              | No       | Phone verification status                             |
| `bankingVerified`   | `boolean` (optional)              | No       | Banking verification status                           |
| `taxNumberVerified` | `boolean` (optional)              | No       | Tax number verification status                        |
| `createdAt`         | `number`                          | Yes      | Profile creation timestamp                            |
| `updatedAt`         | `number`                          | Yes      | Last update timestamp                                 |

### Indexes

- `by_userId`: Find profile by user ID
- `by_kycStatus`: Find profiles by KYC status
- `by_role`: Find profiles by role
- `by_isVerified`: Filter verified/unverified profiles

---

## auditLogs

Immutable audit trail for all administrative actions.

### Fields

| Field        | Type                | Required | Description                                         |
| ------------ | ------------------- | -------- | --------------------------------------------------- |
| `adminId`    | `string`            | Yes      | Admin user ID performing action                     |
| `action`     | `string`            | Yes      | Action type (e.g., "approve_kyc", "reject_listing") |
| `targetId`   | `string` (optional) | No       | ID of target entity                                 |
| `targetType` | `string` (optional) | No       | Type of target entity                               |
| `details`    | `string` (optional) | No       | Additional action details                           |
| `targetCount`| `number` (optional) | No       | Count for bulk operations                           |
| `timestamp`  | `number`            | Yes      | Action timestamp                                    |

### Indexes

- `by_timestamp`: Sort all audit logs by time
- `by_adminId`: Find logs by admin

---

## supportTickets

User support ticket system.

### Fields

| Field        | Type                         | Required | Description                                          |
| ------------ | ---------------------------- | -------- | ---------------------------------------------------- |
| `userId`     | `string`                     | Yes      | User ID creating ticket                               |
| `lotId`      | `id("lots")` (optional)      | No       | Related lot (if applicable)                           |
| `subject`    | `string`                     | Yes      | Ticket subject                                        |
| `message`    | `string`                     | Yes      | Ticket message                                        |
| `status`     | `union`                      | Yes      | Status: `open`, `resolved`, `closed`                  |
| `priority`   | `union`                      | Yes      | Priority: `low`, `medium`, `high`                     |
| `createdAt`  | `number`                     | Yes      | Creation timestamp                                    |
| `updatedAt`  | `number`                     | Yes      | Last update timestamp                                 |
| `resolvedBy` | `string` (optional)          | No       | Admin ID that resolved ticket                         |

### Indexes

- `by_status`: Find tickets by status
- `by_user`: Find tickets by user
- `by_updatedAt`: Sort by last update
- `by_user_updatedAt`: Find user's tickets sorted by update

---

## notifications

User notifications and system announcements.

### Fields

| Field         | Type                | Required | Description                                              |
| ------------- | ------------------- | -------- | -------------------------------------------------------- |
| `recipientId` | `string`            | Yes      | Recipient user ID ("all" for announcements)              |
| `type`        | `union`             | Yes      | Type: `info`, `success`, `warning`, `error`              |
| `title`       | `string`            | Yes      | Notification title                                       |
| `message`     | `string`            | Yes      | Notification message                                     |
| `link`        | `string` (optional) | No       | Optional link for navigation                             |
| `isRead`      | `boolean`           | Yes      | Read status                                              |
| `createdAt`   | `number`            | Yes      | Creation timestamp                                       |

### Indexes

- `by_recipient`: Find notifications by recipient and read status
- `by_recipient_createdAt`: Sort recipient notifications by time
- `by_recipient_isRead_createdAt`: Complex index for filtering and sorting

---

## readReceipts

Tracks when users have read specific notifications.

### Fields

| Field            | Type                  | Required | Description                    |
| ---------------- | --------------------- | -------- | ------------------------------ |
| `userId`         | `string`              | Yes      | User who read the notification |
| `notificationId` | `id("notifications")` | Yes      | Reference to notification      |
| `readAt`         | `number`              | Yes      | Timestamp when read            |

### Indexes

- `by_user_notification`: Find receipt by user and notification
- `by_notification`: Find all receipts for a notification

---

## userActivity

Per-user activity feed entries for profile "Recent Activity" section.

### Fields

| Field        | Type                | Required | Description                                          |
| ------------ | ------------------- | -------- | ---------------------------------------------------- |
| `userId`     | `string`            | Yes      | User ID                                              |
| `type`       | `union`             | Yes      | Activity type: `account_created`, `verification_requested`, `verification_approved`, `verification_rejected`, `role_changed`, `listing_created`, `listing_sold`, `bid_placed`, `bid_won` |
| `description`| `string` (optional) | No       | Activity description                                 |
| `relatedId`  | `string` (optional) | No       | Related entity ID                                    |
| `createdAt`  | `number`            | Yes      | Creation timestamp                                   |

### Indexes

- `by_userId`: Find activities by user
- `by_userId_createdAt`: Sort user activities by time

---

## conversations

Two-party buyer/seller messaging.

### Fields

| Field           | Type                    | Required | Description                    |
| --------------- | ----------------------- | -------- | ------------------------------ |
| `buyerId`       | `string`                | Yes      | Buyer user ID                  |
| `sellerId`      | `string`                | Yes      | Seller user ID                 |
| `lotId`         | `id("lots")` (optional) | No       | Related lot (optional)         |
| `lastMessageAt` | `number`                | Yes      | Last message timestamp         |
| `createdAt`     | `number`                | Yes      | Creation timestamp             |

### Indexes

- `by_buyer`: Find conversations by buyer, sorted by last message
- `by_seller`: Find conversations by seller, sorted by last message
- `by_buyer_seller`: Find conversation between buyer and seller

---

## messages

Individual messages within conversations.

### Fields

| Field            | Type                  | Required | Description          |
| ---------------- | --------------------- | -------- | -------------------- |
| `conversationId` | `id("conversations")`  | Yes      | Reference to conversation |
| `senderId`       | `string`              | Yes      | Sender user ID       |
| `content`        | `string`              | Yes      | Message content      |
| `isRead`         | `boolean`             | Yes      | Read status          |
| `createdAt`      | `number`              | Yes      | Creation timestamp   |

### Indexes

- `by_conversation`: Find messages by conversation, sorted by time
- `by_conversation_read`: Filter messages by read status
- `by_sender`: Find messages by sender, sorted by time

---

## watchlist

User's saved lots for monitoring.

### Fields

| Field    | Type         | Required | Description      |
| -------- | ------------ | -------- | ---------------- |
| `userId` | `string`     | Yes      | User ID          |
| `lotId`  | `id("lots")` | Yes      | Watched lot      |

### Indexes

- `by_user`: Find all watchlist items for user
- `by_user_lot`: Unique index per user-lot pair

---

## presence

Real-time user presence tracking.

### Fields

| Field       | Type     | Required | Description                |
| ----------- | -------- | -------- | -------------------------- |
| `userId`    | `string` | Yes      | User ID                    |
| `updatedAt` | `number` | Yes      | Last presence update       |

### Indexes

- `by_userId`: Find presence by user
- `by_updatedAt`: Sort by update time

---

## userPreferences

Per-user UI and notification preferences.

### Fields

| Field                        | Type                              | Required | Description                                          |
| ---------------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `userId`                     | `string`                          | Yes      | User ID                                              |
| `viewMode`                   | `union` (optional)                | No       | View mode: `compact`, `detailed`                      |
| `sidebarOpen`                | `boolean` (optional)              | No       | Sidebar state                                        |
| `defaultStatusFilter`        | `union` (optional)                | No       | Default status filter: `active`, `closed`, `all`     |
| `defaultMake`                | `string` (optional)               | No       | Default make filter                                   |
| `defaultMinYear`             | `number` (optional)               | No       | Default minimum year filter                           |
| `defaultMaxYear`             | `number` (optional)               | No       | Default maximum year filter                           |
| `defaultMaxHours`            | `number` (optional)               | No       | Default max operating hours filter                    |
| `defaultMinPrice`            | `number` (optional)               | No       | Default minimum price filter                          |
| `defaultMaxPrice`            | `number` (optional)               | No       | Default maximum price filter                          |
| `biddingRequireConfirmation` | `boolean` (optional)             | No       | Require bid confirmation                             |
| `biddingProxyBidDefault`     | `boolean` (optional)              | No       | Default to proxy bid                                  |
| `notificationsBidOutbid`     | `boolean` (optional)              | No       | Outbid notification preference                        |
| `notificationsWatchlistEnding`| `union` (optional)               | No       | Watchlist ending alert: `disabled`, `1h`, `3h`, `24h` |
| `notificationsAuctionWon`    | `boolean` (optional)              | No       | Auction won notification preference                   |
| `notificationsSellerAuctionApproved` | `boolean` (optional)     | No       | Listing approved notification preference              |
| `notificationsEmailEnabled`  | `boolean` (optional)              | No       | Email notification preference                          |
| `updatedAt`                  | `number`                          | Yes      | Last update timestamp                                 |

### Indexes

- `by_userId`: Find preferences by user

---

## counters

Aggregated statistics counters for dashboards.

### Fields

| Field        | Type                | Required | Description                                 |
| ------------ | ------------------- | -------- | ------------------------------------------- |
| `name`       | `string`            | Yes      | Counter name (e.g., "auctions", "profiles") |
| `total`      | `number`            | Yes      | Total count                                 |
| `active`     | `number` (optional) | No       | Active count                                |
| `pending`    | `number` (optional) | No       | Pending count                               |
| `verified`   | `number` (optional) | No       | Verified count                              |
| `open`       | `number` (optional) | No       | Open count                                  |
| `resolved`   | `number` (optional) | No       | Resolved count                              |
| `draft`      | `number` (optional) | No       | Draft count                                 |
| `soldCount`  | `number` (optional) | No       | Sold count                                  |
| `salesVolume`| `number` (optional) | No       | Sales volume                                |
| `updatedAt`  | `number`            | Yes      | Last update timestamp                       |

### Indexes

- `by_name`: Find counter by name

---

## settings

Global application configuration.

### Fields

| Field         | Type                             | Required | Description                    |
| ------------- | -------------------------------- | -------- | ------------------------------ |
| `key`         | `string`                         | Yes      | Setting key                    |
| `value`       | `union`                          | Yes      | Value: `string`, `number`, or `boolean` |
| `description` | `string` (optional)              | No       | Setting description            |
| `updatedAt`   | `number`                         | Yes      | Last update timestamp           |

### Indexes

- `by_key`: Find setting by key

---

## faqItems

Public FAQ items managed by admins.

### Fields

| Field         | Type      | Required | Description              |
| ------------- | --------- | -------- | ------------------------ |
| `question`    | `string`  | Yes      | FAQ question             |
| `answer`      | `string`  | Yes      | FAQ answer               |
| `order`       | `number`  | Yes      | Display order            |
| `isPublished` | `boolean` | Yes      | Whether published        |

### Indexes

- `by_order`: Sort by order
- `by_published_order`: Composite for published items in order

---

## platformFees

Platform fee configuration.

### Fields

| Field            | Type                | Required | Description                                          |
| ---------------- | ------------------- | -------- | ---------------------------------------------------- |
| `name`           | `string`            | Yes      | Fee name                                             |
| `description`    | `string` (optional) | No       | Fee description                                       |
| `feeType`        | `union`             | Yes      | Type: `percentage`, `fixed`                           |
| `value`          | `number`            | Yes      | Fee value (percentage or fixed amount)               |
| `appliesTo`      | `union`             | Yes      | Applies to: `buyer`, `seller`, `both`                |
| `isActive`       | `boolean`           | Yes      | Whether fee is active                                 |
| `visibleToBuyer` | `boolean`           | Yes      | Whether visible to buyer                              |
| `visibleToSeller`| `boolean`           | Yes      | Whether visible to seller                             |
| `sortOrder`      | `number`            | Yes      | Display order                                         |
| `createdAt`      | `number`            | Yes      | Creation timestamp                                    |
| `updatedAt`      | `number`            | Yes      | Last update timestamp                                 |
| `deletedAt`      | `number` (optional) | No       | Soft delete timestamp                                 |

### Indexes

- `by_active`: Filter by active status
- `by_appliesTo`: Filter by appliesTo
- `by_sortOrder`: Sort by display order

---

## lotFees

Fee ledger per lot at settlement.

### Fields

| Field             | Type                         | Required | Description                    |
| ----------------- | ---------------------------- | -------- | ------------------------------ |
| `lotId`           | `id("lots")`                 | Yes      | Reference to lot               |
| `feeId`           | `id("platformFees")`         | Yes      | Reference to platform fee       |
| `feeName`         | `string`                     | Yes      | Fee name at time of application|
| `appliedTo`       | `union`                      | Yes      | Applied to: `buyer`, `seller`   |
| `feeType`         | `union`                      | Yes      | Type: `percentage`, `fixed`    |
| `rate`            | `number`                     | Yes      | Fee rate at time of application|
| `salePrice`       | `number`                     | Yes      | Sale price                     |
| `calculatedAmount` | `number`                    | Yes      | Calculated fee amount          |
| `createdAt`       | `number`                     | Yes      | Creation timestamp             |

### Indexes

- `by_lot`: Find fees by lot
- `by_appliedTo`: Filter by appliedTo
- `by_feeId`: Find fees by platform fee reference
- `by_lot_fee_applied`: Composite for lot + fee + appliedTo

---

## errorReports

Error reports queued for GitHub issues.

### Fields

| Field                   | Type                              | Required | Description                                          |
| ----------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `fingerprint`           | `string`                          | Yes      | Error fingerprint for deduplication                   |
| `status`                | `union`                           | Yes      | Status: `pending`, `processing`, `completed`, `failed` |
| `errorType`             | `string`                          | Yes      | Error type                                           |
| `errorMessage`          | `string`                          | Yes      | Error message                                        |
| `stackTrace`            | `string` (optional)               | No       | Stack trace                                          |
| `userId`                | `string` (optional)              | No       | User ID (if authenticated)                           |
| `userRole`              | `string` (optional)               | No       | User role                                            |
| `additionalInfo`        | `record` (optional)               | No       | Additional context                                   |
| `breadcrumbs`           | `array`                           | Yes      | Breadcrumb trail                                     |
| `metadata`              | `object`                          | Yes      | Request metadata                                     |
| `githubIssueUrl`        | `string` (optional)               | No       | GitHub issue URL                                     |
| `githubIssueNumber`     | `number` (optional)               | No       | GitHub issue number                                   |
| `instanceCount`         | `number`                          | Yes      | Number of occurrences                                 |
| `lastOccurredAt`        | `number`                          | Yes      | Last occurrence timestamp                             |
| `createdAt`             | `number`                          | Yes      | Creation timestamp                                    |
| `errorMessageNormalized`| `string` (optional)               | No       | Normalized error message                              |

### Breadcrumb Structure

```typescript
{
  timestamp: number,
  type: string,
  description: string,
  metadata?: Record<string, string | number>
}[]
```

### Metadata Structure

```typescript
{
  url: string,
  userAgent: string,
  timestamp: number
}
```

### Indexes

- `by_fingerprint`: Find by fingerprint for deduplication
- `by_status`: Filter by status
- `by_github_issue`: Find by GitHub issue number
- `by_createdAt`: Sort by creation time

---

## Data Types Reference

### Status Enums

**Auction Status:**

- `draft` - Created but not published
- `published` - Live and accepting bids
- `closed` - Ended, all lots settled

**Lot Status:**

- `draft` - Created but not submitted for review
- `pending_review` - Submitted, awaiting admin approval
- `approved` - Approved but not yet assigned to an auction
- `assigned` - Assigned to a published auction
- `sold` - Won by highest bidder (reserve met)
- `unsold` - Ended without meeting reserve or no bids
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

- `buyer` - Can bid on lots and create listings
- `seller` - Can create listings
- `admin` - Full platform access

**Error Report Status:**

- `pending` - Queued for processing
- `processing` - Being processed
- `completed` - GitHub issue created
- `failed` - Processing failed

---

_Last Updated: 2026-10-03_
_Source: `convex/schema.ts`_
