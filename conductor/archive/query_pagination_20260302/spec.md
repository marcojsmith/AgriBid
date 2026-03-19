# Track Specification: Pagination Refactor for Queries

## Overview

Currently, several Convex queries use hardcoded `.take()` limits (e.g., 50, 100, 1000). This silently truncates data and provides a poor user experience as the database grows. This track implements cursor-based pagination using Convex's native `.paginate()` method and updates the UI to support loading more data.

## Functional Requirements

- **Cursor-based Pagination:** Replace hardcoded `.take()` limits with cursor-based pagination in:
  - `getRecentBids`, `getTickets`, `getAuditLogs`, `listAnnouncements` (admin)
  - `getMyTickets` (support)
  - `getMyNotifications` (notifications)
  - `recentSales` within `getFinancialStats` (admin stats)
  - Previously paginated: `getAuctionBids`, `getEquipmentMetadata`, active auctions/makes computation, `getWatchedAuctions`, `getMyBids`, `getMyListings`, `getActiveAuctions`, `getSellerListings`, `getAuctionBids`, `getEquipmentMetadata`
  - Remaining bounded (mutation batch processing, not user-facing): `markAllRead` handler
- **Configurable Limits:** Move default limits to `app/convex/constants.ts` and ensure pagination values are configurable via a configuration mechanism (e.g., a `settings` table in Convex).
- **Frontend Integration:**
  - Update `BiddingHistory` component to show paginated bids.
  - Update `AdminEquipmentList` to handle paginated equipment.
  - Update `AuctionGrid` to support paginated loading of active auctions.
  - Implement "Load More" buttons or infinite scroll where appropriate.
  - Show "Showing X of Y" or truncation indicators when results are limited.

## Non-Functional Requirements

- **Performance:** Ensure pagination is efficient and doesn't introduce large scans.
- **Type Safety:** Use `paginationOptsValidator` for all paginated query arguments.
- **UI Consistency:** Follow existing design patterns for loading states and buttons.

## Acceptance Criteria

- [x] Queries successfully return paginated results with `nextPageCursor` and `hasMore`.
- [x] Frontend components display data in batches and allow users to load more.
- [x] `MAX_RESULTS` is centralized in `app/convex/constants.ts`.
- [ ] Pagination limits can be adjusted without code changes (via config).
- [x] No data loss at pagination boundaries.

## Out of Scope

- Migrating non-query logic to pagination (e.g., bulk exports).
- Changing the underlying database schema.
