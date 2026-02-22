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

## Task 2: Database Query Efficiency
- [ ] Add composite indexes in `app/convex/schema.ts`
  - [ ] `by_status_make` for `[status, make]`
  - [ ] `by_status_year` for `[status, year]`
- [ ] Optimize `getActiveAuctions` in `app/convex/auctions.ts`
  - [ ] Use index-based filtering where possible
  - [ ] Apply in-memory filters for non-indexed fields
- [ ] Implement `toAuctionSummary` helper in `app/convex/auctions.ts`
  - [ ] Project only essential fields (`_id`, `title`, `make`, `model`, `year`, `currentPrice`, `endTime`, `status`, `images`)
- [ ] Update `getActiveAuctions` to return summary objects
- [ ] Update `getPendingAuctions` to return summary objects

## Task 3: Consolidate Frontend Subscriptions
- [ ] Lift Admin Stats to Context
  - [ ] Create `AdminStatsContext` in `app/src/contexts/AdminStatsContext.tsx`
  - [ ] Create `useAdminStats` hook
  - [ ] Wrap `AdminLayout` with provider
  - [ ] Update admin pages to use hook
- [ ] Batch Watchlist Status Checks
  - [ ] Create `getWatchedAuctionIds` query in `app/convex/watchlist.ts`
  - [ ] Update list components (Home, Search) to fetch watched IDs once
  - [ ] Pass `isWatched` prop to `AuctionCard`
  - [ ] Remove individual `isWatched` query from `AuctionCard`
- [ ] Create User Profile Context
  - [ ] Create `UserProfileContext` in `app/src/contexts/UserProfileContext.tsx`
  - [ ] Create `useUserProfile` hook
  - [ ] Wrap authenticated routes with provider
  - [ ] Update components (`Header`, `Profile`, etc.) to use hook
- [ ] Optimize NotificationListener
  - [ ] Review implementation (Note: Handled partially in Task 1 by fetching only first page)
  - [ ] Further optimize if necessary (e.g. specialized query for recent updates)
