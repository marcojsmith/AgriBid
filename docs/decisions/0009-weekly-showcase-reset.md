# 0009 - Weekly showcase reset

Date: 2026-09 (showcase-mock-data task) | Status: Accepted

## Context

The showcase environment needs a coherent mock dataset that stays fresh, using the Clerk-dependent `mock-seller@farm.com` profile.

## Decision

`performSeed(ctx)` in `convex/seed.ts` is the single seeding body for `runSeed` and the `weeklyReset` internal mutation (cron). Seeding is idempotent (insert-if-absent by natural key; keyless tables seeded only when empty). `weeklyReset` clears transactional tables and non-admin profiles (static catalog, FAQ, and platform fees are kept), then inserts a synthetic display-only `userId: "mock-seller"` profile so the next seed does not throw. It deliberately skips `checkDestructiveAccess`, as internal mutations have no caller identity.

## Consequences

- A fresh showcase with no Clerk sign-ins is bootstrapped by running `seed.weeklyReset` once from the dashboard.
- `runSeed({ clear: true })` does not clear profiles.
- Admin profiles are never created synthetically.
- Mock dataset: 20 auctions covering active, sold, unsold, pending_review, and draft states.
