# Changelog

Full history of what shipped, newest first. `STATUS.md` keeps only the last ~10
items; this file is the complete record. Items are drawn from merged PRs on
`main` (PR numbers in parentheses), completed conductor tracks and the original
build checklist. Dates are merge dates.

## 2026-11

- Data and settings (D2 of improve-screen-mockups phase 2): optional lot specs (`powerKw`, `drive`, `transmission`, `frontTyrePct`, `rearTyrePct`, `serialNumber`, `coldStartVideo`, per-photo `imageAngles` from the fixed shot list) on `createLot`, `saveDraft` and `adminUpdateLot`, returned by the public lot query; `profiles.vatRegistered` and `profiles.sellerType` (seller sets own, admin sets via `adminSetSellerVatProfile`, unset counts as VAT-registered) and the public lot query's `sellerVatKind` / `sellerTypeLabel`; new `admin/platformSettings` (public `getPlatformSettings`, audited admin mutations for buyer premium default 12%, registration deposit R 5 000 / 3 working days, seller costs 8% / R 0 / 7 days, finance contact (unset by default), push reminders flag (off), minimum photos per lot (8, enforced on submit, existing lots grandfathered)); auctions without their own premium now snapshot the platform premium on assignment; `engagement:recordLotView` (deduped 30 min per viewer, 60 counted views/viewer/hour, new `lotViewers` table purged daily), `engagement:getMostEngagedLots` (watchers + bids + views, capped reads) for Home's featured lot and the share collage; System Settings sections, admin seller VAT dialog, wizard specs and photo angles; seed uses 12 real webuytractors lots (demo finance contact seeded by `runSeed` only, never by `weeklyReset`). No backend code computed VAT or buyer totals, so `src/lib/vat.ts` stays the single source. Review round: exactly one buyer premium per lot (`lots.premiumSource`; auction snapshot, else active buyer % fee rows, else platform default; shared `resolveBuyerPremium` at settlement and fee reads), seller VAT status/type snapshotted on the lot at assignment (admin `adminSetLotSellerVat`, audited), `migrations:convertPercentageFeesToFractions`, per-lot `bids:<lotId>` counters + `migrations:backfillBidCounts`, engagement ranked from a precomputed `engagementScores` table (refresh cron every 5 min; score `bids*3 + watchers*2 + log2(1+views)`; anonymous views capped at 20/lot/hour), min-photos checked on edits that reduce photos, cold-start video size/type check, replace and remove (0.27.0)
- Design-system foundations v2 (D1 of improve-screen-mockups phase 2): tokens updated to the confirmed design (darker `muted-foreground` and `border`, `hero-muted`, `ok-fg` / `warn-fg`, new `ok-soft`, `warn-soft`, `watch-on`, `chip`; AA tests extended), `formatSastDate` now `Wed 25 Nov, 11:00` with no "SAST", `formatClosesIn` ("Closes in 2d 3h"; seconds only in the final 10 minutes), countdown turns red under 10 minutes, `calculateBuyerTotal` gains `vatBase` (VAT on the premium only for private sellers) and `vatBaseForSeller`, StatusBadge adds Under consideration and "Not sold", ReservePill adds "Reserve applies", new ds components LotChip, StatusPill, LotCard, CostBox, DepositLines, Banner, BottomSheet, Toast (+ `showToast`), StickyBar (StickyActionBar is now a 68px shell), IconRow / IconList, NumberedSteps, SellerStrip, WhatsAppButton, ShareButton (+ `shareOrCopy`), WatchButton, all on the `/design-system` page; design-system.md and decisions.md landed (0.26.0)
- Production Convex moved from Convex Cloud (`tangible-marmot-95`, kept as rollback) to the self-hosted backend at `https://agribid-convex.duckdns.org` behind nginx and DuckDNS. Cloud prod data was imported, the WP3b backfills and legal drafts ran, the Vercel prod env switched to `CONVEX_SELF_HOSTED_*`, `ALLOWED_ORIGINS` was set to the production aliases, and the prod URL was corrected to `agribid-iota.vercel.app` in AGENTS and README (ADR 0016)
- Admin-editable legal pages (WP4c of improve-screen-mockups): new `legalPages` table (one row per slug, index `by_slug`), public `legal:getLegalPage` (published pages only) and `legal:getPublishedLegalSlugs`, admin-only audited `admin:legal.updateLegalPage` / `setLegalPagePublished` / `createMissingLegalPageDrafts`, starter drafts for the Terms, Privacy policy and PAIA manual in `convex/lib/legalTemplates.ts` (unpublished, "Draft, needs legal review"; the seed creates missing rows only, never overwrites or publishes), public `/terms`, `/privacy` and `/paia` rendered with `react-markdown` (raw HTML off, images off, safe URLs), `/admin/legal` editor with live preview and confirm on publish and on saving a live page, footer links only for published pages; publishing is refused while the body still has the "Draft, needs legal review" notice or equals the starter template, and saves carry `expectedUpdatedAt` so a stale editor cannot overwrite a newer save (0.25.0)
- Closing-soon lot strip (WP4b of improve-screen-mockups): public `auctions:getClosingSoonLots` (max 12 assigned, buyer-visible lots ending in the next 24 h across published, started sales, soonest first; new index `auctions.by_status_endTime`; also finds soft-closed lots in sales that ended up to 24 h ago; reads at most 30 sales and 13 lots per sale) (its `asOf` argument is a cache key only: the client passes the time in 5-minute buckets so the cached 24 h window refreshes) and a Home "Closing in the next 24 hours" strip (snap-scroll rail on phones, four-up on desktop, hidden when empty, ended lots dropped on the client); seed sale "Material Handling Sale" now ends 20 h out so the strip shows after a reset (0.24.0)
- Redesigned home screen (WP4 of improve-screen-mockups): hero with lead photo and proof strip, Live & upcoming / Closing soon / Results view switch with sort, rebuilt event cards (photo mosaic, status badge, countdown chip, summary line, SAST close time, "View lots") in a grid that never ends in a gap, "How AgriBid works", header with "Sell equipment", "My bids" and a phone search field, and a rebuilt footer (company rows hidden when unset, legal row as plain text); `/` no longer sits in the page container (0.23.0)
- VAT rate and company details (WP3c of improve-screen-mockups): admin-set `vat_rate_pct` (default 15, 0-100; public `admin:getVatRate`, admin-only audited `admin:updateVatRate`, "Tax" section on System Settings), Business Info gains company registration no., VAT no. and WhatsApp, footer shows each only when set and drops the empty "Headquarters" heading (now "Company"), `FeeBreakdown` shows VAT and an estimated total for the buyer via the pure `calculateBuyerTotal` helper, admin can clear a lot's province (`adminUpdateLot` `clearProvince`), seed sets only the default VAT rate and never writes `business.*` company details (0.22.0)
- Lot numbers, province, seller response time and watcher counts (WP3b of improve-screen-mockups): `lots.lotNumber` (monotonic per-sale counter, issued on assignment, cleared on unassign/unsold, index `by_auctionId_lotNumber`), `lots.province` (9 SA provinces; required in the listing wizard, admin can set it from `/admin/lots`), `profiles.sellerResponseTime` (admin-set via `admin:setSellerResponseTime`, audit logged, control on `/admin/users`), per-lot `watchers:<lotId>` counters maintained by `toggleWatchlist` (new `watchlist.by_lot` index); public lot queries return `lotNumber`/`province`/`watcherCount`, `getSellerInfo` returns `sellerResponseTime`; event lead photos now order by `lotNumber`; seed sets all of it; run `migrations:backfillLotNumbers` and `migrations:backfillWatcherCounts` once after deploy (0.21.0)
- Auction event summary (WP3a of improve-screen-mockups): `getPublishedAuctions` now also returns `lotCountCapped`, `fromPrice`, `leadImageUrls` (up to 3, one per lot), `location` and `effectiveEndTime` (client derives live/upcoming/closed via `getEventBucket`); its `lotCount` now counts buyer-visible lots only (was all lots incl. drafts/hidden); `AuctionEventCard` shows lot count and from-price (0.20.0)
- Design-system components and reference (WP2 of improve-screen-mockups): `src/components/ds/` (StatusBadge, ReservePill, Money, Countdown, PhotoFrame, EventMosaic, SaleTerms, SpecTable, ConditionReport, SectionHeader, SegmentedControl, FilterChips, StickyActionBar), `formatRand` and `formatSastDate`, `deriveDisplayStatus`, `CountdownTimer` now wraps `Countdown`, dev-only `/design-system` page, `docs/architecture/ui-design/design-system.md` (+ ADR 0015); WP1 follow-ups: no glow on header/mobile-menu buttons, compact lot-card Bid label 13px, dark-mode focus ring lifted and contrast-tested (0.19.0)
- Design-system foundations (WP1 of improve-screen-mockups): new tokens in `src/index.css` (surfaces, `btn`, `hero`, status solid/soft/fg, `ok-fg`/`warn-fg`), Lora display font, `.num`, 4/6/8px radius, global focus ring; Button (44px touch targets below md, `touch` size, `btn` token), Badge (`rounded-sm` + status variants), Input, Tabs and Card restyled; WCAG AA contrast tests for both themes (0.18.0)
- Fix the orphaned-upload sweep data-loss bug: it now pages `lots`, `profiles` and `auctions` to completion in an action and deletes nothing if the scan cannot finish; `bunx convex codegen` confirmed `convex/_generated` already current (0.17.36)
- Bump prettier 3.10, convex 1.50, eslint 10, @eslint/js 10, @convex-dev/eslint-plugin 5 with eslint-plugin-jsdoc 65, import-x 4.18 and react-hooks 7.1; fix the new lint errors in source (supersedes #388 #389 #390 #391; TypeScript 7 #392 held) (0.17.35)

## 2026-10

- Bump typescript-eslint to 8.71.2 and remove the redundant type assertions its stricter rules flag (#380) (0.17.34)
- Bump tailwindcss 4.3.3, globals 17.13, lucide-react 1.59 and vitest/@vitest/coverage-v8/@vitest/ui 5.0.5 together (#381 #382 #383 #384) (0.17.33)
- Per-job background cron switches on `/admin/performance`; crons target gated wrappers and all jobs default to off (0.17.32)
- Split FeeManager, MetadataCatalog and FilterSidebar into focused modules (#302) (0.17.31)
- Set-based lot watch lookup, split MyBids into components, reuse the profile context (#303) (0.17.30)
- Add a `convex-test` integration suite for bid -> proxy -> soft close -> settlement -> fees (browser E2E still open) (#299) (0.17.29)
- Share cursor-parsing and display-name resolution helpers across Convex queries (#302) (0.17.28)
- Standardise on the `radix-ui` umbrella import and drop the per-package Radix dependencies (#308) (0.17.27)
- Coverage now measures unimported files and writes `test-coverage/latest-coverage-output.txt`; thresholds raised; broad unit-test additions (E2E still open) (#299) (0.17.26)
- Cursor-based `getMyBids` pagination over a bidder/timestamp index (ending sort bounded to 200 lots) with integration tests (#335) (0.17.25)
- Index-driven batched settlement, unified reserve check, fee-total counters (run `admin_utils:recomputeLotFeeCounters` once after deploy) (#305) (0.17.24)
- Dedupe `useListingWizard` and split the Profile page into components (backend duplication and other 500+ line files still open) (#302) (0.17.23)
- Drop unused autoprefixer/postcss/coverage-istanbul deps, add `engines`, align packageManager, ignore stale `app/` dir (Radix import strategy still open) (#308) (0.17.22)
- Accessibility fixes: focus trap, table scope, label links, live regions, hidden decorative icons (#304) (0.17.21)
- Split convex/errors.ts helpers into convex/lib modules (#282) (0.17.20)
- Batch lot summary lookups, bound the storage sweep, add platformFees/equipmentMetadata indexes (#337) (0.17.19)
- Paginate notifications with bounded per-stream reads and a compound cursor (#336) (0.17.18)
- Replace hardcoded palette classes with theme tokens and add a guard test (#300) (0.17.17)
- Add input length caps and per-user rate limits on write mutations (#298) (0.17.16)
- Harden destructive seed access (no preview bypass, explicit dev opt-in), audit-log seed/promotion, add deny-path tests (#297) (0.17.15)
- Memoize contexts, nest admin routes under a shared layout, Set-based watchlist lookups (#303) (0.17.14)
- Admin audit skeleton, category empty state, tooltips, wizard/search/bid-form polish (#343) (0.17.13)
- Format the finance fee tooltip amount with formatCurrency (other call sites already used the shared helper) (#301) (0.17.12)
- Add regression tests for auction startTime enforcement (already enforced; stale issue) (#296) (0.17.11)
- Derive presence threshold from heartbeat interval, fix flag counter race, add audit logging, show cooldown seconds (#338) (0.17.10)
- Filter Home status tabs server-side and scope the time tick (#339) (0.17.9)
- Use shadcn Checkbox and AlertDialog, remove eslint-disable in BidForm (#342) (0.17.8)
- Add per-route error boundaries (#341) (0.17.7)
- Paginate support tickets and use shared pagination constants (#340) (0.17.6)
- Noindex private pages, dev-safe site URL fallback, toast on mark-read failure (#344) (0.17.5)
- Add catch-all 404 route and NotFound page (#306) (0.17.4)
- Reconcile stale docs: fix app/ paths, regenerate schema reference, correct test command (#307) (0.17.3)
- Polish tablet/phone layouts on auctions, lots and lot-detail pages: fix price/countdown/quick-bid overflow with container queries, tighten spacing, compact footer (0.17.2)

## 2026-09

- Fix production crash by removing manual vendor-react chunk grouping (#322)
- Finish multi-lot auctions rework (#318, #321)
- Serve HTTPS dev server with a Tailscale-issued certificate (#320)
- Fix IDOR in `getAuctionFeesForUser`; add scheduled auction support (#319)
- Upgrade Convex to 1.45.0 and migrate to explicit table IDs (#317)
- Migrate to Vite 8 (#316)
- Bump React and React DOM to 19.3.0 (#315)
- Bump `@radix-ui/react-alert-dialog` to 1.1.23 (#313)
- Bump `@testing-library/react` to 16.3.3 (#310)
- Bump `actions/checkout` from 4 to 7 (#309)
- Add repo governance files and CI workflow (#292)
- Make currency formatting deterministic across platforms (#294)
- Sanitize error reports before persisting or posting to GitHub (#288)
- Add per-user cooldown on bid placement (#290)
- Hoist `convex/_generated/api` mock to module top level in tests (#289)
- Docs: require PRs for all changes to main, no direct pushes (#291)
- Restrict the `@claude` workflow to the repo owner only (#287)
- Resolve ESLint warnings across the codebase, 524 to 2 (#280)
- Merge feature stack: seller listings, reviews, messaging, report-profile,
  activity feed, og-image and showcase mock data (#279)
- Bump `eslint-plugin-react-refresh` to 0.5.6 (#276)
- Add Claude GitHub Actions (#277)
- Change Dependabot package ecosystem to bun (#271)
- Visual refresh: calm typography, image reliability, admin/nav consistency (#270)
- Add `og-image.png` for social preview cards (#264, closes #217)
- Add user activity feed system (#263, closes #220)
- Add seller messaging/contact system (#262, closes #231)
- Add docstrings for the report-profile feature (#266)
- Wire up granular seller verification status fields (#257, closes #219)
- Add seller-filtered auction listing page (#258, closes #233)
- Make Clerk auth config env-driven and correct stale Better Auth docs (#255)
- Install Vercel Web Analytics (#256)
- Migrate authentication from Better Auth to Clerk (#254)
- Version bumps to 0.9.1 and 0.10.0 (2026-09-05, from git log)

## 2026-03

- Add dynamic branding context for configurable app name (#252)
- Add user settings persistence across sessions (#250, closes #118)
- Add business info admin page for SEO structured data (#247, closes #132)
- Add `startTime` bounds validation for auctions (#246, closes #215)
- Fix `isWatched` hardcoded to false in related auctions (#240, closes #214)
- Correct JSDoc (#239)
- Update `ISSUES_CHECKLIST.md` (#238)
- Merge hamburger menu into profile dropdown on mobile (#237)
- Implement configurable platform fees system (#235)
- Remove unused `window.open` mock from AdminSettings test (#234)
- Profile page UI refresh: mobile-first, fewer cards, sharper corners (#229)
- Add `activeListings` to `getSellerInfo` return validator (#228)
- Update profile page (#222, closes #131)
- Phase 1 SEO: meta tags, structured data, technical foundation (#212)
- Implement automatic error reporting and GitHub issue creation (#211)
- Eliminate barrel `index.ts` files (#209, closes #199)
- Migrate from `tsc` to `tsgo` for faster type-checking (#208)
- Integrate KYC pending count into admin User Base summary card (#207, closes #71)
- Revise README.md for best practices (#205, closes #75)
- Batch `readReceipts` queries to eliminate N+1 in notifications (#203, closes #66)
- Paginate sold auction scans in admin financial stats to fix 200-limit bug
  (#204, closes #81)
- Resolve lint errors and update issues checklist (#202)
- Rename "Live Users" to "Online Users" in admin KPI header strip (#201, closes #74)
- Recreate lost auction mutation changes (#200)
- Enhance loading states with skeleton components (#197)
- Animate sidebar collapse on Home page (#196)
- Generic context factory and hook deduplication (#195)
- Centralize hooks into `src/hooks` (#194)
- Refactor auction mutations, proxy bidding and constants cleanup (#193;
  conductor track "split auction mutations by feature")
- Fix auction card image sizing and add resize animation (#192)
- Resolve form field accessibility warnings (#191, closes #140)
- UX quick wins and test stability fixes (#189)
- Resolve senior developer review findings for the queries split (#188)
- Pagination refactor (#186)
- Strict lint/TypeScript (#182), reverted in #185
- Increase test coverage (#183)
- Move app to repo root (#181)
- Equipment metadata management on the admin page (#176)
- Agribid code quality pass (#175)
- Pagination refactor and security hardening (#159)
- Fix inconsistent imports (#173)
- Admin dashboard user count fix (#158, closes #139)
- Admin live monitor loading fix (#156, closes #138)
- My Bids page: group bids by auction (#154, closes #144)
- Fix duplicate auction indexes (#160)
- Listing lifecycle: drafts and refinement, merged with auction lifecycle
  management (#152)
- Fix for issue #40 (#153)
- Docs: update conductor and plan (#147)
- Remove shipping and payments (#150)
- Add CodeRabbit CLI (#146)
- Highlight price on change (#145)
- Proxy bidding (auto-bid) (#143)
- Fix search filter (#142)

## 2026-02

- Remove online status indicator (#130)
- Fix context type instantiation error (#128)
- Closed-auction handling (#127, closes #113)
- Component relocation (#122, closes #111)
- Consolidate and type-safe refactor (#119)
- Preview Convex deploy config (#120)
- Status filter for auctions (#115)
- Version pipeline from `package.json` to AdminDashboard (#108); version 0.2.1
  finalized (2026-02-25)
- Auction early closure (#104)
- Switch package manager to bun (#101)
- Separate hooks from contexts (#98)
- Use ConvexError for validation (#97)
- Update Gemini agents file (#96)
- Modularize backend (#90)
- Type-safety enhancements (#89)
- Performance optimization (#79, #87; conductor track)
- Admin dashboard (#69, closes #64)
- Fix Vercel routing 404 (#68, closes #67)
- Admin route refactor (#65; conductor track for issues #62, #57, #56, #58)
- Prettier/Husky fix (#61)
- Modularization refactor (#54; conductor track)
- Loader standardization (#49, #52)
- Skeleton loading (#51)
- KYC approved view (#43)
- Fix Convex error handling (#41)
- Admin portal testing (#35, #36)
- README feature docs update (#34)
- Compact card height fixes (#32, #33)
- Mobile compact cards (#30)
- Seller profile query optimization (#28)
- Seller profiles and verification (#22; conductor track)
- Wizard polish (#27)
- Code splitting performance work (#24)
- Vercel schema validation fix (#26)
- Listing integrity / wizard hardening (#21; conductor track)
- Watchlist functionality (#16; conductor track)
- Logged-out user view / guest restrictions (#15; conductor track)
- Listing wizard modularity refactor (#13; conductor track)
- Preview seeding (#12)
- Vercel deployment fixes (#9, #11; conductor track "deploy to vercel")
- Global navigation and brand layout (#7; conductor track)
- Stationary bid panel fix (#6)
- Seller listing flow (#4; conductor track)
- Auction detail page and bid submission flow (#1; conductor track)
- Listing creation and Convex File Storage integration (conductor track,
  2026-02-15)
- Auction lifecycle and settlement (conductor track, 2026-02-16)
- Initial repository commit (2026-02-12)

## Foundation

Summarised from the root `Checklist.md` (historical build log, 149 items
checked and 25 open at time of writing) and `docs/features/completed.md`.

- Setup: Vite/React/TypeScript app, Tailwind CSS, Convex backend and schema
  (auctions, bids, users, notifications, watchlist, audit logs, support).
- Authentication: initially Better Auth (email/password, Google OAuth); since
  replaced by Clerk (see #254, #255). Convex verifies the Clerk JWT natively.
- Roles and access: centralized RBAC utilities; admin and KYC-gated flows.
- Bidding engine: real-time bids via Convex reactivity, bid history and
  confirmation, soft-close anti-sniping (2-minute extension), later proxy
  bidding.
- Auctions: dashboard grid with filters and density views, detail page with
  image gallery and countdown timers, cron-driven settlement with reserve price
  handling and winner/seller notifications.
- Listings: 4-step listing wizard, image upload to Convex storage, condition
  checklist, status tracking (Draft, Pending Review, Active, Sold/Unsold).
- Dashboards: buyer (My Bids), seller (My Listings), watchlist, notifications
  page.
- Profiles and KYC: profile management, KYC document upload and verification
  status.
- Admin: dashboard stats, moderation, bulk operations, KYC review, support
  tickets, audit logs, announcements, bid monitor.
- Security: PII encryption (AES-256-GCM), audit trail, open-redirect
  protection, server-side validation.
- Quality and deployment: Vitest unit/integration tests, responsive and
  accessible UI, Vercel and Convex deployment configuration.
- Not built per the checklist: items such as the AI chatbot section remain
  unchecked.
