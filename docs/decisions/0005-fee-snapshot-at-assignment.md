# 0005 - Fee snapshot at lot assignment

Date: 2026-09-16 | Status: Accepted

## Context

Auctions carry default buyer premium and seller commission percentages that admins can edit after lots are assigned.

## Decision

`assignLotToAuction` copies `defaultBuyerPremiumPct` / `defaultSellerCommissionPct` onto the lot as `resolvedBuyerPremiumPct` / `resolvedSellerCommissionPct`.

## Consequences

- Later auction edits cannot retroactively change an assigned lot's fees.
- Resolved defaults are derived at settlement but not persisted to `lotFees`, whose `feeId` is a required `platformFees` FK.
