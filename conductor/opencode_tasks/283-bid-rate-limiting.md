# Task: Add per-user rate limiting/cooldown to bid placement (fixes #283)

## Context

`convex/auctions/mutations/bidding.ts` has no rate limiting, throttling, or cooldown on `placeBid`/`placeBidHandler` (lines 19-88). A user (or script) can currently hammer this mutation with no per-user cap, running up function-call costs and spamming bid history. Convex mutations are already serialized per-document so this is not a data-corruption risk — it's purely an abuse/cost-control gap.

There's an existing precedent for a lightweight in-memory-cached rate limiter in `convex/errors.ts` (`checkRateLimit`, lines ~104-121) but that one is global (all error reports), not per-user, and backed by a module-level cache variable — not suitable to copy directly since bidding needs a per-user cooldown, and module-level caches don't work correctly across Convex's serverless invocations for per-user state.

Read `convex/auctions/mutations/bidding.ts` and `convex/schema.ts` (search for how other per-user rate/cooldown state is modeled, e.g. any table indexed by `userId` + timestamp) before implementing.

## Instructions

1. Add a new table `bidCooldowns` to `convex/schema.ts`:
   ```ts
   bidCooldowns: defineTable({
     userId: v.id("users"),
     lastBidAt: v.number(),
   }).index("by_userId", ["userId"]),
   ```
   (Adjust the `userId` validator's referenced table if the codebase's actual users table is named differently — check `convex/schema.ts` for the correct table name via the `requireVerified` return type in `convex/lib/auth.ts`.)
2. In `convex/auctions/mutations/bidding.ts`, inside `placeBidHandler`, after `requireVerified` resolves `userId` and before calling `handleNewBid`:
   - Look up the user's `bidCooldowns` row via the `by_userId` index.
   - Define a cooldown constant, e.g. `const BID_COOLDOWN_MS = 1000;` (1 bid/second per user — adjust if you find an existing constant convention elsewhere in the codebase, e.g. a `constants.ts`).
   - If `now - lastBidAt < BID_COOLDOWN_MS`, throw `new ConvexError("You're bidding too fast. Please wait a moment and try again.")`.
   - Otherwise, upsert (patch if exists, insert if not) the `bidCooldowns` row with `lastBidAt: now` — do this update AFTER `handleNewBid` succeeds (so a rejected bid, e.g. "Auction ended", doesn't consume the cooldown window), but the cooldown _check_ must happen before calling `handleNewBid`.
3. Add tests in `convex/auctions/mutations/bidding.test.ts` (check if this file exists via Glob; if not, check `convex/auctions/mutations_branch.test.ts` or similar sibling test file for the existing test harness pattern used for `placeBid`) covering:
   - Two bids from the same user within the cooldown window: second one throws.
   - Two bids from the same user spaced beyond the cooldown window: both succeed.
   - Two bids from different users in quick succession: both succeed (cooldown is per-user, not global).
   - A rejected bid (e.g. bidding on an ended auction) does not itself trigger the cooldown for the next valid bid attempt.
4. Run `bun run type-check` and the relevant vitest file(s) to confirm everything passes.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — include argument and return validators, use `withIndex` not `.filter()`, use `ctx.db.patch`/`ctx.db.insert` correctly.
- Don't use a module-level in-memory cache (like `convex/errors.ts` does) — that pattern doesn't give correct per-user isolation across Convex's serverless execution model. Use a DB-backed check as described above.
- No `any` types.
- Keep the diff scoped to `convex/schema.ts`, `convex/auctions/mutations/bidding.ts`, and the relevant test file. Don't refactor unrelated bidding logic (e.g. `proxy_bidding.ts`) unless strictly necessary to wire this in.

## Results

Implemented per-user bid cooldown (1 bid/second, `BID_COOLDOWN_MS = 1000`).

### Changes

- **`convex/schema.ts`** — Added `bidCooldowns` table (`userId: v.string()`, `lastBidAt: v.number()`) with a `by_userId` index. Note: the validator uses `v.string()` rather than `v.id("users")` because this codebase has no `users` table — user ids are plain strings (see `profile.userId` and `requireVerified`'s return in `convex/lib/auth.ts`), matching `sellerId`/`bidderId` on other tables.
- **`convex/auctions/mutations/bidding.ts`** — In `placeBidHandler`:
  - After `requireVerified` resolves `userId`, looks up the user's `bidCooldowns` row via the `by_userId` index (`withIndex`, not `.filter()`).
  - If `now - lastBidAt < BID_COOLDOWN_MS`, throws `ConvexError("You're bidding too fast. Please wait a moment and try again.")`.
  - The cooldown is recorded (patch if row exists, insert otherwise) only **after** `handleNewBid` succeeds, so rejected bids (e.g. "Auction ended") do not consume the cooldown window — but the _check_ always runs before bidding.
  - Exported `BID_COOLDOWN_MS` for testability.
- **`convex/auctions/mutations/bidding.test.ts`** — Added a `placeBidHandler bid cooldown (issue #283)` describe block with 4 tests:
  1. Two bids within the cooldown window → second throws the "bidding too fast" error.
  2. Two bids spaced beyond the window → succeeds and patches the existing row.
  3. Two bids from different users in quick succession → both succeed (per-user, not global); first bid inserts a new row.
  4. A rejected bid (ended auction) does not touch `bidCooldowns` and the next valid attempt succeeds.

### Verification

- `bun run type-check` — passes (no errors).
- `bun run test --run convex/auctions/mutations/bidding.test.ts` — 24/24 tests pass (20 existing + 4 new).
- `bun run lint` — 0 errors (1349 warnings, all pre-existing in unrelated test files).
- `bun run build` — production build succeeds.

### Notes

- Used a DB-backed check (no module-level in-memory cache) per the constraint, so cooldown state is correct across Convex's serverless invocations.
- No changes needed to `proxy_bidding.ts` — the cooldown wraps the whole `placeBidHandler` flow including proxy bids.
- Reminder: a Convex schema push (`npx convex dev` / deploy) is required to create the new table in the deployed backend before shipping.
