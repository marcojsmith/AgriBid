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
A dedicated Admin Dashboard (`/admin`) has been implemented to handle the lifecycle of new listings.
- New auctions are created with a `pending_review` status.
- Admins can review equipment details and condition checklists.
- The `approveAuction` mutation updates the status to `active` and calculates the final auction end time.
- Only users with the `admin` role (stored in the `user` table) can access these features.

