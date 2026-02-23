# Performance Optimization Checklist

## Task 1: Bandwidth Optimization (Completed)
- [x] Implement Image URL Caching (`resolveUrlCached` in `app/convex/image_cache.ts`)
- [x] Update `resolveImageUrls` in `app/convex/auctions.ts` to use caching
- [x] Pagination for `getMyListings` (`app/convex/auctions.ts`)
- [x] Pagination for `getMyBids` (`app/convex/auctions.ts`)
- [x] Pagination for `getWatchedAuctions` (`app/convex/watchlist.ts`)
- [x] Add limits to `getEquipmentMetadata` (`app/convex/auctions.ts`)
- [x] Optimize `getActiveMakes` (`app/convex/auctions.ts`)
- [x] Add limits to `getFinancialStats` (`app/convex/admin.ts`)
- [x] Add limits to `getPendingKYC` (`app/convex/admin.ts`)

## Task 2: Database Query Efficiency (Completed)
- [x] Add composite indexes in `app/convex/schema.ts`
  - [x] `by_status_make` for `[status, make]`
  - [x] `by_status_year` for `[status, year]`
- [x] Optimize `getActiveAuctions` in `app/convex/auctions.ts`
  - [x] Use index-based filtering where possible
  - [x] Apply in-memory filters for non-indexed fields
- [x] Implement `toAuctionSummary` helper in `app/convex/auctions.ts`
  - [x] Project only essential fields (`_id`, `title`, `make`, `model`, `year`, `currentPrice`, `endTime`, `status`, `images`)
- [x] Update `getActiveAuctions` to return summary objects
- [x] Update `getPendingAuctions` to return summary objects

## Task 3: Consolidate Frontend Subscriptions (Completed)
- [x] Lift Admin Stats to Context
  - [x] Create `AdminStatsContext` in `app/src/contexts/AdminStatsContext.tsx`
  - [x] Create `useAdminStats` hook
  - [x] Wrap `AdminLayout` with provider
  - [x] Update admin pages to use hook
- [x] Batch Watchlist Status Checks
  - [x] Create `getWatchedAuctionIds` query in `app/convex/watchlist.ts`
  - [x] Update list components (Home, Search) to fetch watched IDs once
  - [x] Pass `isWatched` prop to `AuctionCard`
  - [x] Remove individual `isWatched` query from `AuctionCard`
- [x] Create User Profile Context
  - [x] Create `UserProfileContext` in `app/src/contexts/UserProfileContext.tsx`
  - [x] Create `useUserProfile` hook
  - [x] Wrap authenticated routes with provider
  - [x] Update components (`Header`, `Profile`, etc.) to use hook
- [x] Optimize NotificationListener
  - [x] Review implementation (Note: Handled partially in Task 1 by fetching only first page)
  - [x] Further optimize if necessary (e.g. specialized query for recent updates)
