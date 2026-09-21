# Architecture Decision Records

One short ADR per architectural or product decision. Status is `Accepted` unless noted.

## Index

| #    | Title                                                                             | Date       |
| ---- | --------------------------------------------------------------------------------- | ---------- |
| 0001 | [Clerk over Better Auth](0001-clerk-over-betterauth.md)                           | 2026-09    |
| 0002 | [Stable userId identity bridge](0002-stable-userid-identity-bridge.md)            | undated    |
| 0003 | [Auction container and lots split](0003-auction-container-and-lots.md)            | 2026-09-16 |
| 0004 | [Derived lot liveness](0004-derived-lot-liveness.md)                              | 2026-09-16 |
| 0005 | [Fee snapshot at lot assignment](0005-fee-snapshot-at-assignment.md)              | 2026-09-16 |
| 0006 | [AES-256-GCM PII encryption](0006-pii-encryption-aes-gcm.md)                      | undated    |
| 0007 | [Verified-only bidding](0007-verified-only-bidding.md)                            | undated    |
| 0008 | [Scalar buyerId/sellerId conversations](0008-scalar-conversation-participants.md) | 2026-09    |
| 0009 | [Weekly showcase reset](0009-weekly-showcase-reset.md)                            | 2026-09    |
| 0010 | [Permanent strictTypeChecked lint](0010-strict-type-checked-lint.md)              | 2026-09-12 |
| 0011 | [Route-based admin portal](0011-route-based-admin-portal.md)                      | undated    |
| 0012 | [Convex file storage for images](0012-convex-file-storage-images.md)              | undated    |
| 0013 | [Hierarchical equipment catalog](0013-hierarchical-equipment-catalog.md)          | 2026-03    |
| 0014 | [Keep CORS helpers without consumers](0014-keep-cors-helpers.md)                  | 2026-09    |

## Template

```markdown
# NNNN - Title

Date: YYYY-MM-DD (or undated) | Status: Accepted

## Context

Why a decision was needed.

## Decision

What we chose.

## Consequences

What follows, good and bad.
```
