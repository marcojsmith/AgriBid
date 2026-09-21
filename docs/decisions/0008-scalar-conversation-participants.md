# 0008 - Scalar buyerId/sellerId conversations

Date: 2026-09 (issue #231) | Status: Accepted

## Context

The issue proposed a `participantIds` array plus an array index. Convex array-field indexes are not "contains" lookups, so "conversations for this user" would need a full scan.

## Decision

Two-party conversations use scalar `buyerId` and `sellerId`, each indexed (`by_buyer` / `by_seller`, ordered by `lastMessageAt`). A caller's conversations are the merged union of both index queries, paginated with an offset cursor (as in `getMyNotificationsHandler`). `startConversation` reuses existing threads in both directions.

## Consequences

- Only the returned page is enriched, keeping reads proportional to page size.
- Non-participants get a thrown `ConvexError` (paginated queries cannot return `null`), caught by a local error boundary.
- Sending is rate-limited to 10 messages per sender per minute via a `by_sender` index range.
