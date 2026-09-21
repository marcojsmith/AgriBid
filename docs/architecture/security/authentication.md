# Security: Authentication

This document describes authentication security policies, implementations, and best practices in AgriBid.

## Authentication Overview

AgriBid uses **Clerk** as the authentication provider. Clerk owns sign-up, sign-in,
password hashing, session management, and OAuth entirely; Convex only verifies the JWT
Clerk issues (via `convex/auth.config.ts`) and never receives a password.

### Supported Methods

| Method             | Status      | Description                                     |
| ------------------ | ----------- | ----------------------------------------------- |
| Email/Password     | Implemented | Handled entirely by Clerk's hosted `<SignIn>`   |
| Google OAuth       | Implemented | OAuth 2.0 with Google, configured in Clerk      |
| Session Management | Implemented | Managed entirely by Clerk (client SDK + hosted) |

Both methods are configured per Clerk instance in the Clerk dashboard — the dev and
production instances are configured independently.

---

## Password Security

### Hashing

- **Algorithm & storage**: Managed entirely by Clerk. AgriBid's code never receives,
  logs, or stores a plaintext or hashed password.
- **Policy**: Configured in the Clerk dashboard (length, complexity requirements, breach
  detection, etc.) — not application code.

### Implementation

```tsx
// src/pages/Login.tsx — Clerk's hosted component handles the entire flow,
// there is no custom form or fetch call to a sign-up endpoint.
<SignIn
  routing="hash"
  fallbackRedirectUrl={callbackURL}
  signUpFallbackRedirectUrl={callbackURL}
/>
```

---

## OAuth Security

### Google OAuth

- **Protocol**: OAuth 2.0, handled by Clerk.
- **Token Type**: Clerk issues its own JWT after completing the OAuth flow; AgriBid
  never sees the Google-issued token.
- **Configuration**: Enabled/configured per Clerk instance in the Clerk dashboard, not
  in this codebase.

### Security Measures

Clerk owns CSRF/state-parameter protection, server-side code exchange, and token
signature validation for the OAuth flow. AgriBid's responsibility is limited to
verifying the resulting JWT (see below).

---

## Session Management

### Session Storage

- Sessions are created, stored, and refreshed entirely by Clerk (client SDK + hosted
  infrastructure) — AgriBid sets no session cookie of its own.
- `ConvexProviderWithClerk` (`src/main.tsx`) attaches the current Clerk-issued JWT to
  every Convex request; Convex verifies it on each call via
  `ctx.auth.getUserIdentity()`.

### JWT Verification

```typescript
// convex/auth.config.ts
const clerkJwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkJwtIssuerDomain) {
  throw new Error("Missing CLERK_JWT_ISSUER_DOMAIN environment variable.");
}

export default {
  providers: [{ domain: clerkJwtIssuerDomain, applicationID: "convex" }],
};
```

`CLERK_JWT_ISSUER_DOMAIN` is set per Convex deployment (`bunx convex env set
CLERK_JWT_ISSUER_DOMAIN <domain>`) — the dev deployment points at Clerk's Development
instance, production points at the Production instance. These must never be mixed.

### Session Lifecycle

| Event         | Action                                           |
| ------------- | ------------------------------------------------ |
| Login         | Clerk creates session + JWT                      |
| Valid Request | Clerk SDK silently refreshes the JWT as needed   |
| Logout        | `useClerk().signOut()` invalidates the session   |
| Inactivity    | Session expires per Clerk instance configuration |
| Browser Close | Governed by Clerk's session persistence settings |

---

## Open Redirect Protection

### Implementation

The post-login redirect target is validated client-side before use — it must be a
same-origin relative path.

```typescript
// src/lib/utils.ts
export function isValidCallbackUrl(
  url: string | null | undefined
): url is string {
  if (!url) return false;
  // Must start with / and not // (rejects protocol-relative URLs)
  return url.startsWith("/") && !url.startsWith("//");
}
```

### Usage

```typescript
// src/pages/Login.tsx
const rawCallback = searchParams.get("callbackUrl");
const callbackURL = isValidCallbackUrl(rawCallback) ? rawCallback : "/";
```

Anything that isn't a safe relative path (an absolute URL, a protocol-relative `//host`
URL, etc.) falls back to `/`.

---

## Rate Limiting

### Application Level

- **Bid Rate**: Max 10 bids per user per minute.
- **API Rate**: Convex handles at infrastructure level.

### Implementation

```typescript
// In bidding mutation
const RECENT_BID_WINDOW = 60000; // 1 minute
const MAX_BIDS_PER_WINDOW = 10;

async function checkBidRateLimit(ctx: MutationCtx, userId: string) {
  const windowStart = Date.now() - RECENT_BID_WINDOW;

  const recentBids = await ctx.db
    .query("bids")
    .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
    .filter((q) => q.gte("timestamp", windowStart))
    .collect();

  if (recentBids.length >= MAX_BIDS_PER_WINDOW) {
    throw new Error("Rate limit exceeded. Please wait before bidding again.");
  }
}
```

---

## Authentication Flow Security

### Login Flow

```text
1. User interacts with Clerk's <SignIn>
          │
          ▼
2. Clerk validates credentials / completes OAuth
   (entirely within Clerk's hosted infrastructure)
          │
          ├──────────────────┐
          ▼                  ▼
     Success            Failure
          │                  │
          ▼                  ▼
3. Clerk issues        Clerk's <SignIn>
   session + JWT        shows the error
          │             (no app code involved)
          ▼
4. ConvexProviderWithClerk attaches
   the JWT to Convex requests
          │
          ▼
5. Redirect to validated callbackUrl
```

### Logout Flow

```text
1. User clicks logout
          │
          ▼
2. useClerk().signOut({ redirectUrl: "/" })
   (src/components/header/Header.tsx)
          │
          ▼
3. Clerk invalidates the session
   (server-side, within Clerk)
          │
          ▼
4. Redirect to "/"
```

---

## Security Headers

### HTTP Security Headers

| Header                    | Value            | Purpose                                           |
| ------------------------- | ---------------- | ------------------------------------------------- |
| X-Content-Type-Options    | nosniff          | Prevent MIME sniffing                             |
| X-Frame-Options           | DENY             | Prevent iframe embedding                          |
| X-XSS-Protection          | 0 (Legacy)       | Recommendation: Use Content-Security-Policy (CSP) |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS                                       |

_Note: These are handled by the Vercel deployment platform. A strong CSP using nonces
or strict-dynamic is recommended for modern XSS mitigation, and must allow Clerk's
hosted domains for the `<SignIn>`/`<SignUp>` components to render._

---

## Security Best Practices

### User Responsibilities

1. Use strong, unique passwords
2. Enable OAuth for additional security
3. Log out on shared devices
4. Report suspicious activity

### Developer Responsibilities

1. Never log sensitive data (tokens, PII)
2. Validate all inputs server-side
3. Use parameterized queries (Convex handles this)
4. Keep dependencies updated
5. Follow principle of least privilege
6. Never commit Clerk secret keys or publishable keys for the production instance to
   the repository — set them via `bunx convex env set` (server-side vars) or the
   hosting platform's environment configuration (frontend vars)

---

## Incident Response

### Account Compromise

Session/credential compromise is handled via the Clerk dashboard (force sign-out,
password reset, MFA enforcement). AgriBid's own responsibility is limited to:

1. **Detection**: Unusual activity patterns in `profiles`/audit logs
2. **Containment**: Revoke the affected user's sessions in the Clerk dashboard;
   optionally suspend their `profiles` row (`isVerified: false`)
3. **Investigation**: Review `logAudit` entries for the affected user
4. **Recovery**: Restore account access via Clerk once verified
5. **Prevention**: Review Clerk's security settings (MFA, breach password detection)

### Password Reset

Fully self-serve via Clerk's hosted flow — AgriBid has no custom password-reset code or
endpoint.

---

## Compliance

### Data Protection

- Passwords are never stored by AgriBid — Clerk owns hashing and storage entirely
- Sessions managed server-side by Clerk
- No sensitive data in URLs
- HTTPS enforced in production

### Audit Trail

All administrative and authorization-relevant events are logged via `logAudit`
(`convex/admin_utils.ts`), including:

- Role changes (promotion to admin, verification)
- KYC review actions
- Other admin actions on user profiles

Login/logout/password-change events themselves are tracked by Clerk (visible in the
Clerk dashboard), not duplicated into AgriBid's own audit log.

---

_Last Updated: 2026-09-05 (migrated from Better Auth to Clerk)_
