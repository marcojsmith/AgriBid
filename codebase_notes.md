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

## Image Storage Architecture (Pending Implementation)

### Current Status
- As of 2026-02-13, the `ListingWizard` uses temporary local object URLs (`URL.createObjectURL`) for previews.
- **Limitation**: These URLs are client-side only and ephemeral. They will not persist after a page refresh and cannot be viewed by other users.

### Implementation Guide for Permanent Storage
To migrate to permanent Convex File Storage, follow this pattern:

1.  **Backend (Convex)**:
    - Create a `generateUploadUrl` mutation in `convex/auctions.ts` that returns a secure upload destination using `ctx.storage.generateUploadUrl()`.
    - Create a `getFileUrl` query that takes a `storageId` and returns a public URL using `ctx.storage.getUrl(storageId)`.

2.  **Frontend (ListingWizard)**:
    - When a user selects a file, call the `generateUploadUrl` mutation.
    - `POST` the file binary data directly to the returned URL using `fetch(url, { method: "POST", body: file })`.
    - Retrieve the `storageId` from the JSON response of the POST request.
    - Save the `storageId` (string) into the `formData.images` array.

3.  **Display**:
    - Components rendering auction images (e.g., `AuctionCard`, `ImageGallery`) should use the `storageId` to fetch the public URL via the `getFileUrl` query or a dedicated resolver.

