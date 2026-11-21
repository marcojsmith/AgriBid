# Plan: New screen design + design system

Coordinator: this thread (orchestrator). Workers: one Sonnet 5.5 thread at a time, own worktree from `origin/main`, branch per WP. Each worker self-reviews (Opus agent on the diff; Sonnet UI agent at 375 / 768 / 1440, light and dark) before opening the PR. Coordinator runs an Opus review on risky PRs, merges, and updates this tracker.

Reference for every WP: `spec.md`, `mockups.html` and `final/*.png` in this folder (workers read them from the coordinator worktree path given in the brief until the track is on `main`).

## Tracker

| WP  | Title                                                                                                                          | Risk                                          | Depends   | Status           | Thread                                                                      | PR   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | --------- | ---------------- | --------------------------------------------------------------------------- | ---- |
| 0   | Land the track docs (spec, plan, rubric, feedback, reviews, mockup; images git-ignored)                                        | docs                                          | none      | done (#396)      | coordinator                                                                 |      |
| 1   | Foundations: tokens, Lora, type scale, focus ring, shadcn primitives restyled                                                  | medium (app-wide visual)                      | 0         | in review (#397) | mcp:launch:8cd07688d6a8f32fb11de3e7c5c7ecbbb1742316fd7a0bff9fd8f9bbcb607c31 | #397 |
| 2   | Domain components + design-system doc + dev-only `/design-system` page                                                         | low                                           | 1         | done (#398)      | mcp:launch (worker thread)                                                  | #398 |
| 3a  | Backend read: auction event summary for cards (lot count, from-price, 3 lead photo URLs, location)                             | **risky** (query shape, pagination)           | 0         | done (#399)      | worker thread                                                               | #399 |
| 3b  | Backend schema: `lots.lotNumber`, `lots.province`, `profiles.sellerResponseTime`, watcher counter + backfills                  | **risky** (schema, migration, preview deploy) | 3a        | in review (#400) | worker thread                                                               | #400 |
| 3c  | Admin settings: VAT rate, company reg/VAT/phone/address for the footer; admin editing of seller response time and lot province | **risky** (settings mutations, admin auth)    | 3b        | todo             |                                                                             |      |
| 4   | Home screen                                                                                                                    | low                                           | 2, 3a, 3c | todo             |                                                                             |      |
| 5   | Auction event screen                                                                                                           | low                                           | 2, 3a, 3b | todo             |                                                                             |      |
| 6   | Lot detail screen (gallery, bid panel states, fees, mobile sticky bar)                                                         | **risky** (bid flow UI)                       | 2, 3b, 3c | todo             |                                                                             |      |
| 7   | Rubric re-score of the real app (Opus agent, coordinator) + fix round on the same worker                                       | review                                        | 4, 5, 6   | todo             |                                                                             |      |
| 8   | **Stop: ask the owner to walk the rest of the app**, then open a rollout track                                                 | owner                                         | 7         | todo             |                                                                             |      |

Order: 0 → 1 → 2 → 3a → 3b → 3c → 4 → 5 → 6 → 7 → 8. The 3x backend WPs can run before WP2 if WP2 stalls (no code overlap).

## Work packages

### WP0 · Track docs (Haiku thread, docs-only)

- Commit `spec.md`, `plan.md`, `rubric.md`, `feedback.md`, `review-round-*.md`, `mockups.html`. Git-ignore `assets/`, `final/`, `screenshots/` (third-party photos and renders of them); workers read those from the coordinator worktree path.
- STATUS.md: add this track under In progress; also correct the stale entries (`feat/marketplace-auction-cards` is fully merged; `feat/toggleable-cron-jobs` still has 1 unmerged commit).
- DoD: docs PR merged.

### WP1 · Foundations

- Files: `src/index.css`, `index.html` (Lora 500/600 + Inter 400–700, `display=swap`), `src/components/ui/{button,badge,input,tabs,card}.tsx`, `src/lib/theme-tokens.test.ts`.
- Replace token values with the spec table (light + dark); add `primary-soft`, `btn`, `hero*`, status `live/soon/urgent/sold/passed` × `solid/soft/fg`, `ok-fg`, `warn-fg`; add `--font-display`; `.num` (tabular-nums); global `:focus-visible` ring; `--radius` so `rounded-md` = 6px and `rounded-lg` = 8px.
- Button: `default` uses `btn` token; add `size="touch"` or make `default`/`sm` ≥ 44px below `md`. Badge: `rounded-sm`, status variants.
- Tests first: contrast assertions for every fg/bg pair in both themes; button/badge variant tests.
- Verify: every existing screen still renders (spot check dashboard, admin, profile at 375 and 1440, both themes) since tokens are global. Note visual regressions as follow-ups, don't fix other screens here.
- Version: minor.

### WP2 · Domain components + design-system doc

- New in `src/components/ds/` (folder name to confirm in review): `StatusBadge`, `ReservePill`, `Money`, `Countdown` (restyle or wrap `CountdownTimer`), `PhotoFrame`, `EventMosaic`, `SaleTerms`, `SpecTable`, `ConditionReport`, `SectionHeader`, `SegmentedControl`, `FilterChips`, `StickyActionBar`. Each with tests + JSDoc.
- Formatters: extend `src/lib/currency.ts` (`R 200 000`, no cents) and add a SAST date formatter (`Sat 22 Nov, 10:00 SAST`) with tests; reuse `auction-badges.ts` for status derivation.
- `docs/architecture/ui-design/design-system.md`: tokens, type, spacing, radius, components (when to use / not), content rules, imagery rules, a11y checklist. Reduce `theme.md` to a pointer. ADR `docs/decisions/00NN-design-system.md`.
- Dev-only route `/design-system` (behind `import.meta.env.DEV`) rendering every token and component in both themes, the reference for the later rollout.

### WP3a · Backend read: event summary (risky)

- Extend `getPublishedAuctions` (or add `getAuctionSummaries`) to return per event: lot count, lowest opening/current price, up to 3 lead lot image URLs (front first), first lot location/province, live/upcoming/closed bucket. Keep capped takes and the manual cursor; argument + return validators; no N+1 beyond the cap.
- `convex-test` tests for buckets, caps, missing images. Coordinator Opus review before merge.
- Done as: `getPublishedAuctions` extended (not a sibling). New fields `lotCountCapped`, `fromPrice`, `leadImageUrls`, `location` (first lot's free-text location; province arrives with WP3b), `bucket`. `lotCount` on this public query now counts buyer-visible lots only (assigned/sold/unsold, not `hiddenByFlags`). Lots are read via `by_status_auctionId`, capped at 50 per status (`AUCTION_SUMMARY_LOT_CAP`); `lotCountCapped` marks a lower bound. "First lots" = oldest `_creationTime` until WP3b adds `lotNumber`. The server returns `effectiveEndTime` (auction end or latest lot `extendedEndTime`) and the client derives the bucket with `getEventBucket` (`src/lib/auction-utils.ts`) because a cached query can't track time. Page size is clamped to 1..12 and lots read per status capped at 20.
- Follow-up: denormalise event summary onto the auction doc to stop per-bid feed re-runs.

### WP3b · Backend schema (risky, preview deploy)

- `lots.lotNumber` (optional number): assigned on auction assignment as next number in that sale (atomic, via counter); stable afterwards; backfill existing assigned lots by `_creationTime`. Index `by_auctionId_lotNumber`.
- `lots.province` (optional union of the 9 SA provinces): set in the listing wizard and admin lot edit; seed values.
- `profiles.sellerResponseTime` (optional, admin-set label e.g. "Usually replies within a day").
- Watcher count: `counters` row per lot maintained on watch/unwatch (no `.collect()` counting); backfill from `watchlist`; public read on the lot query.
- Seed updated; migrations as internal mutations; preview deploy behind the lock handshake; coordinator runs the backfills on prod after merge.
- Done as: `lotNumber` comes from a monotonic per-auction counter (`counters` row `lotNumber:<auctionId>`, `total` = last number issued) so a number is never reused within a sale; unassign and unsold settlement clear it and nothing is re-packed. `backfillLotNumbers` walks `lots` in `_creationTime` order, numbers assigned/sold/unsold lots that still have an `auctionId` via the same counter, skips already-numbered lots (raising the counter to cover them) and reschedules itself in batches of 100. Province lives in `convex/lib/provinces.ts` (shared with `src/lib/provinces.ts`); `createLot` requires it for non-drafts, drafts and legacy lots may lack it. Response time options: `within_hours`, `within_day`, `within_2_days`, `slower` (+ unset, which hides the line). Watcher count: `counters` row `watchers:<lotId>` updated by `toggleWatchlist` (new `watchlist.by_lot` index); `backfillWatcherCounts` rewrites each lot's counter from the index count (absolute, so safe to re-run), batches of 25 lots. WP3a's lead-photo order now uses `lotNumber` asc with `_creationTime` fallback. Admin province editing is a "Set Province" item on `/admin/lots`; seller response time is a button on `/admin/users` for sellers.
- Owed ops (coordinator, after merge and deploy, in this order, each run twice to confirm `updated: 0` the second time): `bunx convex run migrations:backfillLotNumbers` then `bunx convex run migrations:backfillWatcherCounts` (add `--prod` for production). Each returns `{ processed, updated, isDone, continueCursor }` for its first batch and schedules the rest itself; wait until the Convex logs stop showing scheduled batches before the second run.
- Follow-ups: stale `watchers:<lotId>` counters are not removed when a lot is deleted; `getPublishedAuction` (event page) still orders lots by index order, not `lotNumber`; an admin cannot clear a lot's province; `closeLotEarly`, `adminUpdateLot` and `bulkUpdateLots` can move a lot out of `assigned` without clearing `auctionId` (pre-existing), so `lotNumber` stays with `auctionId` there (the rule is: `lotNumber` is cleared wherever `auctionId` is); the event summary's lead photos are chosen among the first 20 lots read per status, so in a sale of more than 20 lots the lowest-numbered ones may be missed (`lotCountCapped` flags it).

### WP3c · Admin settings (risky)

- Settings keys: `vat_rate_pct` (default 15), `company_registration_no`, `company_vat_no`, `company_phone`, `company_address`, `company_whatsapp` (optional). Public read for the footer and fee breakdown; admin-only update mutation with validators and audit log.
- Admin UI: fields on the System Settings page; seller response time on the admin user/profile view; province on admin lot edit.
- Fee breakdown and footer read these; when a value is unset the row is hidden.
- Note: company name/address/phone already exist in admin Business Info (`/admin/business-info`, `BrandingContext.businessInfo`); WP3c only adds registration no., VAT no. and WhatsApp there, plus VAT rate, seller response time and lot province.

### WP4 · Home

- `src/pages/Home.tsx`, `AuctionEventCard`, header, footer: hero with lead photo + proof strip, segmented control (Live & upcoming | Closing soon | Results) + sort, event cards (mosaic, status badge, countdown chip, summary line, "View lots"), closing-soon rail (< 24 h only), category list (real counts), How AgriBid works, honest footer (hide unknown reg/VAT/phone). Header: "Sell equipment", signed-in avatar + "My bids", mobile search.

### WP5 · Auction event

- `src/pages/AuctionContainerDetail.tsx`, `LotBrowser`, `FilterSidebar`, `AuctionCard`: sale summary header + countdown card + Remind me, sale terms row, 260px filter sidebar + 3-col grid, toolbar (N lots · sort · Detailed/Compact on desktop only), active filter chips + "Clear filters" with counts that match results, mobile sticky Filters/Sort, state-correct card CTA.

### WP6 · Lot detail (risky: bid flow)

- `src/pages/AuctionDetail.tsx`, `ImageGallery`, `bidding/*`, `FeeBreakdown`, `SellerInfo`, `BidHistory`: gallery first (4:3, real counter, labelled angles), H1 make/model, bid panel in decision order (status → price → reserve → countdown + soft-close note → amount + increment chips → state CTA → fee breakdown with buyer's premium + VAT + estimated total → trust line), states guest / registered pre-start / live / ended, proxy copy, mobile order + sticky bar that matches the panel and hides while the panel is in view, spec table, condition report, seller card, bid history (last 3), related lots.
- Bid mutations untouched; coordinator Opus review focuses on CTA/state correctness and that no bid path changed.

### WP7 · Re-score

- Coordinator runs a fresh Opus agent with `rubric.md` against the real app (local dev + self-hosted Convex at `C:\Users\marco\docker\agribid-local`), 375 and 1440, both themes, three screens. Fixes go back to the relevant worker thread. Repeat until ≥ 9 on every item.

### WP8 · Owner walkthrough

- Report results with screenshots; ask the owner to go through the rest of the app and list screens to migrate. Their list becomes `conductor/tracks/design-system-rollout/`.

## Owner decisions (2026-11-21)

1. VAT: **admin setting** (WP3c), default 15%.
2. Lot numbers: **stored `lotNumber` field** (WP3b).
3. Sale terms: **platform-wide copy** in code for now, linked to the auction rules.
4. Missing data: **show watcher count**; make seller response time, province and footer company details **admin-configurable** (WP3b/3c). Interpretation: province is a lot field (seller sets it, admin can edit); response time is set by admin per seller.

## Deviations

<!-- record any change from spec.md here -->

- WP1: light `--secondary` is 35 30% 40% (mockup 45% fails AA on cream).
- WP2: components import from `@/components/ds/<Name>` (no barrel file). `deriveDisplayStatus` lives in `src/lib/auction-badges.ts`; Countdown helpers in `src/lib/countdown.ts`. `ConditionReport` takes optional booleans (undefined shows "Not reported"); the schema's checklist has only engine, hydraulics, tyres and service history.
- WP2: `CountdownTimer` now delegates to `ds/Countdown`, so existing callers lose the monospace font and pulse and gain the amber (under 1h) and red (under 2 min) thresholds.
- WP2: dark `--ring` lifted from 142 35% 58% to 142 40% 66% so the focus ring has 3:1 against the filled `btn`; the global focus ring now uses `--ring`.
- WP2: the MobileMenu buttons also lost their glow shadows (the header Login/Sell buttons were the WP1 follow-up).
