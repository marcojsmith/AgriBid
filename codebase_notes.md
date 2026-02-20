# Development Notes

## Authentication & Security (Better Auth + Convex)

### Configuration Source of Truth

- **`app/convex/config.ts`**: Centralizes configuration like `ALLOWED_ORIGINS`.
- **`app/convex/auth.ts`**: The main Better Auth configuration for the Convex backend.
- **`app/convex/auth.config.ts`**: Used for OIDC validation by the Convex runtime.

### CORS Implementation

- The CORS logic is manually implemented in `app/convex/http.ts` to ensure strict origin matching and prevent credential leakage.
- `ALLOWED_ORIGINS` is parsed from an environment variable with a fallback to `http://localhost:5173`.
- If an origin is not in the allowed list, the `Access-Control-Allow-Origin` header is omitted entirely.

### OIDC Discovery Rewrite

- Standard OIDC clients expect the discovery document at `/.well-known/openid-configuration`.
- The Better Auth Convex plugin serves this internally at `/api/auth/convex/.well-known/openid-configuration`.
- `app/convex/http.ts` implements a rewrite handler that maps root-level `.well-known` requests to the plugin's internal paths, ensuring compatibility with the Convex runtime's OIDC validation.

### Environment Variables

- **`CONVEX_SITE_URL`**: Critical for both backend (Better Auth baseURL) and OIDC validation (domain).
- **`ALLOWED_ORIGINS`**: Comma-separated list of frontend URLs for CORS.
- **`BETTER_AUTH_SECRET`**: Required by Better Auth for signing tokens.
- **`PII_ENCRYPTION_KEY`**: A 32-character string used for AES-256-GCM encryption of sensitive user data (e.g., ID numbers).

## PII Protection & Encryption

Sensitive user data, such as `firstName`, `lastName`, `phoneNumber`, `kycEmail`, and `idNumber` collected during KYC, is protected using **AES-256-GCM** encryption via the **Web Crypto API**.
- **Implementation**: Located in `app/convex/admin_utils.ts`.
- **Key Validation**: The `PII_ENCRYPTION_KEY` must be exactly 32 bytes. In production, the system throws a critical error if the key is missing or invalid.
- **Data Integrity**: Decryption includes authentication tag validation. Legacy plaintext values are handled gracefully during the transition period.
- **Administrative Access**: Decryption only occurs within specific admin mutations (e.g., `getProfileForKYC`) which are auditable and restricted by role.

## Backend Utility Helpers

- **`findUserById`**: A shared helper in `app/convex/users.ts` that handles looking up a user by either their Convex `_id` or the shared `userId` string. This ensures consistency across different data models (Better Auth vs. App Profiles).

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
- **Auditability**: All administrative actions are automatically logged via the `logAudit` helper.
- **Performance**: N+1 queries in administrative views (e.g., fetching read counts for announcements) are optimized via batched or parallelized lookups.
- **Type Safety**: Backend queries used with `usePaginatedQuery` must have required `paginationOpts` in their validators to enable correct frontend type inference.

