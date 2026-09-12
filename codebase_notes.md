# Development Notes

## Current Status (2026-03-30)

- **User Preferences Storage**: Implemented persistent user preferences (Issue #118). The system stores view mode, sidebar state, filter defaults, bidding preferences, and notification settings in Convex database. Profile editing for bio, location, and companyName is now available.
- **Proxy Bidding**: Fully implemented (backend & frontend). Auto-incrementing logic verified.
- **Admin Portal**: Route-based refactor complete. KPIs and moderation flows are isolated to local route state.
- **Performance**: Image caching, paginated queries, and context-based state management implemented.
- **Listing Lifecycle & Management**: Implemented draft persistence, update/publish flow, and condition report uploads.
- **Admin Moderation**: Integrated flagging system with auto-hide thresholds and admin review dashboard.
- **Settlement & Cleanup**: Automated auction settlement (Sold/Unsold) and periodic cleanup of abandoned drafts.

## Visual Refresh Phase 1 — Foundation (2026-09-09)

- **Inter font**: Loaded via Google Fonts `<link>` in `index.html` (repo loads assets there; no fontsource pattern existed). `--font-sans` set in the `@theme` block of `src/index.css` so Tailwind's default `font-sans` picks it up — no per-component font-family overrides.
- **Image fallbacks are content-addressed**: `AuctionCardThumbnail` tracks the failed URL (not a boolean) and `ImageGallery` tracks a `Set<string>` of failed URLs. This avoids `react-hooks/set-state-in-effect` violations (eslint-plugin-react-hooks v7 errors on `setState` inside effects used for prop-change resets) and recovers automatically when the URL changes — no reset effect needed.
- **AuctionDetail delegates**: the page has no inline price display or gallery `<img>` — prices live in `BiddingPanel.tsx`, images in `ImageGallery.tsx`. Fix those components, not the page.
- **Lint baseline**: repo tolerates ~524 pre-existing eslint warnings (mostly jsdoc params, `no-unnecessary-condition`, `detect-object-injection` in tests); lint passes on 0 errors. New code should not add warnings beyond this baseline.
- **Remaining visual noise (follow-up phases)**: `BiddingPanel.tsx` and `AuctionCardPrice.tsx` still use `uppercase`/`font-black` labels ("Current Bid", "Ends In", closed-state copy) — intentionally left for the later phases per the phase-1 scope.

## Visual Refresh Phase 2 — Marketplace (2026-09-09)

- **Filter chips replace "Filters Applied" text**: `Home.tsx` now derives `activeFilterChips` (make, combined year/price ranges, maxHours, explicit URL status) and renders removable outline `Button` pills below the heading. Removal copies `searchParams` → deletes the chip's keys → `setSearchParams` (mirrors `FilterSidebar`'s reset pattern; the sidebar's URL→local sync effect picks the change up automatically).
- **Status chip is URL-only by design**: `statusFilter` falls back to `preferences.defaultStatusFilter` when the URL has no `status` param. A chip built from that fallback can't be removed (deleting an absent param is a no-op and the preference recreates it), so the chip is only rendered for an explicit valid non-active URL status (`isValidStatus(rawStatus) && rawStatus !== "active"`). The chips row gate is `activeFilterChips.length > 0`, not the old `hasActiveFilters` (removed).
- **Card footer bid button**: `variant` is now conditional — `default` (filled) in compact view (primary mobile tap target), `outline` in detailed view, per the design feedback to reserve the strongest bid treatment for the detail page.
- **Defaults buttons pending state**: `FilterSidebar` tracks `pendingDefaultsAction: "save" | "clear" | null`; both buttons disable while a write is in flight and the in-flight one shows "Saving..."/"Clearing..." (CodeRabbit flagged the missing feedback per the UI guidelines).
- **CodeRabbit CLI syntax drift**: AGENTS.md documents `bunx coderabbit --prompt-only --type uncommitted`, but the installed CLI (0.7.6) only supports `bunx coderabbit review --uncommitted` (`--prompt-only` errors as an unknown option). Update AGENTS.md when convenient.
- **Remaining visual noise (phase 3)**: `AuctionCardPrice.tsx` labels ("Current Bid", "Ends In") still use `uppercase font-black tracking-widest`; `AuctionHeader.tsx`, `BidConfirmation.tsx`, and `BiddingPanel.tsx` keep their heavy treatment — out of scope here, slated for phase 3.

## Visual Refresh Phase 3 — Auction Detail & Bidding (2026-09-09)

- **`react-hooks/purity` rejects `Date.now()` in render bodies (error, not warning)**: new components must read the clock via a lazy state initializer — `const [now] = useState(() => Date.now())` — as `CountdownTimer` and `MobileBidBar` do. `BiddingPanel`'s long-standing render-body call isn't currently flagged, but don't copy that pattern into new code.
- **CodeRabbit CLI extras**: untracked (brand-new) files are excluded from `review --uncommitted` by default — pass `--include-untracked`; `bunx coderabbit review findings` reprints stored findings from the most recent review without re-running it.
- **Semantic status tokens exist and are enforced**: `--success`/`--warning` in `src/index.css` (precedent: `SellerInfo`, `FinanceTab`). CodeRabbit majors on any _touched_ line still using hardcoded `green-*`/`amber-*`/`orange-*`/`red-*` — convert to `bg-success/10 border-success/20 text-success` style when editing those lines.
- **Radii rule nuance**: AGENTS.md rule 10 wants `rounded`/`rounded-md` on containers and reserves `rounded-lg` for images/avatars. CodeRabbit flagged the task's `rounded-lg` conversions; containers in `AuctionDetail`/`BiddingPanel`/`BidForm`/`AuctionHeader` now use `rounded-md`.
- **BidForm auto-bid is collapsed by default**: `isProxyExpanded` initialised from `isProxyActive` (starts expanded only for users with an existing proxy bid). Tests must click the `data-testid="auto-bid-toggle"` before touching the proxy checkbox. `#proxy-bidding-section` + `aria-controls`/`aria-expanded` keep the toggle accessible.
- **`#bidding-panel` is a cross-component contract**: the bidding `<aside>` id in `AuctionDetail.tsx` is the scroll target for `MobileBidBar`'s "Place bid" action — keep the id if restructuring the page.
- **Verification checks live in three places** (`BiddingPanel`, `BidForm` call flow, `MobileBidBar`): all mirror the `useQuery(api.users.getMyProfile)` + `profile.isVerified`/`kycStatus` pattern with an explicit `undefined === loading` check; keep them in sync if the profile shape changes.

## Visual Refresh Phase 4 — Admin (2026-09-09)

- **Rule sweep was sufficient, no page redesign**: the substitution table (uppercase/font-black/border-2/oversized radii → calm equivalents) covered every admin file; the post-sweep grep over `src/pages/admin` + `src/components/admin` returns zero matches, and the 12 section-3 pages (AdminDashboard, AdminAudit, AdminFees, …) already had none of the flagged patterns — no changes needed there.
- **Pass/Fail copy change cascades wider than the component**: `ConditionItem` literals `PASS`/`FAIL` → `Pass`/`Fail` (phase-1 SOLD→Sold precedent) required updating `ConditionItem.test.tsx`, `ModerationCard.test.tsx`, **and `AdminModeration.test.tsx`** (page-level test asserting through the card). `BulkActionDialog` dropped its `uppercase` class _and_ its `.toUpperCase()` call (display-only formatting, not business logic), so its test now expects `active`/`unspecified` as authored.
- **CodeRabbit majors to expect on touched admin lines**: (1) hardcoded status colours on touched lines → convert to `bg-success/10 text-success border-success/20` / `bg-warning/10 ...` — there is **no info/blue token**, so the blue "Sold" badge became `bg-primary/10 text-primary` (muted forest green; stays distinguishable from vivid `success` "Active"); (2) any container `rounded-lg` on a non-image/non-avatar → `rounded-md` (AGENTS rule 10). Applied proactively to all admin `AlertDialogContent`s and icon chips, not just the flagged lines.
- **Image-scrim overlay token pattern**: `ModerationCard`'s year badge over the photo went `bg-black/70 text-white` → `bg-foreground/70 text-background` — contrast is guaranteed by construction in both themes (the scrim flips to light in dark mode). Prefer this over raw black/white for overlays on imagery.
- **Pre-existing lint baseline unchanged**: admin files carry long-standing jsdoc `@param` misnomers (`@param label.label` style) and `detect-object-injection` warnings; repo total stayed exactly at the documented ~524-warning baseline (0 errors) — leave for a dedicated cleanup, not a visual sweep.

## Visual Refresh Phase 5 — Nav & Remaining Pages (2026-09-09)

- **Sweep complete — grep gate is the contract**: `grep -rlE "uppercase|font-black|border-2|rounded-(xl|2xl|3xl)" src/pages src/components --include='*.tsx'` (minus the phase-1–4 exclusion list and `admin`) now returns **zero matches**. The final sweep covered the 25 task-listed files plus files the gate turned up: the whole `src/components/listing-wizard/` tree, `auction/FeeBreakdown.tsx`, `bidding/BidHistory.tsx`, and `ui/card.tsx`.
- **`ui/card.tsx` (shadcn base Card) went `rounded-xl` → `rounded-md`**: this is the single Card primitive used app-wide (marketplace, dashboards, KYC, admin), so every Card now renders 6px radius. Individual usages that pass their own `rounded-*` via `className` still win through `cn`.
- **Mobile quick-actions grid is now 2×2 for buyers**: added the missing **Watchlist** link (`/watchlist`, `Heart` icon, matching the desktop `UserDropdown`) to `MobileMenu`'s authenticated grid. Column-span logic inverted: `role === "admin" && "col-span-2"` on My Listings so admins (5 items) get a full-width last row and non-admins (4 items) wrap cleanly. Covered by a new `MobileMenu.test.tsx` assertion.
- **Logo casing is now authored, not forced**: `Header` renders `{branding?.appName ?? "AgriBid"}` — the `.toUpperCase()` JS call is gone (`appName` is "AgriBid" from `BrandingProvider`/`SITE_NAME`, so forcing caps was mangling the brand). `Header.test.tsx` assertions updated `AGRIBID` → `AgriBid`. Note `Footer.tsx` still `.toUpperCase()`es the business name and `LoadingIndicator` prints "AGRIBID LOADING..." — left as-is (tests match those strings; not logo-class scope).
- **Hardcoded status colours remain on lines the sweep never touched** (deliberate per the touched-lines-only rule — a candidate follow-up pass): Profile activity-feed icon chips (`bg-blue-500/10`, `bg-amber-500/10`, `bg-green-500/10`), VerificationStatusSection solid icon circles (`bg-green-500`/`bg-orange-500`/`bg-red-500` + `text-white`), MyBids status strip + countdown, ListingWizard success icon block (`border-4 border-green-500/20` — note `border-4`/`border-t-2` dividers/spinner weights were not in the substitution table), MediaGallery `text-green-600` check, PricingDuration progress fill, WizardNavigation `text-green-500` Saved icon.
- **Stack-docs discrepancy**: `Login.tsx`/`Header.tsx` use Clerk (`@clerk/clerk-react`), but AGENTS.md/tech-stack docs say BetterAuth. Docs need reconciling (separate from the visual work).

## Next Focus

- **Real-time Bidding Enhancements**: Refining bid concurrency handling and proxy bidding notifications.
- **User Profile Extensions**: Implementing detailed KYC verification for commercial sellers.
- **Performance Optimization**: Optimizing image delivery and caching for high-traffic auctions.

## ESLint strictTypeChecked enablement (Issue #171, Phase 3 — 2026-09-12)

- **`strictTypeChecked`/`stylisticTypeChecked` are now permanently ON** for `src/**` + `convex/**` in `eslint.config.js` (uncommented in batch 4 of Phase 3). All 52 `no-non-null-assertion` sites were fixed with real guards/restructures — zero `eslint-disable` directives were needed. Remaining errors under the strict config are only the documented intentional exceptions: ~16 `prefer-nullish-coalescing` (empty-string-means-missing), 2 `consistent-type-definitions` (Convex args types), 3 `no-deprecated` (tests verifying the deprecated `COMMISSION_RATE` fallback). Don't "fix" these; they are deliberate.
- **Settings.test.tsx relies on `null` preferences rendering the full page with defaults**: the test mock returns `null` from `useQuery(getMyPreferences)` by default, and the page's original semantics treat `null` (unauthenticated/no row) as "render with fallback values", NOT as loading. When touching `Settings.tsx`'s guard, preserve this — adding `preferences === null` to the early-return broke 14 tests. The `update` closure there was also simplified to object-form-only (the `(current) => ...` function form was dead code within the component).
- **Convex `useQuery` returns `T | undefined | null`** (null = valid "not found / unauthenticated" result from the query's `returns` union) — `=== undefined` checks alone don't prove non-nullness, and TS const-capture narrowing preserves the undefined exclusion but keeps `null` in the type. Remember this when removing `!` assertions around Convex query results.

## Naming Conventions

For consistency, this project follows these naming rules:

- **Folders**: hyphen-case (e.g., `user-profile`)
- **React component files**: PascalCase (e.g., `UserProfile.tsx`)
- **Utility/module files**: camelCase or kebab-case (e.g., `queries.ts`, `authConfig.ts`)
- **Variables and functions**: camelCase (e.g., `getUserProfile`)
- **React components**: PascalCase (e.g., `UserProfile`)

> This document is the authoritative source for naming conventions; other project documents should mirror it.

## Authentication & Security (Clerk + Convex)

### Configuration Source of Truth

- **`convex/config.ts`**: Centralizes configuration like `ALLOWED_ORIGINS`.
- **`convex/auth.config.ts`**: Verifies the Clerk-issued JWT natively — reads the issuer
  domain from `CLERK_JWT_ISSUER_DOMAIN` (set per Convex deployment via `bunx convex env
set`, never in a `.env` file). Kept free of imports from other `convex/` modules — see
  the comment in the file for why (Convex's bundler treats every env var read in this
  file's transitive import graph as required to deploy auth).
- **`convex/lib/auth.ts`**: Maps the verified identity (`ctx.auth.getUserIdentity()`) to
  the app's `AuthUser` shape and provides `requireAuth`/`requireAdmin`/etc.
- There is no `convex/auth.ts` and no auth HTTP routes in `convex/http.ts` — Clerk owns
  sign-up/sign-in/session/OAuth entirely; Convex only verifies the resulting JWT.

### CORS Implementation

- The CORS logic is manually implemented in `convex/http.ts` (`getCorsHeaders`/
  `addCorsHeaders`) to ensure strict origin matching and prevent credential leakage. As
  of the Clerk migration these helpers have no production consumer (the `httpRouter` in
  `http.ts` registers no routes) — kept intentionally for any future Clerk webhook/CORS
  routes.
- `ALLOWED_ORIGINS` is parsed from an environment variable with a fallback to `http://localhost:5173`.
- **Wildcard Support**: Origins can use a suffix pattern (e.g., `.vercel.app`) to match all subdomains. The `isOriginAllowed()` function in `convex/config.ts` handles exact matches, wildcard suffix matching, and hostname-based comparison.
- If an origin is not in the allowed list, the `Access-Control-Allow-Origin` header is omitted entirely.

### Environment Variables

- **`CLERK_JWT_ISSUER_DOMAIN`**: Set per Convex deployment (`bunx convex env set
CLERK_JWT_ISSUER_DOMAIN <domain>`) to the Clerk instance's issuer domain — dev and
  prod deployments point at different Clerk instances (Development vs. Production) and
  must not be mixed.
- **`VITE_CLERK_PUBLISHABLE_KEY`**: Frontend build-time env var (Vite), read by
  `src/main.tsx`'s `ClerkProvider`. Must match the same Clerk instance as
  `CLERK_JWT_ISSUER_DOMAIN` for the environment being built.
- **`ALLOWED_ORIGINS`**: Comma-separated list of frontend URLs for CORS.
- **`PII_ENCRYPTION_KEY`**: A 32-character string used for AES-256-GCM encryption of sensitive user data (e.g., ID numbers).

## PII Protection & Encryption

Sensitive user data, such as `firstName`, `lastName`, `phoneNumber`, `kycEmail`, and `idNumber` collected during KYC, is protected using **AES-256-GCM** encryption via the **Web Crypto API**.

- **Implementation**: Located in `app/convex/admin_utils.ts`.
- **Key Validation**: The `PII_ENCRYPTION_KEY` must be exactly 32 bytes. In production, the system throws a critical error if the key is missing or invalid.
- **Data Integrity**: Decryption includes authentication tag validation. Legacy plaintext values are handled gracefully during the transition period.
- **Administrative Access**: Decryption only occurs within specific admin mutations (e.g., `getProfileForKYC`) which are auditable and restricted by role.

## Administrative Audit Logging

All administrative mutations (e.g., voiding bids, reviewing KYC, bulk updating auctions) are automatically recorded in the `auditLogs` table.

- **Helper**: Use the centralized `logAudit` helper in `app/convex/admin_utils.ts`.
- **Metadata**: Logs capture the admin identity, action type (SCREAMING_CASE), target ID, target type, and a JSON-serialized summary of the changes.
- **Performance**: Large bulk updates are summarized (e.g., count and sample IDs) to keep log entries within reasonable size limits.

## Bidding Verification Gate

To maintain marketplace integrity, bidding is restricted to verified users.

- **Backend Enforcement**: The `placeBid` mutation in `app/convex/auctions.ts` checks `profile.isVerified`.
- **Frontend Feedback**: The `BiddingPanel` detects the user's verification status and displays a high-visibility alert with a link to the KYC flow if they are unverified or pending review.

### React Component Purity

- Impure functions like `Date.now()` must not be used directly in the render body or as immediate initial state values.
- Use `useEffect` or lazy state initialization: `useState(() => endTime - Date.now())`.

## UI/UX Patterns

- **Auth Form**: Uses a single form with a toggle state (`signin` | `signup`) to provide correct `autoComplete` attributes (`current-password` vs `new-password`) and a better user experience.
- **Countdown Timer**: Uses a single `remainingMs` state and derives display strings during render for efficiency and simplicity.

## Image Storage Architecture (Implemented)

### Current Architecture

The `ListingWizard` now uses permanent Convex File Storage for all equipment images.

1.  **Backend (Convex)**:
    - `app/convex/auctions.ts` provides a `generateUploadUrl` mutation that returns a secure, single-use upload destination.
    - Auction images are stored as an object containing specific keys (`front`, `engine`, `cabin`, `rear`) and an `additional` array, all holding Convex `storageId` strings.

2.  **Frontend (ListingWizard)**:
    - **Upload Flow**: When a user selects a file, the component immediately generates a local `blob:` URL for instant preview. It then calls `generateUploadUrl`, POSTs the binary data to Convex, and saves the resulting `storageId` into the form state.
    - **Cleanup**: Local blob URLs are revoked on image removal or component unmount to prevent memory leaks.
    - **Descriptive Errors**: The wizard provides specific feedback (e.g., "Please upload at least one photo") using `sonner` toast notifications.

3.  **Display**:
    - **`AuctionCard` & `AuctionDetail`**: These components resolve the `storageId` strings to public URLs. (Note: For mock data, these fields may contain full HTTP URLs, which the components handle transparently).
    - **Structured Images**: The schema transition from an array of strings to a structured object allows for more precise UI placement (e.g., showing the 'Front' view as the hero image).

## Admin Moderation Workflow

The Admin Dashboard has been refactored from a monolithic context-based design to a modular route-based architecture (`/admin/*`).

- **Structure**: Each administrative function (Moderation, Auctions, Users, Announcements, Finance, etc.) is its own standalone page component with isolated local state.
- **Layout**: A shared `AdminLayout` component provides the persistent sidebar navigation and a high-density KPI header.
- **Workflow**:
  - New auctions are created with a `pending_review` status and appear in the **Moderation Queue**.
  - Admins can approve or reject listings; approval transitions the status to `active` and sets the live auction timer.
  - User management includes KYC document review with decrypted PII access and role elevation (promotion to admin).
- **KYC Document Storage**: KYC documents (ID, proof of residence, etc.) are stored using Convex storage IDs rather than string-based references, providing better type safety and integration with Convex's file storage system.
- **Auditability**: All administrative actions are automatically logged via the `logAudit` helper.
- **Performance**: N+1 queries in administrative views (e.g., fetching read counts for announcements) are optimized via the `batchFetchReadCounts()` helper in `convex/notifications.ts`, which consolidates parallel indexed queries into a single reusable function used by `listAnnouncements` (admin), `getAnnouncementsWithReadStatus` (notifications), and `markAllReadHandler` (notifications). User read status lookups use a single `.collect()` + Set filter instead of N × `.unique()` calls.
- **Type Safety**: Backend queries used with `usePaginatedQuery` must have required `paginationOpts` in their validators to enable correct frontend type inference.

## My Bids Implementation

- **Grouping**: Bids are grouped by auction on the server in the `getMyBids` query. This prevents duplicate auction cards when a user has placed multiple bids on the same item.
- **Winner Tracking**: The `winnerId` field in the `auctions` table is the source of truth for the current winning bidder. It is updated in real-time by the `handleNewBid` function (in `proxy_bidding.ts`).
- **Dashboard Stats**: Overall stats (Winning, Outbid, Exposure) are calculated on the server via `getMyBidsStats` to ensure accuracy regardless of frontend pagination state.
- **Pagination Strategy**: Currently uses an `indexOf(cursor) + 1` approach on an in-memory sorted array of auction IDs. While functional for current scale, this should be refactored to a more robust cursor-based query if the number of bid-on auctions per user exceeds 1,000.

## Equipment Metadata Management (March 2026)

- **Hierarchical Structure**: Transitioned from static strings to a dynamic `equipmentCategories` -> `equipmentMetadata` (Make) -> `models` hierarchy.
- **Admin UI**: Implemented `AdminEquipmentCatalog.tsx` providing a specialized interface for CRUD operations on categories, manufacturers, and models.
- **Data Integrity**: Enforced hierarchical selection in the `ListingWizard`. Added soft-delete support via `isActive` flags.
- **Migration**: Implemented `fixMetadata` to map legacy auction data to the new hierarchical structure.
- **Seeding**: Expanded `runSeed` with a comprehensive catalog of Southern African agricultural machinery.

## Clerk Auth Migration Notes (September 2026)

- **Profiles carry identity data**: `profiles` now stores `name`/`email` directly (written by `syncUserHandler`); the Better-Auth-era `findUserById` lookup helper is gone. Any handler needing a user's name/email reads it straight off the profile document.
- **Branch-coverage test files**: `convex/auctions/queries_branch.test.ts` and `mutations_branch.test.ts` are supplementary branch-coverage suites (not duplicates of the split `queries/*` / `mutations/*` test files). The dead `vi.mock("../auth", () => ({ authComponent: ... }))` blocks in `queries_branch.test.ts` and `queries_extra.test.ts` were removed during the Phase 4 verification pass of `fix-auth-migration-tests`; repo-wide `*.test.ts` greps for `findUserById`/`authComponent`/`../auth` are now clean.
- **CORS helpers in `convex/http.ts` — kept (reverted a Phase 5a deletion)**: Phase 5a of `fix-auth-migration-tests` initially deleted `getCorsHeaders`/`addCorsHeaders` (and `convex/http.test.ts`) as dead code, but this directly contradicted an explicit constraint in `conductor/opencode_tasks/clerk-auth-migration.md` ("Do NOT remove the CORS helpers from `convex/http.ts`"). Restored both the helpers and their test coverage; `getCorsHeaders`/`addCorsHeaders` remain exported from `convex/http.ts` with no current production consumer (kept intentionally for future Clerk webhook/CORS routes per that constraint).
- **Frontend auth tests rewritten for Clerk (Phase 5b of `fix-auth-migration-tests`)**: the 32 pre-migration runtime failures are fixed — `src/lib/auth-client.test.ts` now covers the real `useSession()` shim via `renderHook` with mocked `@clerk/clerk-react` `useAuth`/`useUser` (repo-first Clerk mock pattern); `Login.test.tsx` rewritten for the Clerk `<SignIn>` page (custom-form/signIn.email tests deleted — that UI no longer exists); `Header.test.tsx` mocks `useClerk().signOut`; `Layout.test.tsx` mocks `useAuth`/`useUser` and syncs via `useUser().user.id`; `ListingWizard_EdgeCases.test.tsx` adds the standard `@/lib/auth-client` mock.
- **Pre-existing lint errors in migration source files: fixed (Phase 5c)**: all 15 cleared — 4 × `convex/http.ts` jsdoc errors died with the 5a deletion; JSDoc added to `useSession` (`src/lib/auth-client.ts`) and `Login`; import order fixed in `Layout.tsx`/`Header.tsx`; `Settings.tsx` render-scoped `let isSaving` re-entrancy guard (mutated after render — broken as well as illegal) replaced with a `useRef` guard hoisted above the early-return. Repo-wide lint: 0 errors.
- **`convex/lib/auth.ts` is now Clerk-only**: `getAuthUser` maps `ctx.auth.getUserIdentity()` claims directly (`_id` = `userId` = `identity.subject`; `email`/`name`/`image` from claims, `?? null` for missing). No auth-component lookup, no `db.get`/`runQuery` fallbacks, and errors are swallowed silently (never logged). `AuthUser` no longer has `_creationTime` and `_id` is a plain string (Clerk subject), not a branded Convex `Id`.

## Granular Verification Fields (issue #219, September 2026)

- **Convex `returns` validators are strict about extra fields**: object validators throw on properties not declared in the validator — including for `returns`, not just `args` (per docs.convex.dev/functions/validation). Any handler that spreads a whole doc (`{...profile}`) or returns a raw doc through a hand-rolled validator must have that validator extended whenever the table schema gains fields; otherwise the function starts failing at runtime once real docs carry the new field. Hit in practice with `ProfileValidator` in `convex/users.ts` (`getMyProfileHandler` returns the raw profile; `getProfileForKYCHandler` spreads it) when adding `emailVerified`/`phoneVerified`/`bankingVerified`/`taxNumberVerified` to `profiles`.
- **Verification booleans on `profiles`**: `emailVerified` is set to `true` by `verifyUserHandler` only when the profile has a `kycEmail` (encrypted, submitted via `submitKYC`). `phoneVerified`/`bankingVerified`/`taxNumberVerified` intentionally have no write path yet (OTP / payment integration / manual admin process — future issues); they render as Pending/"Not linked" on the profile Trust & Compliance grid.
- **`getSellerInfo` now returns `kycStatus`** so the Profile page can pass it to `getTrustItems` (previously the Identity item silently ignored `kycStatus` because the query never returned it).
- **Prettier vs CRLF checkout**: with `core.autocrlf=true` on Windows, `prettier --check` fails on every repo file (working tree CRLF vs Prettier's LF default; `.prettierrc` sets no `endOfLine`). Don't run repo-wide `prettier --write` to "fix" it — it would churn line endings across the whole codebase.

## ESLint no-unsafe-\* Cleanup in Convex Test Files (September 2026)

- **Vitest 4 asymmetric matchers return `any`**: `expect.stringContaining(...)`, `expect.any(...)`, and `expect.arrayContaining(...)` are typed `(…) => any` in Vitest 4. Passing them as _object literal properties_ (e.g. `expect.objectContaining({ updatedAt: expect.any(Number) })`) triggers `no-unsafe-assignment`; passing them as plain call arguments does not. Fix: cast the matcher expression `as unknown` at the property site.
- **`vi.fn()` implementation params are contextually `any`**: parameters of arrows passed to `vi.fn((_idx, cb) => …)` are not implicit-any type errors under tsgo (so `bun run type-check` passes), but typescript-eslint sees them as `any` → `no-unsafe-call`/`no-unsafe-member-access` at every `cb(...)` use. Fix: annotate the params explicitly (e.g. `(_idx: string, cb?: (q: unknown) => unknown)`). Keep `cb` optional when the body does `if (cb)` to avoid new `no-unnecessary-condition` warnings.
- **`@ts-expect-error` only suppresses the immediately following line**: a Prettier-wrapped multi-line `await import("./encryption?final")` moves the TS2307 onto the module-string line, orphaning the directive (TS2578 "Unused '@ts-expect-error'"). Fix: wrap the dynamic import in a typed loader helper (with the directive + cast inside it) instead of repeating `@ts-expect-error` per destructuring site.
- **Assigning `any` → `unknown` is always safe** for `no-unsafe-assignment`/`no-unsafe-return` (rule explicitly allows it); `JSON.parse()` results should be annotated `: unknown` and narrowed via type guards (e.g. `Array.isArray`) instead of left as `any`.
- **`expect.objectContaining` also returns `any` (Vitest 4)**: same class of issue as the matchers above — nesting it as an object literal property (e.g. `paginationOpts: expect.objectContaining({ cursor: ... })` inside `toHaveBeenCalledWith`) triggers `no-unsafe-assignment`; casting the property value `as Record<string, unknown>` clears it without changing the assertion.
- **Optional-chain intermediates are typed non-nullish by TS**: in `a?.b?.c`, the rule `no-unnecessary-condition` sees the operand of the second `?.` (`a?.b`) as always non-nullish, so a runtime-defensive `?.` gets flagged. Fix: make the nullishness visible in the type (e.g. `React.ReactElement<{ children?: ReactNode } | undefined>`) instead of removing the `?.` (which would change short-circuit behaviour for non-element children like strings).
- **Mocking `useQuery`/`useMutation` in component tests**: prefer `vi.mocked(convexReact.useQuery).mockImplementation((...args: unknown[]) => ...)` — `unknown[]` rest params keep `no-unsafe-*` quiet while letting the body branch on `args[1]`; never `any[]`.

## ESLint security/no-unnecessary-condition Cleanup in Convex Backend (September 2026)

- **`eslint-plugin-security` v4.0.0 `detect-object-injection` is purely syntactic**: it reports any computed MemberExpression whose property is an `Identifier` (`obj[key]`), and nothing else. `hasOwnProperty` guards do **not** silence it. Working fixes: `Map` lookups, computed destructuring (`const { [key]: val } = obj` — destructuring patterns aren't MemberExpressions, so not flagged), or restructuring so index correlation is carried by zipped pairs (e.g. `chunk.map(async (id) => ({ id, auction: await ctx.db.get(id) }))`) instead of parallel arrays + `arr[i]`.
- **TS unsoundness: `Array.isArray(x)` false-branch drops `null | undefined`**: after `if (Array.isArray(x)) … else`, TS narrows nullish out of the type even though runtime `null` reaches the else branch (unsound predicate narrowing). So a null-guard `x &&`/`x != null` placed _after_ `Array.isArray` gets flagged `no-unnecessary-condition` ("types have no overlap") while remaining genuinely necessary at runtime (e.g. `deleteAuctionImages` receives `null` via casts in tests). Fix: perform the nullish check **before** the `Array.isArray` check (`x != null && Array.isArray(x)`).
- **`const x: T | null = nonNullInit` loses the nullish**: assignment narrowing narrows `x` to the initializer's type, erasing `null` from the annotation. To keep runtime-possible nullish visible for `no-unnecessary-condition`, use a widening cast instead: `const x = init as T | null | undefined` (the cast expression's type is what CFA keeps).
- **`Object.entries(o)` for objects with optional props strips `undefined` from the value type** (reverse-mapped inference) even though explicit-undefined values are possible at runtime from direct callers (tests). When a filter must keep checking `val !== undefined`, cast the entries first: `Object.entries(restArgs) as Array<[string, unknown]>`. Server-side Convex args can't contain explicit undefined (JSON deserialization), so `ctx.db.patch(id, patchArgs)` directly on validator-typed optional args is equivalent to the old filter-then-patch.

## Seller Reviews (issue #221, September 2026)

- **`reviews` table + `convex/reviews.ts`**: reviews keyed by `auctionId` + `reviewerId` (winner-only, once per auction, `status === "sold"` required). `getSellerRatingSummary` is a plain async helper (not an `internalQuery`) so `getSellerInfoHandler` can call it inside the same query transaction — added as a 4th parallel `Promise.all` call in `browse.ts`. `submitReview`/`getSellerReviews` are public `api.reviews.*` functions (top-level file, no barrel re-export needed).
- **`git stash push -u` is unsafe on this repo (Windows)**: it saves the stash but fails to delete untracked dirs (`.claude/worktrees/*`, `app/*`, `dev-dist/*` — permission denied), leaving the working tree dirty; a follow-up `git stash pop` then aborts with "local changes would be overwritten". Don't use `stash -u` for HEAD-baseline comparisons here — diff hunks against warning sites instead.
- **Background `convex dev` races with git**: the always-running Convex dev watcher regenerates `convex/_generated/api.d.ts` whenever `convex/` file contents change (new/removed modules). If a git operation transiently reverts `convex/` files (e.g. a failed stash), the watcher rewrites `api.d.ts` mid-operation and can cause pop/checkout conflicts. Treat `api.d.ts` as perpetually-modified during active dev. (Hit again during #232: a plain `git stash push -- <paths>` + lint + `pop` aborted on `api.d.ts`; fix was `git checkout -- convex/_generated/api.d.ts && git stash pop`.)
- **`eslint --stdin --stdin-filename <file>` does not lint piped content on this repo**: with the type-aware `projectService` config it silently lints the on-disk file instead, so stdin-based "HEAD vs working tree" warning comparisons report identical (wrong) line numbers. Use a path-scoped `git stash push` baseline instead.

## Profile Reports (issue #232, September 2026)

- **`profileFlags` table + `convex/profileFlags.ts`**: mirrors the auction-flags pattern but lives in a flat top-level file (like `reviews.ts`/`support.ts`), not a directory — `convex/auctions/` is only a directory because that feature is huge. `reportProfile` guards: auth via `getAuthenticatedUserId`, self-report reject, `profiles.by_userId` existence check, duplicate pending report by same reporter within 30 days (window computed in JS from the `by_reporter` index results, mirroring `flagAuctionHandler`'s `userHasFlagged`).
- **`reviewProfileFlag` merges auction's "dismiss" + "review" into one admin mutation** (`status: "reviewed" | "dismissed"` + optional `adminNotes`, audit action `REVIEW_PROFILE_FLAG`, `targetType: "profileFlag"`), so the admin UI needs one dialog, not two. `dismissFlagHandler`'s `getCallerRole(ctx) !== "admin"` guard style is used for the mutation; `requireAdmin` (as in `getAllPendingFlags`) for the query.
- **AdminModeration reuses a single `AlertDialog` for both sections**: `selectedFlag` (auction) vs `selectedProfileFlag` determine the dialog's title/description/handler; the auction-flag card's "Dismiss" button and the profile card's "Dismiss Report"/"Mark Reviewed" buttons were named so `/^dismiss$/i` selectors used by the older tests stay unique.
- **Out of scope (per issue Notes "Consider" list): auto-hiding profiles at a flag threshold** — no counter updates, no `hiddenByFlags`-equivalent on `profiles`. If added later, follow the auction auto-hide pattern (`AUCTION_FLAG_AUTO_HIDE_THRESHOLD` + restore-on-dismiss).

## Seller Messaging (issue #231, September 2026)

- **Two-party conversations use scalar `buyerId`/`sellerId`, not a `participantIds` array** — the issue's literal schema proposal (array + array index) doesn't work: Convex array-field indexes are not "contains" lookups, so "conversations for this user" would need a full scan. Both fields are individually indexed (`by_buyer`/`by_seller` with `lastMessageAt` ordering) and "conversations for the caller" is the union of the two index queries.
- **Merged cross-index pagination follows `getMyNotificationsHandler`** (`convex/notifications.ts`): fetch both sides with `.take()` caps, merge, sort desc, paginate via offset cursor (`parseInt(cursor)` / `slice` / `String(end)`). Only the returned page is enriched (profile name + last-message preview via `by_conversation` desc `.first()` + unread count via `by_conversation_read`), keeping per-request reads proportional to page size.
- **Paginated queries can't return `null` for authz denials** — `usePaginatedQuery` throws on query errors and misbehaves on non-pagination shapes. `getMessages` therefore throws `ConvexError` for non-participants (same guard as `sendMessage`), and the thread view renders a local `ConversationErrorBoundary` (Messages.tsx) that shows "Conversation not found" for `ConvexError`s and re-throws anything else to the root boundary. Client-side `ConvexError` detection works because the sync layer rehydrates server `ConvexError`s as `ConvexError` instances.
- **`markRead` counts only the other party's messages** (`by_conversation_read` + `senderId !== callerId` filter) so re-reading a thread doesn't "unread" your own messages.
- **Rate limit**: max 10 messages per sender per `MS_PER_MINUTE`, enforced with a `by_sender` index range (`.eq("senderId").gte("createdAt", windowStart)`) + `>=` on the pre-send count — CodeRabbit correctly flagged the initial collect-all + JS filter (violates the "prefer indexes over .filter()" constraint) and the off-by-one (`>` allowed an 11th message in the window).
- **`startConversation` reuses conversations in both directions** (two `by_buyer_seller` `.unique()` lookups) — CodeRabbit caught that one-directional reuse would create parallel threads when a seller contacts a buyer who originally contacted them.
- **Test-mock gotcha**: `vi.fn((indexName) => ({ collect: vi.fn().mockResolvedValueOnce(x)... }))` recreates the chain per call, resetting `mockResolvedValueOnce` queues per conversation — build persistent chain objects outside the `withIndex` mock when a query runs more than once per handler (hit in `getConversationsHandler` tests).
- **Header Messages entry (follow-up, `getUnreadConversationCount`)**: counts conversations (not messages) with ≥1 unread-from-other via the same two-index merge as `getConversationsHandler`. `NotificationDropdown` fetches its own unread count via self-contained `useQuery`, so the nav entries do the same. **MobileMenu gotcha**: it mounts regardless of auth state (returns null when closed _after_ hooks run), so its `useQuery` must live in a child component (`MessagesTile`) rendered inside `<Authenticated>` — a top-level call in `MobileMenu` would run the authenticated query for logged-out users and throw. `UserDropdown` can call it top-level since `Header` only renders it inside `<Authenticated>`.

## SellerInfo Message Button (issue #231 follow-up, September 2026)

- **`SellerInfo.tsx` was the last stale "Not implemented" affordance**: a repo-wide grep for disabled Message/Contact buttons plus `Not implemented`/`Coming soon`/`TODO(#220|#221|#231)` strings found only it (the `Profile.tsx:636` `TODO(#219)` is a different feature). Audit of `SellerListings.tsx`, `dashboard/MyBids.tsx`, `dashboard/MyListings.tsx` and `bidding/BidHistory.tsx` found no other stubbed contact affordance — all have alternative paths (cards link to auction detail → SellerInfo; SellerListings links to profile → Contact Seller), and BidHistory deliberately anonymises bidders, so no new entry points were added.
- **Pre-existing eslint warnings in AuctionDetail (present at HEAD, left untouched as out of task scope)**: `AuctionDetail.tsx:107` `no-unnecessary-condition` (optional chain in the `isOwner` comparison) and 2× `require-await` in `AuctionDetail.test.tsx` (`"handles condition report dialog and download link"` and `"handles condition report dialog with missing URL in dialog itself"` — async callbacks with no await). Worth a separate cleanup commit.

## Showcase Mock Data + Weekly Auto-Reset (showcase-mock-data task, September 2026)

- **`performSeed(ctx)` (convex/seed.ts)** is now the single seeding body used by both `runSeed` and the new `weeklyReset` internal mutation. Idempotency strategy is two-tier: rows with a natural unique key (categories via `by_name`, metadata via make+categoryId, profiles via `by_userId`, auctions via `by_seedId`, bids via `by_auction` "first bid wins", reviews via `by_auction_reviewer`, watchlist via `by_user_auction`, conversations via `by_buyer_seller`, proxy bids via `by_bidder_auction`, auctionFees via `by_auction`) are insert-if-absent; keyless tables (notifications, supportTickets, userActivity, auctionFlags, profileFlags) are seeded only while empty — so plain `runSeed` re-runs never duplicate, and full resets re-seed because the weekly reset clears those tables first.
- **The weekly reset vs the pr254 mock-seller throw**: `performSeed` keeps the Clerk-dependent `mock-seller@farm.com` lookup + throw exactly as the pr254 review fix introduced it (runSeed behavior unchanged, covered by a test). But `weeklyReset` deletes ALL non-admin profiles — which would delete the mock seller and make the very next `performSeed` throw. Resolution: `weeklyReset` calls `ensureMockSellerProfile` after the profile wipe, inserting a synthetic display-only `userId: "mock-seller"` stand-in (never callable, can't authenticate). Consequence: on a showcase with zero Clerk sign-ins, bootstrap a fresh deployment by running the `seed.weeklyReset` internal mutation once from the dashboard (or sign in as the mock seller and run `runSeed`). Admin profiles are never created synthetically.
- **Weekly reset table list**: clears auctions, bids, proxy_bids, watchlist, reviews, conversations, messages, notifications, supportTickets, userActivity, auctionFlags, profileFlags, auctionFees, counters + non-admin profiles; leaves equipmentCategories/equipmentMetadata/faqItems/platformFees (static reference data) alone. It deliberately does NOT call `checkDestructiveAccess` — internal mutations are unreachable from the public API and the cron caller has no identity, so the admin/env guard would incorrectly reject it (asserted by test: `getCallerRole` is never invoked).
- **`runSeed({ clear: true })` clear-list was extended** (auctions/bids/watchlist/metadata/categories/counters + the 10 related tables) so a clear-and-reseed produces a coherent dataset instead of leaving dangling reviews/conversations referencing deleted auctions. Profiles are still NOT cleared by runSeed (Clerk-synced mock seller must survive) — that remains the weekly reset's job.
- **Mock dataset shape (20 auctions)**: 12 active (incl. the original 5 tractors — only `mf-8s-305.currentPrice` was bumped 142000→143000 so its seeded bid history respects `minIncrement`), 3 sold (winnerId+settledAt set), 2 unsold (winnerId null, no bids), 2 pending_review, 1 draft; all 10 equipment categories covered; sellerIds spread across the Clerk mock seller + synthetic `mock-seller-2`/`mock-seller-3`. Bid amounts are hand-planned per auction (`ACTIVE_BID_AMOUNTS`/`SOLD_BID_PLANS`) so the top bid always equals `currentPrice` and every step respects `minIncrement`. Sold auctions also get bids (task only asked for active) so winners/reviews/fee rows are coherent.
- **Seed tests use a mini in-memory Convex mock** (convex/seed.test.ts): query builders with real field matching (withIndex `q.eq()` chains captured and matched against row fields, incl. chained `.filter(q.eq(q.field(...)))`), plus insert/patch/delete/get. Gotchas: `vi.mock("./_generated/server")` must expose identity `mutation`/`internalMutation` wrappers or `.handler` isn't reachable at runtime (repo pattern from presence.test.ts), `eq` must return the filter object (seed.ts chains two `.eq()` calls), and `Reflect.get` is used in the matcher to satisfy security/detect-object-injection.
- **ESLint `no-console` (Issue #171 Phase 1)**: enforced as `["error", { allow: ["warn", "error"] }]` on app source, with `off` overrides for `convex/seed.ts` (CLI script), `**/*.test.{ts,tsx}` (test debugging), and `src/components/ui/**` for `react-refresh/only-export-components` (shadcn/ui generator). Backend "informational" logs converted to `console.warn` rather than `console.info` since `info` isn't in `allow`. Remaining documented `set-state-in-effect` disables now all carry `-- reason` comments; `.husky/pre-commit` rejects new undocumented `eslint-disable` additions in `src/**`/`convex/**` (tests, `convex/_generated/**`, and `-- reason` disables exempt).
- **`getMyBids` client type guard**: the query's `returns` validator types `status` as `v.string()`, so `src/pages/dashboard/MyBids.tsx` narrows rows with an `isAuction()` guard built on `FunctionReturnType<typeof api.auctions.queries.getMyBids>["page"]` (previously a blind `as unknown as Auction[]`). If the validator is ever switched to `v.union(v.literal(...))` for status, the guard can be deleted.

## Issue #171 Phase 3 — strictTypeChecked rollout notes (September 2026)

- **Batch 1 results (this task)**: enabled `strictTypeChecked`+`stylisticTypeChecked` temporarily; `eslint --fix` cleared the mechanical violations and 66 `no-empty-function` sites in tests were fixed with in-body `// intentional no-op` comments. Final strict-mode error count: **196** (down from 509), all deferred to later batches (`restrict-template-expressions` 57, `no-non-null-assertion` 52, `prefer-nullish-coalescing` 49 non-autofixable cases, `no-redundant-type-constituents` 10, `no-deprecated` 8, and a small tail). `unbound-method` (82 errors, all in test files) is permanently overridden off in the `**/*.test.{ts,tsx}` block of `eslint.config.js`.
- **CRITICAL — interfaces break Convex FunctionReference type inference**: `@typescript-eslint/consistent-type-definitions` (in `stylisticTypeChecked`) auto-converts `type X = {...}` to `interface X {...}`, but Convex 1.33's query/mutation reference inference does not accept interfaces as handler args types (interfaces lack implicit index signatures) — references silently degrade to `never`/`EmptyObject` args, which then fails at _call sites far away from the definition_ (e.g. `usePaginatedQuery` in `src/pages/Home.tsx`, `useMutation` in `AdminErrorReportingSettings.tsx`). Reverted `ActiveAuctionsArgs` (convex/auctions/queries/browse.ts) and `GitHubErrorReportingConfig` (convex/admin/settings.ts) back to type aliases with explanatory comments. **When strict rules are permanently enabled in a later batch, add an override disabling `consistent-type-definitions` for `convex/**`(or only for handler-args types)** — otherwise every future`--fix`will re-break Convex references.`MockCtx`-style interfaces in test files are fine.
- **Batch 3 results (this task)**: strict-mode errors **208 → 73**. Cleared: `restrict-template-expressions` 69→0 (numbers/booleans wrapped in `String(...)` at each site; nullable interpolations use `?? ""` / meaningful fallbacks), `prefer-nullish-coalescing` 19 (3 mechanical `??` conversions in ListingWizard.test.tsx localStorage reads; 16 kept as `||` with `// Intentionally || not ??` comments where empty string means "missing" — display labels, env/config checks, preview URLs), `array-type` 17→0, `no-confusing-void-expression` 15→0, `consistent-type-definitions` 14→12 remaining (2 deliberate Convex args-type reverts), `no-unnecessary-type-assertion` 4→0, `use-unknown-in-catch-callback-variable` 4→0, `no-empty-function` 3→0, `prefer-optional-chain` 2→0, `only-throw-error` 1→0, `no-deprecated` 8→3 remaining (intentional: `config.test.ts` exercises the deprecated `COMMISSION_RATE` env fallback). Remaining strict-mode errors are `no-non-null-assertion` 52 (dedicated later batch) + the 21 documented intentional/deferred stragglers above.
- **The strict preset hard-restricts template expressions**: typescript-eslint 8.56.1's `strictTypeChecked` configures `restrict-template-expressions` with `allowNumber: false`, `allowBoolean: false`, `allowAny: false`, `allowRegExp: false` — the docs' "defaults allow string|number|boolean" does NOT apply once the preset's options are set. Every number/boolean interpolation must be wrapped in `String(...)` (no per-site rule options to relax it without diverging from the preset).
- **`--fix` reverts Convex args types every time**: even with explanatory comments directly above them, `consistent-type-definitions` auto-fix converted `ActiveAuctionsArgs` and `GitHubErrorReportingConfig` to interfaces again in this batch (caught only because `bun run build` failed at distant call sites; note the earlier verification grep used a bad pathspec — `git diff -- 'convex/'` is not a valid pathspec, use `git diff -- convex/`). Reverted both again; the eslint override mentioned above is still needed before the permanent switch-on batch.
- **`security/detect-object-injection` fires on computed array indexing** (`arr[i]`), not just object property access — a `restrict-template-expressions` fix that swaps `arr.at(i)` for `arr[i]` in a template string trades one violation for another. Prefer `arr.at(i) ?? "fallback"` for nullable-typed interpolation.
- **`String(unknown)` trips `no-base-to-string`** (strict preset) — when wrapping a possibly-non-Error thrown value, use the existing `getErrorMessage(err)` util (src/lib/utils.ts) instead of `String(err)`: `new Error(getErrorMessage(x))`.
- **React 19 types deprecations**: `React.ElementRef<T>` → `React.ComponentRef<T>` (shadcn/ui generated files), global `FormEvent` → `React.SyntheticEvent` (form submit handlers; Support.tsx already used this). `storage.delete`/`storage.getUrl` string-arg overloads are deprecated in convex 1.x — cast storage ids with `as Id<"_storage">` (existing codebase pattern), and in tests assert on a captured raw `vi.fn()` rather than `mockCtx.storage.delete` to avoid referencing the deprecated overload.
- **Flaky type-aware lint warnings**: full-repo eslint runs intermittently report `no-unsafe-*` warnings in `src/pages/Home.tsx` (~457) and vary total warning count (5–12) between runs with identical code — a typescript-eslint program/caching artifact, not real regressions. Verify suspicious warnings against a per-file run before "fixing" them.
