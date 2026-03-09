# AgriBid Issue Resolution Plan

> Last Updated: March 9, 2026
> Total Open Issues: 24

---

## Quick Wins (Start Here)

These are low-risk, isolated frontend fixes that can be completed quickly to build momentum.

### QW-1: Fix Form Field Missing id/name Attribute
- **Issue**: #140
- **Labels**: quick-win, frontend
- **Description**: Browser console warning about form field missing id or name attribute on auction detail page bid form
- **Steps**:
  1. Navigate to auction detail page with bid form
  2. Inspect browser console for warning
  3. Find the bid input field in the component
  4. Add `id` and `name` attributes to the input
- **Verification**: Refresh page, verify no console warnings
- **Dependencies**: None

### QW-2: Fix Images Not Same Size in Auction Cards (Compact View)
- **Issue**: #114
- **Labels**: quick-win, frontend
- **Description**: Auction card images have inconsistent sizes in compact view
- **Steps**:
  1. Find auction card component(s) in `app/src/components/`
  2. Apply consistent height/width to image containers using CSS
  3. Use `object-fit: cover` for images
- **Verification**: View marketplace in compact mode, all images should be uniform
- **Dependencies**: None

### QW-3: Change Filters to Dropdowns
- **Issue**: #112
- **Labels**: quick-win, frontend
- **Description**: Change year min/max, price min/max, and operating hours max filters to dropdown fields
- **Steps**:
  1. Find filter panel component in `app/src/components/listing-filters/` or similar
  2. Replace text/number inputs with Select dropdown components for:
     - Year (min and max)
     - Price (min and max)
     - Operating hours (max)
  3. Use shadcn/ui Select component
- **Verification**: Filter panel shows dropdowns instead of text inputs
- **Dependencies**: None

### QW-4: Add Resize Animation to Auction Cards
- **Issue**: #110
- **Labels**: quick-win, frontend
- **Description**: Add smooth resize animation when filters panel is toggled
- **Steps**:
  1. Find the filter panel toggle logic in marketplace page
  2. Add CSS transition to auction grid/list container
  3. Add animation class that triggers on filter panel show/hide
- **Verification**: Cards smoothly resize when toggling filters
- **Dependencies**: None

---

## Phase 1: Infrastructure & Code Quality

### P1-1: Add Type-Checking and Tests to Pre-Commit Hook
- **Issue**: #165
- **Priority**: HIGH
- **Description**: Pre-commit hook runs linting/build but missing TypeScript type checking and test running
- **Steps**:
  1. Read current `app/package.json` scripts section
  2. Add `typecheck` script: `tsc --noEmit`
  3. Update `.husky/pre-commit` to run typecheck and tests
  4. Verify hook fails on type errors and test failures
- **Verification**: `bun run typecheck` and `bun run test` both work; hook blocks bad commits
- **Dependencies**: None

### P1-2: Configure Test Coverage Reporting
- **Issue**: #170
- **Priority**: MEDIUM
- **Description**: No test coverage reporting configured in Vitest
- **Steps**:
  1. Read `app/vitest.config.ts`
  2. Add `coverage` configuration with:
     - Provider: `v8`
     - Reporters: `text`, `json`, `html`
     - Include: `src/**/*.ts`, `src/**/*.tsx`
     - Exclude: `src/test/**`, `src/**/*.d.ts`
  3. Add coverage scripts to `package.json`
  4. Add `coverage/` to `.gitignore`
- **Verification**: `bun run test:coverage` generates reports
- **Dependencies**: P1-1 (tests must work first)

### P1-3: Increase Vitest Coverage Thresholds
- **Issue**: #174
- **Priority**: MEDIUM
- **Description**: Current thresholds below best practice; goal is 80%+
- **Steps**:
  1. Read current thresholds in `app/vitest.config.ts`
  2. Incrementally increase to: Statements 50%, Branches 45%, Functions 55%, Lines 50%
  3. Run coverage to identify gaps
  4. Add more tests to meet thresholds
  5. Repeat until reaching best practice levels (80%+)
- **Verification**: Coverage reports show passing thresholds
- **Dependencies**: P1-2 (coverage must be configured first)

### P1-4: Enhance ESLint with Stricter Rules
- **Issue**: #171
- **Priority**: MEDIUM
- **Description**: Current ESLint uses only recommended rules
- **Steps**:
  1. Read `app/eslint.config.js`
  2. Add recommended rules:
     - `no-console`: error (allow warn/error)
     - `no-debugger`: error
     - `prefer-const`: error
     - `no-var`: error
     - `eqeqeq`: error
     - `@typescript-eslint/no-unused-vars`: error
     - `@typescript-eslint/no-explicit-any`: warn
     - Complexity rules (max-lines-per-function, max-depth)
  3. Run `bun run lint` and fix any violations
- **Verification**: Lint passes with new rules
- **Dependencies**: None

### P1-5: Extract Magic Numbers into Named Constants
- **Issue**: #168
- **Priority**: MEDIUM
- **Description**: Magic numbers throughout codebase should be named constants
- **Steps**:
  1. Search for magic numbers in codebase:
     - `3600000` = 1 hour (CountdownTimer.tsx)
     - `10000`, `8000` = toast durations (NotificationListener.tsx)
     - Other time-related numbers
  2. Create `app/src/lib/constants.ts`:
     ```typescript
     export const TIME = {
       ONE_SECOND_MS: 1_000,
       ONE_MINUTE_MS: 60_000,
       ONE_HOUR_MS: 3_600_000,
       ONE_DAY_MS: 86_400_000,
     } as const;
     
     export const TOAST = {
       SETTLEMENT_DURATION: 10_000,
       UNSOLD_DURATION: 8_000,
       DEFAULT_DURATION: 5_000,
     } as const;
     
     export const BIDDING = {
       MIN_INCREMENT: 1,
       SOFT_CLOSE_MINUTES: 5,
     } as const;
     ```
  3. Replace all magic numbers with constants
- **Verification**: Build passes, constants properly imported
- **Dependencies**: None

### P1-6: Centralize Custom Hooks
- **Issue**: #167
- **Priority**: MEDIUM
- **Description**: Hooks scattered across multiple directories
- **Steps**:
  1. Find all hooks: `find app/src -name "use*.ts" -o -name "use*.tsx"`
  2. Current locations:
     - `app/src/hooks/`
     - `app/src/pages/admin/hooks/`
     - `app/src/pages/kyc/hooks/`
     - `app/src/components/listing-wizard/hooks/`
  3. Create organized structure in `app/src/hooks/`:
     ```
     hooks/
     ├── index.ts
     ├── auth/useAuthRedirect.ts
     ├── auth/useSession.ts
     ├── ui/useMediaQuery.ts
     ├── ui/usePriceHighlight.ts
     ├── admin/useAdminStats.ts
     ├── kyc/useKYCStep.ts
     └── listing/useListingWizard.ts
     ```
  4. Move hooks preserving git history (`git mv`)
  5. Update all imports across codebase
  6. Remove old hook directories
- **Verification**: All hooks importable from `app/src/hooks/`, build passes
- **Dependencies**: None

### P1-7: Replace Default README.md
- **Issue**: #172
- **Priority**: LOW
- **Description**: `app/README.md` is default Vite template, not project-specific
- **Steps**:
  1. Read current `app/README.md`
  2. Read `README.md` at root for context
  3. Replace with project-specific content:
     - Tech stack (React 19 + Vite, TypeScript, Tailwind, shadcn/ui, Convex, Vitest)
     - Project structure
     - Commands table
     - Convex integration notes
- **Verification**: README reflects AgriBid project
- **Dependencies**: None

---

## Phase 2: Backend Refactoring

### P2-1: Fix admin.ts 200 Auction Limit Bug
- **Issue**: #81
- **Priority**: HIGH
- **Description**: `.take(200)` silently truncates results, causing inaccurate financial stats
- **Steps**:
  1. Read `app/convex/admin.ts` lines 207-211
  2. Implement pagination to fetch all sold auctions
  3. Add warning flag to returned stats when results are partial
  4. Update UI to display warning if `partialResults=true`
- **Verification**: Admin stats show accurate totals regardless of auction count
- **Dependencies**: None

### P2-2: Split auctions/queries.ts (729 Lines)
- **Issue**: #163
- **Priority**: HIGH
- **Description**: Oversized file needs splitting by feature
- **Steps**:
  1. Read `app/convex/auctions/queries.ts`
  2. Categorize queries:
     - Single item: `getAuctionById`, `getBidById`
     - Lists/Feeds: `getAuctions`, `getActiveAuctions`, `getUserAuctions`
     - User-specific: `getUserBids`, `getUserWatchlist`, `getMyAuctions`
     - Aggregations: `getAuctionBids`, `getBidHistory`
  3. Create `app/convex/auctions/queries/` directory:
     ```
     queries/
     ├── index.ts       # Re-exports all
     ├── auction.ts     # Single auction queries
     ├── list.ts        # Auction list/feed
     ├── user.ts        # User-specific queries
     └── bidding.ts     # Bid-related queries
     ```
  4. Move functions to appropriate files
  5. Update all imports in frontend and backend
  6. Verify real-time subscriptions still work
- **Verification**: Build passes, all query functions work
- **Dependencies**: P2-1 (fix critical bug first)

### P2-3: Split auctions/mutations.ts (1,182 Lines)
- **Issue**: #162
- **Priority**: HIGH
- **Description**: Oversized file with ~25 mutations needs splitting
- **Steps**:
  1. Read `app/convex/auctions/mutations.ts`
  2. Categorize mutations:
     - Create: `createAuction`, `createBid`
     - Update: `updateAuction`, `updateBid`, `updateConditionReport`
     - Delete: `deleteAuction`, `cancelBid`
     - Publish/Status: `publishAuction`, `rejectAuction`
     - Admin: `adminDelete`, `adminForceClose`
  3. Create `app/convex/auctions/mutations/` directory:
     ```
     mutations/
     ├── index.ts    # Re-exports all
     ├── create.ts   # Auction creation
     ├── update.ts   # Update mutations
     ├── delete.ts   # Delete/cancel
     ├── publish.ts  # Status/publish
     └── bidding.ts  # Bid-related mutations
     ```
  4. Move functions preserving git blame (`git mv`)
  5. Update all imports across codebase
  6. Test all Convex functions
- **Verification**: Build passes, all mutations work
- **Dependencies**: P2-2 (complete after queries split)

### P2-4: Implement Pagination for Queries
- **Issue**: #82
- **Priority**: MEDIUM
- **Description**: All list-based queries need pagination support
- **Steps**:
  1. Identify all list queries (after P2-2/P2-3 split):
     - `getActiveAuctions`
     - `getUserAuctions`
     - `getUserBids`
     - `getWatchlist`
  2. Add cursor-based pagination to each:
     - Accept `cursor` and `numItems` parameters
     - Return `{ items: [], nextCursor }` structure
  3. Update frontend components to handle pagination
- **Verification**: Large lists load in chunks, no performance issues
- **Dependencies**: P2-2, P2-3 (queries/mutations split complete)

---

## Phase 3: Feature Development & UX

### P3-1: Add Loading Spinners/Skeleton Components
- **Issue**: #157
- **Priority**: HIGH
- **Description**: All pages need loading states before data fetches complete
- **Steps**:
  1. Identify all pages that fetch data:
     - Marketplace/Landing page
     - Auction detail page
     - User profile page
     - Admin dashboard
     - Listing wizard
  2. Add skeleton components using shadcn/ui Skeleton
  3. Implement loading states:
     - Show skeleton immediately on page mount
     - Keep showing until query completes
     - Graceful transition to content
- **Verification**: No layout shift on data load; skeletons visible during fetch
- **Dependencies**: P2-2, P2-3 (pagination ready for large lists)

### P3-2: Update Profile Page
- **Issue**: #131
- **Priority**: MEDIUM
- **Description**: Enhance profile page with new cards and features from prototype
- **Steps**:
  1. Read current profile page in `app/src/pages/profile/`
  2. Implement new features from prototype:
     - Profile card with banner and avatar
     - Stats grid (active listings, items sold, avg price, bids placed)
     - Rating row with stars
     - Action buttons (verify, list equipment, contact, report)
     - Active auctions section
     - Past sales section
     - Activity timeline
     - Trust & compliance grid
  3. Use existing theme tokens (green-dark, green-mid, cream, etc.)
- **Verification**: Profile page matches prototype design
- **Dependencies**: P3-1 (loading states ready)

### P3-3: Admin Page for Business Info
- **Issue**: #132
- **Priority**: MEDIUM
- **Description**: Admin can update footer business info (address, phone, etc.)
- **Steps**:
  1. Create new table in `app/convex/schema.ts` for business info:
     ```typescript
     businessInfo: defineTable({
       name: string,
       address: string,
       phone: string,
       email: string,
       description: string,
       updatedAt: number,
     })
     ```
  2. Create Convex query: `getBusinessInfo`
  3. Create Convex mutation: `updateBusinessInfo`
  4. Create admin page at `app/src/pages/admin/business-info/`
  5. Update footer component to fetch from Convex
- **Verification**: Admin can edit; footer displays updated info
- **Dependencies**: P2-2 (queries split complete)

### P3-4: Configure Platform Fees
- **Issue**: #106
- **Priority**: MEDIUM
- **Description**: Admin can configure platform fees on admin dashboard
- **Steps**:
  1. Add platform settings table in schema or extend businessInfo:
     ```typescript
     platformFees: {
       buyerPremium: number,      // e.g., 10%
       sellerCommission: number,  // e.g., 5%
       minimumFee: number,        // e.g., 100
     }
     ```
  2. Create query: `getPlatformFees`
  3. Create mutation: `updatePlatformFees`
  4. Add UI to admin dashboard settings
  5. Use fees in auction calculations (settlement, commission)
- **Verification**: Admin can set fees; auctions calculate correctly
- **Dependencies**: P3-3 (business info table exists)

### P3-5: Manage Equipment Metadata
- **Issue**: #105
- **Priority**: MEDIUM
- **Description**: Admin can manage equipment metadata on admin page
- **Steps**:
  1. Review existing `equipmentMetadata` table in schema
  2. Create admin UI to CRUD metadata:
     - Categories (tractors, combines, sprayers, etc.)
     - Manufacturers
     - Models
     - Condition types
  3. Create mutations: `createMetadata`, `updateMetadata`, `deleteMetadata`
  4. Add to admin dashboard
- **Verification**: Admin can manage all equipment metadata
- **Dependencies**: P3-3 (admin infrastructure ready)

### P3-6: Remember User Settings
- **Issue**: #118
- **Priority**: LOW
- **Description**: Persist user preferences (compact/detailed view, etc.)
- **Steps**:
  1. Identify settings to persist:
     - Marketplace view mode (compact/detailed)
     - Theme preference (if applicable)
     - Filter preferences
  2. Use localStorage or create user preferences table in Convex
  3. Create hooks: `useUserSettings`, `useUpdateSettings`
  4. Apply settings on page load
- **Verification**: Settings persist across sessions
- **Dependencies**: None (can be done anytime)

---

## Phase 4: Major Features & Testing

### P4-1: Create Sufficient Unit Tests
- **Issue**: #84
- **Priority**: HIGH
- **Description**: Comprehensive unit testing strategy for codebase
- **Steps**:
  1. Audit current test coverage with `bun run test:coverage`
  2. Identify untested critical paths:
     - Bidding logic (placeBid, soft close)
     - Auction state transitions
     - Authentication flow
     - Admin functions
  3. Write tests following best practices:
     - Test real-world use cases
     - No unnecessary tests
     - Focus on business logic
  4. Configure CI to block merge on test failure
- **Verification**: Coverage > 80%, all tests pass before merge
- **Dependencies**: P1-2, P1-3, P2-2, P2-3 (coverage configured, refactoring done)

### P4-2: SEO Optimization
- **Issue**: #133
- **Priority**: MEDIUM
- **Description**: Implement SEO strategy for auction platform
- **Steps**:
  1. Audit current SEO:
     - Meta tags on all pages
     - Open Graph tags
     - Structured data (JSON-LD)
     - Sitemap.xml
     - robots.txt
  2. Implement improvements:
     - Add react-helmet or next-seo
     - Dynamic meta tags for auction pages
     - Add structured data for products
     - Create sitemap generation
  3. Verify with Lighthouse
- **Verification**: Lighthouse SEO score > 90
- **Dependencies**: None

### P4-3: Align Brief.md with Implementation
- **Issue**: #149
- **Priority**: LOW
- **Description**: Ensure product documentation matches current implementation
- **Steps**:
  1. Read `Brief.md`
  2. Compare with implemented features in Checklist.md
  3. Update Brief.md to reflect actual implementation phases
- **Verification**: Brief.md accurate
- **Dependencies**: None

### P4-4: HTTP/2+ Protocol
- **Issue**: #151
- **Priority**: LOW
- **Description**: Enable HTTP/2+ for better performance
- **Steps**:
  1. Check current Vercel configuration
  2. Verify server supports HTTP/2
  3. Update if needed (usually automatic on Vercel)
- **Verification**: Network tab shows h2 or h3 protocol
- **Dependencies**: None

### P4-5: AI Chatbot Support
- **Issue**: #129
- **Priority**: LOW
- **Description**: Add AI chatbot for user support
- **Steps**:
  1. Research chatbot options (OpenAI, Anthropic, etc.)
  2. Design conversation flows for:
     - Finding equipment
     - Listing questions
     - Bidding help
     - Account support
  3. Implement chatbot UI
  4. Connect to AI backend
  5. Set up content moderation
- **Verification**: Chatbot responds to user queries
- **Dependencies**: None

---

## Execution Order

```
Phase 0: Quick Wins (Can run in parallel)
├── QW-1: Form field id/name fix
├── QW-2: Image size fix
├── QW-3: Filter dropdowns
└── QW-4: Resize animation

Phase 1: Infrastructure (Sequential)
├── P1-1: Pre-commit hook (HIGH)
├── P1-2: Coverage reporting
├── P1-3: Increase thresholds
├── P1-4: ESLint rules
├── P1-5: Magic constants
├── P1-6: Centralize hooks
└── P1-7: README

Phase 2: Backend Refactoring (Sequential)
├── P2-1: admin.ts 200 limit bug (HIGH)
├── P2-2: Split queries.ts
├── P2-3: Split mutations.ts
└── P2-4: Pagination

Phase 3: Features (Can partially parallel)
├── P3-1: Loading states (HIGH)
├── P3-2: Profile page
├── P3-3: Business info admin
├── P3-4: Platform fees
├── P3-5: Equipment metadata
└── P3-6: User settings

Phase 4: Major Features
├── P4-1: Unit tests (HIGH)
├── P4-2: SEO
├── P4-3: Brief.md alignment
├── P4-4: HTTP/2+
└── P4-5: AI chatbot
```

---

## Notes

- Quick Wins should be completed first to build momentum
- Phase 1 establishes quality gates - do before significant new work
- Phase 2 refactoring enables Phase 3 features
- Phase 4 can run in parallel after Phases 1-3 complete
- Some dependencies are soft - use judgment on execution order
