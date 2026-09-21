# 0007 - Verified-only bidding

Date: undated | Status: Accepted

## Context

Marketplace integrity requires that bidders are identified.

## Decision

Only KYC-verified users may bid. `placeBid` enforces `profile.isVerified` on the backend; `BiddingPanel` (and the `BidForm` / `MobileBidBar` checks) show an alert linking to the KYC flow for unverified or pending users.

## Consequences

- Backend is the enforcement point; UI checks are feedback only.
- The three frontend checks share the `getMyProfile` + `isVerified`/`kycStatus` pattern and must be kept in sync.
- Granular flags (`emailVerified`, `phoneVerified`, `bankingVerified`, `taxNumberVerified`) exist on `profiles`; only `emailVerified` has a write path so far.
