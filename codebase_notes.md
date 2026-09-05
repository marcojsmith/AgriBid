# Development Notes

## Current Status (2026-03-30)

- **User Preferences Storage**: Implemented persistent user preferences (Issue #118). The system stores view mode, sidebar state, filter defaults, bidding preferences, and notification settings in Convex database. Profile editing for bio, location, and companyName is now available.
- **Proxy Bidding**: Fully implemented (backend & frontend). Auto-incrementing logic verified.
- **Admin Portal**: Route-based refactor complete. KPIs and moderation flows are isolated to local route state.
- **Performance**: Image caching, paginated queries, and context-based state management implemented.
- **Listing Lifecycle & Management**: Implemented draft persistence, update/publish flow, and condition report uploads.
- **Admin Moderation**: Integrated flagging system with auto-hide thresholds and admin review dashboard.
- **Settlement & Cleanup**: Automated auction settlement (Sold/Unsold) and periodic cleanup of abandoned drafts.

## Next Focus

- **Real-time Bidding Enhancements**: Refining bid concurrency handling and proxy bidding notifications.
- **User Profile Extensions**: Implementing detailed KYC verification for commercial sellers.
- **Performance Optimization**: Optimizing image delivery and caching for high-traffic auctions.

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
