# Authentication Data Flow

This document describes the authentication system architecture and data flows in AgriBid.

## Architecture Overview

AgriBid uses **Better Auth** integrated with **Convex** for authentication and authorization.

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Login Page  │    │ Signup Form  │    │ Auth Context │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
└─────────┼───────────────────┼───────────────────┼───────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Convex HTTP Layer                          │
│                  (app/convex/http.ts)                       │
│                  auth route handlers                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Better Auth Server                        │
│                   (Convex Component)                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │   Session    │    │    User      │    │   OAuth    │  │
│  │   Manager    │    │   Manager    │    │  Provider  │  │
│  └──────────────┘    └──────────────┘    └────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Application Profiles Layer                   │
│               (app/convex/lib/auth.ts)                      │
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

### 1. User Registration

```
User → Login Page → Sign Up Form
              │
              ▼
        Better Auth
        (email/password)
              │
              ▼
        Create Session
              │
              ▼
        Create Profile
        (default role: buyer)
              │
              ▼
        Redirect to Home
```

**Steps:**
1. User fills registration form (email, password, name)
2. Better Auth creates auth user and hashes password
3. Profile is created with default role (buyer)
4. Session established via cookie/token
5. Redirect to home page with authenticated state

### 2. User Login

```
User → Login Page → Email/Password
              │
              ▼
        Better Auth
        (validate credentials)
              │
              ├──────────────────┐
              │                  │
              ▼                  ▼
        Success             Failure
              │                  │
              ▼                  ▼
        Create Session    Show Error
              │                  
              ▼                  
        Check/Create      
        Profile            
              │                  
              ▼                  
        Redirect to Home
```

### 3. OAuth Login (Google)

```
User → Login Page → Click Google OAuth
              │
              ▼
        Google OAuth Flow
              │
              ▼
        Callback with token
              │
              ▼
        Better Auth
        (exchange code for user)
              │
              ▼
        Create/Update Profile
              │
              ▼
        Create Session
              │
              ▼
        Redirect to Home
```

---

## Authorization Flow

### Role-Based Access Control (RBAC)

```
Request → Auth Middleware
              │
              ▼
        Get Current User
              │
              ├──────────────────┐
              │                  │
              ▼                  ▼
        User Exists       No User
              │                  │
              ▼                  ▼
        Check Role         Redirect
              │              to Login
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
    Authorized   Unauthorized
        │           │
        ▼           ▼
    Allow Access  Show 403
```

### Authorization Utilities

Located in `app/convex/lib/auth.ts`:

| Function | Purpose | Access Level |
|----------|---------|--------------|
| `getAuthUser()` | Get current authenticated user | Public |
| `getCallerRole()` | Get user's role from profile | Public |
| `requireAuth()` | Ensure user is authenticated | Authenticated |
| `requireProfile()` | Ensure authenticated with profile | Authenticated |
| `requireAdmin()` | Ensure user is admin | Admin only |
| `requireVerified()` | Ensure profile is KYC verified | Verified users |
| `getAuthenticatedProfile()` | Get auth user + profile | Public |

---

## Session Management

### Session Token Flow

```
Browser                        Convex Server
   │                                  │
   │──── Login Request ──────────────▶│
   │                                  │
   │◀─── Set-Cookie (session) ───────│
   │                                  │
   │──── Authenticated Request ─────▶│
   │    (Cookie: session_token)       │
   │                                  │
   │◀─── Response + Data ─────────────│
   │                                  │
```

### Session Validation

- Sessions stored server-side by Better Auth
- Session token passed via HTTP-only cookie
- Convex validates session on each authenticated request
- Expired sessions trigger re-authentication

---

## Profile Creation Flow

### First Login Profile Creation

```
User logs in via Better Auth
           │
           ▼
    Check if profile exists
    (by userId)
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Exists      Not Exists
     │           │
     ▼           ▼
  Continue    Create Profile
                │
                ▼
         Default Role: buyer
         isVerified: false
                │
                ▼
         Redirect to
         profile completion
```

---

## Route Protection

### Frontend Route Protection

```typescript
// RoleProtectedRoute component
// Located: app/src/components/RoleProtectedRoute.tsx

function RoleProtectedRoute({ 
  children, 
  allowedRoles 
}) {
  const { profile } = useUserProfile();
  
  if (!profile) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }
  
  return children;
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

- All auth redirects validated against allowed domains
- Prevents malicious redirect after login
- Implementation in `app/convex/auth.config.ts`

### Password Requirements

- Minimum 8 characters
- Password hashing via bcrypt (Better Auth)
- No plaintext password storage

### Rate Limiting

- Convex handles rate limiting at infrastructure level
- Max 10 bids per user per minute (application level)

---

## Data Storage

### Auth User (Better Auth)

```
Table: users (internal)
- id: string
- email: string
- name: string
- emailVerified: boolean
- image: string (optional)
- createdAt: timestamp
- updatedAt: timestamp
```

### Application Profile (AgriBid)

```
Table: profiles
- userId: string (links to auth user)
- role: "buyer" | "seller" | "admin"
- isVerified: boolean
- kycStatus: "pending" | "verified" | "rejected"
- createdAt: timestamp
- updatedAt: timestamp
... (encrypted PII fields)
```

---

*Last Updated: 2026-03-02*
