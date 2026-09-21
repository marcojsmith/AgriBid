# 0003 - Auction container and lots split

Date: 2026-09-16 | Status: Accepted

## Context

Auctions were single-item records. The rework needed scheduled sales containing multiple items.

## Decision

`auctions` becomes a scheduled-sale container (title, `startTime`, `endTime`, status `draft|published|closed`, optional fee defaults). Item data moves to `lots` (status `draft|pending_review|approved|assigned|sold|unsold|rejected`). FK tables (`bids`, `proxy_bids`, `lotFees`, `watchlist`, `reviews`, `conversations`, `supportTickets`, `lotFlags`) use `lotId`. Admin UI splits into `/admin/lots`, `/admin/auctions`, `/admin/auctions/:id`; public gallery at `/auctions`.

## Consequences

- `settleLot` in `convex/auctions/internal.ts` is the single settlement path, shared by the expiry cron and manual container closure; closing a container settles its assigned lots first.
- Staging and production migrated 2026-09-17; the migration module and legacy `lots.startTime`/`endTime` fields and indexes were removed.
- Legacy `auctionFees`/`auctionFlags` rows are inert and can be purged.
