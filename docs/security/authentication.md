# Security: Authentication

This document describes authentication security policies, implementations, and best practices in AgriBid.

## Authentication Overview

AgriBid uses **Better Auth** as the authentication solution, integrated with **Convex** for backend operations.

### Supported Methods

| Method             | Status      | Description                             |
| ------------------ | ----------- | --------------------------------------- |
| Email/Password     | Implemented | Traditional login with hashed passwords |
| Google OAuth       | Implemented | OAuth 2.0 with Google                   |
| Session Management | Implemented | Server-side session handling            |

---

## Password Security

### Hashing

- **Algorithm**: bcrypt (via Better Auth)
- **Work Factor**: 12 rounds (recommended for production)
- **Storage**: Hashed in database, never stored in plaintext

### Requirements

- Minimum 12 characters (14+ recommended for sensitive accounts)
- No maximum length restriction (supports passphrases)
- Email validation (format check)

### Implementation

```typescript
// Password handling is managed by Better Auth
// Registration flow:
const signUpResponse = await fetch("/api/sign-up", {
  method: "POST",
  body: JSON.stringify({
    email: "user@example.com",
    password: "securePassword123",
    name: "John Doe",
  }),
});
```

---

## OAuth Security

### Google OAuth

- **Protocol**: OAuth 2.0
- **Token Type**: JWT
- **Scope**: `openid`, `email`, `profile`

### Security Measures

1. **State Parameter**: CSRF protection via state token
2. **Code Exchange**: Server-side token exchange (never exposed to client)
3. **Token Validation**: Server-side verification of JWT signature

---

## Session Management

### Session Storage

- Sessions stored server-side in Convex/Better Auth
- Session ID passed via HTTP-only, Secure cookies
- No sensitive data in client-side storage

### Session Lifecycle

| Event         | Action                         |
| ------------- | ------------------------------ |
| Login         | Create session, set cookie     |
| Valid Request | Extend session                 |
| Logout        | Invalidate session             |
| Inactivity    | Session expires (configurable) |
| Browser Close | Cookie cleared                 |

### Configuration

```typescript
// app/convex/auth.config.ts
export const authConfig = {
  sessionExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days (recommended for financial platform)
  // Additional config...
};
```

---

## Open Redirect Protection

### Implementation

All authentication redirects are validated against an allowed list of domains.

```typescript
// app/convex/auth.config.ts

const ALLOWED_REDIRECT_URLS = [
  "http://localhost:5173",
  "https://agribid.vercel.app",
];

export function isAllowedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_URLS.some(
      (allowed) => parsed.origin === new URL(allowed).origin
    );
  } catch {
    return false;
  }
}
```

### Usage

```typescript
// In auth handlers
const redirectTo = request.nextUrl.searchParams.get("redirect");
if (redirectTo && isAllowedRedirect(redirectTo)) {
  // Safe to redirect
}
```

---

## Rate Limiting

### Application Level

- **Bid Rate**: Max 10 bids per user per minute
- **API Rate**: Convex handles at infrastructure level

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
1. User enters credentials
          │
          ▼
2. POST to /api/sign-in
          │
          ▼
3. Validate credentials
   (bcrypt compare)
          │
          ├──────────────────┐
          ▼                  ▼
     Success            Failure
          │                  │
          ▼                  ▼
4. Create session      Show error
5. Set HTTP-only      (no details
   cookie               leaked)
6. Redirect to
   validated URL
```

### Logout Flow

```text
1. User clicks logout
          │
          ▼
2. POST to /api/sign-out
          │
          ▼
3. Invalidate session
   (server-side)
          │
          ▼
4. Clear session cookie
5. Redirect to home
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

_Note: These are handled by Vercel deployment platform. A strong CSP using nonces or strict-dynamic is recommended for modern XSS mitigation._

---

## Security Best Practices

### User Responsibilities

1. Use strong, unique passwords
2. Enable OAuth for additional security
3. Log out on shared devices
4. Report suspicious activity

### Developer Responsibilities

1. Never log sensitive data (passwords, tokens)
2. Validate all inputs server-side
3. Use parameterized queries (Convex handles this)
4. Keep dependencies updated
5. Follow principle of least privilege

---

## Incident Response

### Account Compromise

1. **Detection**: Unusual activity patterns
2. **Containment**: Temporarily disable account
3. **Investigation**: Review audit logs
4. **Recovery**: Restore account to legitimate owner
5. **Prevention**: Implement additional security measures

### Password Reset

1. User requests password reset
2. Email with reset token (time-limited)
3. Token validated on return
4. Password updated (hashed)
5. All existing sessions invalidated

---

## Compliance

### Data Protection

- Passwords hashed with bcrypt
- Sessions managed server-side
- No sensitive data in URLs
- HTTPS enforced in production

### Audit Trail

All authentication events logged:

- Login attempts (success/failure)
- Logouts
- Password changes
- Account modifications

---

_Last Updated: 2026-03-02_
