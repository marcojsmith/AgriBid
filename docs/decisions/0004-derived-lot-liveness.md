# 0004 - Derived lot liveness

Date: 2026-09-16 | Status: Accepted

## Context

With lots inside scheduled containers (0003), a stored `"active"` status would drift from the container's window.

## Decision

Liveness is derived, never stored. A lot is browsable and biddable when `status === "assigned"`, its auction is `published`, and `auction.startTime <= now < (lot.extendedEndTime ?? auction.endTime)`. `getActiveLots` and `useLotLiveWindow` encapsulate this.

## Consequences

- Code must never branch on a stored `"active"` status; it no longer exists.
- Anti-sniping extension works through `lot.extendedEndTime` overriding the container end.
- All liveness checks must go through the shared helpers to stay consistent.
