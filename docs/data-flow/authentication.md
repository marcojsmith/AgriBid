# Authentication Data Flow

This document describes the authentication system architecture and data flows in AgriBid.

## Architecture Overview

AgriBid uses **Clerk** for authentication (sign-up, sign-in, sessions, OAuth) and
**Convex** for authorization and application data. Clerk issues a JWT to the browser;
Convex verifies that JWT natively (via `convex/auth.config.ts`) and never sees a
password or session cookie — there is no custom auth HTTP layer in this app.

```text
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Clerk <SignIn│    │ ClerkProvider│    │ useAuth /    │   │
│  │  /SignUp>    │    │ (main.tsx)   │    │ useUser      │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
└─────────┼───────────────────┼───────────────────┼───────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Clerk (hosted)                              │
│         Session management, password hashing, OAuth          │
│                Issues a signed JWT per session                │
└─────────────────────────┬───────────────────────────────────┘
                          │ JWT attached to every Convex call
                          │ via ConvexProviderWithClerk
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Convex JWT Verification                        │
│              (convex/auth.config.ts)                         │
│    Verifies the JWT against the Clerk issuer domain           │
│    (CLERK_JWT_ISSUER_DOMAIN env var, per deployment)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Application Profiles Layer                   │
│               (convex/lib/auth.ts)                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │ requireAuth  │    │ requireAdmin  │    │ requireVer │  │
│  │              │    │              │    │    ified   │  │
│  └──────────────┘    └──────────────┘    └────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Database                          │
│                    (profiles table)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### 1. Sign-up / Sign-in

Clerk's embedded `<SignIn>` component (`src/pages/Login.tsx`) handles registration,
login, and Google OAuth entirely — there is no custom form or backend endpoint for any
of it.

```text
User → Login Page → Clerk <SignIn>
              │
              ▼
        Clerk (hosted)
        (email/password or Google)
              │
              ▼
        Issues session + JWT
              │
              ▼
        ClerkProvider makes JWT
        available to Convex client
              │
              ▼
        First authenticated Convex
        call → syncUser mutation
        creates/updates profile
        (default role: buyer)
              │
              ▼
        Redirect to callback URL
```

**Steps:**

1. User interacts with Clerk's `<SignIn>` UI (email/password or "Continue with Google").
2. Clerk validates credentials / completes the OAuth flow and issues a session + JWT.
   AgriBid's code never touches a password or an OAuth token directly.
3. `ConvexProviderWithClerk` (in `src/main.tsx`) attaches the current Clerk JWT to every
   Convex request.
4. `Layout.tsx` calls the `syncUser` mutation whenever the signed-in user's id changes;
   `syncUserHandler` (`convex/users.ts`) creates the `profiles` row on first login
   (default role `buyer`, `isVerified: false`) or patches `name`/`email` on subsequent
   logins.
5. User is redirected to the (validated) `callbackUrl` query param, or `/` if absent or
   unsafe.

### 2. OAuth Login (Google)

Google sign-in is configured entirely inside the Clerk dashboard (per Clerk instance —
dev and prod are configured separately) and requires no app code. Clerk performs the
full OAuth 2.0 flow and hands the frontend the same JWT/session as an email/password
login; the rest of the flow (steps 3-5 above) is identical.

---

## Authorization Flow

### Role-Based Access Control (RBAC)

```text
Request → Convex function
              │
              ▼
        ctx.auth.getUserIdentity()
        (Convex verifies the Clerk JWT)
              │
              ├──────────────────┐
              │                  │
              ▼                  ▼
        Identity Exists    No Identity
              │                  │
              ▼                  ▼
        Look up profile    requireAuth() throws
        by userId          "Not authenticated"
        Check role
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
    Authorized   Unauthorized
        │           │
        ▼           ▼
    Allow Access  Throw / 403
```

### Authorization Utilities

Located in `convex/lib/auth.ts`:

| Function                    | Purpose                                                 | Access Level     |
| --------------------------- | ------------------------------------------------------- | ---------------- |
| `getAuthUser()`             | Map the verified Clerk identity to `AuthUser`           | Public           |
| `getCallerRole()`           | Get user's role from profile                            | Public           |
| `requireAuth()`             | Ensure user is authenticated                            | Authenticated    |
| `requireProfile()`          | Ensure authenticated with profile                       | Authenticated    |
| `requireAdmin()`            | Ensure user is admin                                    | Admin only       |
| `requireVerified()`         | Ensure profile is KYC verified                          | Verified users   |
| `requireVerifiedSeller()`   | Ensure profile is KYC-verified seller (or admin)        | Verified sellers |
| `getAuthenticatedProfile()` | Get auth user + profile (alias: `getAuthWithProfile()`) | Public           |

---

## Session Management

Session issuance, storage, and expiry are entirely owned by Clerk — AgriBid's frontend
and Convex backend never see or manage a session cookie directly.

```text
Browser                  Clerk (hosted)              Convex Server
   │                          │                             │
   │──── Sign in ────────────▶│                             │
   │◀─── Session + JWT ───────│                             │
   │                          │                             │
   │──── Convex call with current JWT ────────────────────▶│
   │      (ConvexProviderWithClerk attaches it)              │
   │                          │      Verifies JWT against    │
   │                          │      CLERK_JWT_ISSUER_DOMAIN │
   │◀─── Response + Data ──────────────────────────────────│
```

### Session Validation

- Clerk manages session lifetime, refresh, and revocation client-side.
- `ConvexProviderWithClerk` (`convex/react-clerk`) automatically refreshes and attaches
  the current JWT to every Convex request.
- Convex verifies the JWT's signature and issuer on every request against the domain
  configured in `convex/auth.config.ts` (read from the `CLERK_JWT_ISSUER_DOMAIN`
  environment variable, set per Convex deployment — dev and prod point at different
  Clerk instances).
- An expired or invalid JWT simply results in `ctx.auth.getUserIdentity()` returning
  `null`; Clerk's client SDK handles re-authentication.

---

## Profile Creation Flow

### First Login Profile Creation

```text
User authenticates via Clerk
           │
           ▼
    syncUser mutation runs
    (triggered from Layout.tsx
     whenever the Clerk user id
     changes)
           │
    Check if profile exists
    (by userId, the Clerk subject)
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Exists      Not Exists
     │           │
     ▼           ▼
  Patch       Create Profile
  name/email     │
  if changed     ▼
             Default Role: buyer
             isVerified: false
             name/email from
             Clerk identity
```

---

## Route Protection

### Frontend Route Protection

```typescript
// RoleProtectedRoute component
// Located: src/components/RoleProtectedRoute.tsx
// Uses useSession() (a thin Clerk wrapper — see src/lib/auth-client.ts)
// plus the Convex getMyProfile query, not Clerk state directly, so role
// checks always reflect the application's profile/role data.

const { data: session, isPending } = useSession();
const userData = useQuery(api.users.getMyProfile);

if (!session) {
  return <Navigate to="/login" />;
}

if (allowedRole !== "any" && userData?.profile?.role !== allowedRole) {
  // Renders an "Unauthorized" state
}
```

### Backend Route Protection

```typescript
// Example: Admin-only mutation

export const adminAction = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    // requireAdmin throws if not admin
    await requireAdmin(ctx);

    // Proceed with admin action
  }
});
```

---

## Security Measures

### Open Redirect Protection

- The post-login `callbackUrl` query param is validated by `isValidCallbackUrl()`
  (`src/lib/utils.ts`) before use: it must be a same-origin relative path starting with
  a single `/` (rejects `//host`, `https://host`, etc.). Anything invalid falls back to
  `/`.
- Implemented in `src/pages/Login.tsx` and `src/hooks/useAuthRedirect.ts`.

### Password Requirements

- Password policy, hashing, and storage are entirely managed by Clerk — AgriBid never
  receives or stores a password. Configure password requirements in the Clerk
  dashboard.

### Rate Limiting

- Convex handles rate limiting at infrastructure level.
- Max 10 bids per user per minute (application level).

---

## Data Storage

### Identity (Clerk)

User identity (email, name, password hash, OAuth linkage, sessions) is stored entirely
by Clerk, outside the Convex database. AgriBid never persists a password.

### Application Profile (AgriBid)

```text
Table: profiles
- userId: string (Clerk subject / user id)
- name: string (optional, synced from Clerk on login)
- email: string (optional, synced from Clerk on login)
- role: "buyer" | "seller" | "admin"
- isVerified: boolean
- kycStatus: "pending" | "verified" | "rejected"
- createdAt: timestamp
- updatedAt: timestamp
... (encrypted PII fields)
```

---

_Last Updated: 2026-09-05 (migrated from Better Auth to Clerk)_
