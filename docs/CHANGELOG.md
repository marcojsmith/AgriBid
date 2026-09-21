# Changelog

Full history of what shipped, newest first. `STATUS.md` keeps only the last ~10
items; this file is the complete record. Items are drawn from merged PRs on
`main` (PR numbers in parentheses), completed conductor tracks and the original
build checklist. Dates are merge dates.

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
