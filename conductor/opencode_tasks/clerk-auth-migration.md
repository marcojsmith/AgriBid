# Task: Migrate auth from Better Auth to Clerk

## Context

AgriBid is a React + Vite + Convex SPA. Auth is currently handled by `better-auth` + `@convex-dev/better-auth`.
We are replacing it entirely with Clerk (`@clerk/clerk-react` + `convex/react-clerk`).

**Clerk JWT issuer URL**: `https://neat-horse-38.clerk.accounts.dev`
**Auth methods**: Email/password + Google (configured in Clerk dashboard — no code changes needed for this)
**Existing users**: Will re-register — no data migration needed.

### Key existing patterns to understand before changing

- `useSession()` from `@/lib/auth-client` is used in ~14 files. Returns `{ data: { user: { id, email, name } } | null, isPending: boolean }`.
- `signOut()` imported directly in `src/components/header/Header.tsx`.
- `findUserById()` in `convex/users.ts` uses `components.auth.adapter.findOne` (Better Auth adapter) — must be removed.
- `convex/lib/auth.ts`'s `getAuthUser()` currently delegates to `authComponent.getAuthUser(ctx)` — must be simplified to `ctx.auth.getUserIdentity()`.
- `syncUser` mutation in `convex/users.ts` creates the profile on first login — called from `Layout.tsx` when `session?.user?.id` changes. It must now also store `name` and `email` on the profile, since the Better Auth user table is gone.
- Admin queries (`listAllProfiles`, `getProfileForKYC`) currently call `findUserById` to get name/email — after migration they should read `name`/`email` directly from the `profiles` table.

---

## Instructions

### Step 1 — Install Clerk, remove Better Auth packages

In `package.json`:

- Add `"@clerk/clerk-react": "^5.0.0"` to dependencies (use latest stable v5 if v6 is not available)
- Remove `"better-auth"` from dependencies
- Remove `"@convex-dev/better-auth"` from dependencies

Run: `bun install`

---

### Step 2 — Update `convex/auth.config.ts`

Replace the entire file:

```typescript
export default {
  providers: [
    {
      domain: "https://neat-horse-38.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
```

---

### Step 3 — Delete `convex/auth.ts`

Delete the file `convex/auth.ts` entirely. It contained the Better Auth instance and a `getAuthUser` Convex query that was used by `ConvexBetterAuthProvider`. Neither is needed with Clerk.

---

### Step 4 — Rewrite `convex/http.ts`

Strip all Better Auth HTTP routes. Keep the CORS helpers (they may be used by other future routes) but remove all route registrations. The file becomes:

```typescript
import { httpRouter } from "convex/server";

import { isOriginAllowed } from "./config";

const http = httpRouter();

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const isAllowed = isOriginAllowed(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cookie, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function addCorsHeaders(response: Response, request: Request): Response {
  const corsHeaders = getCorsHeaders(request);
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default http;
```

---

### Step 5 — Rewrite `convex/lib/auth.ts`

Replace the `getAuthUser` function and the import of `authComponent`/`AuthUser` from `../auth` with a simpler implementation using `ctx.auth.getUserIdentity()` directly.

Define `AuthUser` locally. Remove all references to `authComponent`. Keep all other exported functions (`requireAuth`, `requireAdmin`, `getCallerRole`, `getAuthWithProfile`, `requireProfile`, `requireVerified`, `requireVerifiedSeller`, `tryRequireAdmin`, `getAuthenticatedUserId`, `resolveUserId`, `getAuthenticatedProfile`) unchanged since they build on `getAuthUser`.

The new file should:

1. Remove: `import { authComponent } from "../auth";` and `import type { AuthUser } from "../auth";`
2. Define `AuthUser` locally:

```typescript
export type AuthUser = {
  _id: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};
```

3. Replace `getAuthUser` with:

```typescript
export async function getAuthUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthUser | null> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      _id: identity.subject,
      userId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
      image: identity.pictureUrl ?? null,
    };
  } catch {
    return null;
  }
}
```

4. Keep all other functions exactly as-is (they all delegate to `getAuthUser` already).

---

### Step 6 — Update `convex/schema.ts`

Add `name` and `email` optional fields to the `profiles` table definition:

```typescript
name: v.optional(v.string()),
email: v.optional(v.string()),
```

Add them after the existing `userId` field and before `role`.

---

### Step 7 — Update `convex/users.ts`

Make these changes:

**A. Remove `findUserById`** — delete the entire `findUserById` function (lines ~94–117 in the original). It uses `components.auth.adapter.findOne` which is Better Auth–specific.

**B. Remove the `components` import** — remove `import { components } from "./_generated/api";` since it's no longer used after removing `findUserById`.

**C. Update `ProfileValidator`** — add `name` and `email` optional fields:

```typescript
name: v.optional(v.string()),
email: v.optional(v.string()),
```

Add them after `userId` and before `role` to match the schema.

**D. Update `ProfileForKYCValidator`** — since `ProfileValidator` now includes `name` and `email`, remove them from the `.extend()` call. The validator becomes:

```typescript
export const ProfileForKYCValidator = ProfileValidator;
```

**E. Update `syncUserHandler`** — store and update `name` and `email` on the profile from the auth identity. Change:

- On insert: add `name: authUser.name ?? undefined, email: authUser.email ?? undefined`
- On existing profile (when it already exists): patch name/email to stay in sync with Clerk

The updated handler:

```typescript
export const syncUserHandler = async (ctx: MutationCtx) => {
  try {
    const authUser = await requireAuth(ctx);
    const linkId = resolveUserId(authUser);
    if (!linkId) return null;

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    const now = Date.now();
    if (!existingProfile) {
      await ctx.db.insert("profiles", {
        userId: linkId,
        name: authUser.name ?? undefined,
        email: authUser.email ?? undefined,
        role: "buyer",
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      await updateCounter(ctx, "profiles", "total", 1);
    } else {
      // Keep name/email in sync with Clerk
      await ctx.db.patch(existingProfile._id, {
        name: authUser.name ?? undefined,
        email: authUser.email ?? undefined,
        updatedAt: now,
      });
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unauthenticated")) {
      console.error("Error in syncUser:", err);
    }
    return null;
  }
};
```

**F. Update `listAllProfilesHandler`** — remove the `findUserById` call and use `p.name`/`p.email` from the profile directly:

```typescript
// Replace:
// const user = await findUserById(ctx, p.userId);
// name: user?.name,
// email: user?.email,

// With:
name: p.name,
email: p.email,
```

Remove the `presenceMap` and `presences` parallel lookup for user data — but keep the presence lookup for online status. Only remove the `findUserById` call. The page mapping becomes:

```typescript
const page = await Promise.all(
  profiles.page.map(async (p: Doc<"profiles">) => {
    const presence = presenceMap.get(p.userId);
    const isOnline = presence
      ? now - presence.updatedAt < PRESENCE_HEARTBEAT_THRESHOLD
      : false;

    return {
      _id: p._id,
      _creationTime: p._creationTime,
      userId: p.userId,
      role: p.role,
      isVerified: p.isVerified,
      kycStatus: p.kycStatus,
      name: p.name,
      email: p.email,
      createdAt: p.createdAt,
      isOnline,
    };
  })
);
```

**G. Update `getProfileForKYCHandler`** — remove the `findUserById` call. Use `profile.name` and `profile.email` directly. The return statement changes:

```typescript
// Remove: const user = await findUserById(ctx, userId);
// Replace: name: user?.name,  with  name: profile.name,
// Replace: email: user?.email, with  email: profile.email,
```

---

### Step 8 — Rewrite `src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";

import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <ClerkProvider
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ErrorBoundary>
            <App />
            <Toaster position="top-center" richColors />
          </ErrorBoundary>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>
);
```

---

### Step 9 — Rewrite `src/lib/auth-client.ts`

Replace the Better Auth client with a Clerk compatibility shim. All existing components import `useSession` from here — this shim preserves that interface.

```typescript
// Clerk compatibility shim — replaces Better Auth client
// All components that import useSession from here continue to work unchanged.
import { useAuth, useUser } from "@clerk/clerk-react";

export function useSession() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const data =
    isSignedIn && user
      ? {
          user: {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? null,
            name: user.fullName ?? null,
          },
        }
      : null;

  return { data, isPending: !isLoaded };
}
```

---

### Step 10 — Rewrite `src/types/auth.ts`

Replace the `authClient.$Infer` types with manual definitions since `authClient` no longer exists:

```typescript
export type User = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type Session = {
  user: User;
};

/**
 * Shared type for users with role and verification metadata.
 * Used to avoid manual type assertions across the codebase.
 */
export type UserWithRole = User & {
  role?: "admin" | "seller" | "buyer" | string;
  isVerified?: boolean;
};

export type SessionWithRole = Session & {
  user: UserWithRole;
};

export interface UserProfileMetadata {
  _id: string;
  userId: string;
  role: "admin" | "seller" | "buyer" | string;
  isVerified: boolean;
  kycStatus?: "none" | "pending" | "verified" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface UserDataWithProfile {
  _id?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  profile?: UserProfileMetadata | null;
}
```

---

### Step 11 — Update `src/components/header/Header.tsx`

Replace the `signOut` import from `auth-client` with Clerk's `useClerk` hook:

1. Remove: `import { signOut } from "@/lib/auth-client";`
2. Add: `import { useClerk } from "@clerk/clerk-react";`
3. Inside the `Header` component, add: `const { signOut } = useClerk();`
4. Update `handleSignOut` to use Clerk's signOut with redirect:

```typescript
const handleSignOut = async () => {
  try {
    await signOut({ redirectUrl: "/" });
    void toast.success("Signed out successfully");
  } catch (err) {
    console.error("Sign out failed:", err);
    void toast.error("Failed to sign out. Please try again.");
  }
};
```

Note: Remove the `navigate("/")` call since Clerk's `signOut` handles the redirect via `redirectUrl`.

---

### Step 12 — Rewrite `src/pages/Login.tsx`

Replace the custom email/password form with Clerk's embedded `<SignIn>` component. Clerk handles both email/password and Google sign-in based on dashboard configuration.

```tsx
import { useAuth, SignIn } from "@clerk/clerk-react";
import { Navigate, useSearchParams } from "react-router-dom";

import { useBranding } from "@/hooks/useBranding";
import { isValidCallbackUrl } from "@/lib/utils";
import { LoadingPage } from "@/components/LoadingIndicator";

export default function Login() {
  const branding = useBranding();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchParams] = useSearchParams();

  const rawCallback = searchParams.get("callbackUrl");
  const callbackURL = isValidCallbackUrl(rawCallback) ? rawCallback : "/";

  if (!isLoaded) {
    return <LoadingPage message="Authenticating..." />;
  }

  if (isSignedIn) {
    return <Navigate to={callbackURL} replace />;
  }

  return (
    <div className="flex flex-col items-center mt-12 mb-20 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-black text-primary mb-2 uppercase tracking-tight">
          {branding?.appName ?? "AgriBid"} Access
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          Real-Time Bidding for Serious Farmers
        </p>
      </div>
      <SignIn
        routing="hash"
        afterSignInUrl={callbackURL}
        afterSignUpUrl={callbackURL}
      />
    </div>
  );
}
```

---

### Step 13 — Update `src/components/Layout.tsx`

Replace the `useSession` import with Clerk's `useAuth` and `useUser` hooks. The `userId` that triggers `syncUser` should now come from Clerk.

1. Remove: `import { useSession } from "@/lib/auth-client";`
2. Add: `import { useAuth, useUser } from "@clerk/clerk-react";`
3. Inside the `Layout` component, replace:
   ```typescript
   const { data: session } = useSession();
   const userId = session?.user?.id;
   ```
   With:
   ```typescript
   const { isSignedIn } = useAuth();
   const { user } = useUser();
   const userId = user?.id;
   ```
4. Replace `{session && (` with `{isSignedIn && (`

---

### Step 14 — Verify no remaining Better Auth imports

After completing all above steps, search for any remaining imports from:

- `@convex-dev/better-auth`
- `better-auth`
- `authComponent` from `../auth` or `./auth`
- `createAuth` from `./auth`

Fix any found by applying the same Clerk patterns.

---

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md`
- No `any` types (use proper TypeScript)
- Keep all existing argument and return validators on Convex functions
- Do NOT modify test files — tests may break and that is expected; they will be fixed separately
- Do NOT change any other business logic (auctions, bids, KYC, etc.)
- Do NOT remove the CORS helpers from `convex/http.ts`
- The `profiles` table schema change (adding `name`/`email`) requires running `npx convex dev` to push the schema — note this in Results but do not run it

---

## Progress

Steps already completed (DO NOT redo these):

- ✅ Step 1: `@clerk/clerk-react@5.61.3` installed, `better-auth` and `@convex-dev/better-auth` removed
- ✅ Step 2: `convex/auth.config.ts` updated with Clerk issuer domain
- ✅ Step 3: `convex/auth.ts` deleted
- ✅ Step 4: `convex/http.ts` rewritten (auth routes removed, CORS helpers kept)
- ✅ Step 5: `convex/lib/auth.ts` rewritten (`getAuthUser` now uses `ctx.auth.getUserIdentity()`, `AuthUser` type defined locally, all `authComponent` references removed)

Steps remaining — execute these now:

- [x] Step 6: Update `convex/schema.ts`
- [x] Step 7: Update `convex/users.ts`
- [x] Step 8: Rewrite `src/main.tsx`
- [x] Step 9: Rewrite `src/lib/auth-client.ts`
- [x] Step 10: Rewrite `src/types/auth.ts`
- [x] Step 11: Update `src/components/header/Header.tsx`
- [x] Step 12: Rewrite `src/pages/Login.tsx`
- [x] Step 13: Update `src/components/Layout.tsx`
- [x] Step 14: Verify no remaining Better Auth imports
- [x] Run typecheck: `bun run type-check`

IMPORTANT: Do NOT read `.env.local` or any `.env*` files. Skip any step that would require reading those files.

## Results

<!-- opencode: fill this in when done -->

**Steps completed:** 6-14
**Production code:** ✅ All production code type-checks successfully
**Test files:** ❌ 37 test errors (expected per constraints - tests will be fixed separately)

### Changes made:

1. **convex/schema.ts** - Added `name` and `email` fields to profiles table
2. **convex/users.ts** - Removed `findUserById`, updated validators, `syncUser` stores name/email, `listAllProfiles` and `getProfileForKYC` read directly from profiles
3. **convex/convex.config.ts** - Removed Better Auth plugin
4. **src/main.tsx** - Rewrote with ClerkProvider + ConvexProviderWithClerk
5. **src/lib/auth-client.ts** - Clerk compatibility shim preserving `useSession()` interface
6. **src/types/auth.ts** - Manual type definitions (removed authClient.$Infer)
7. **src/components/header/Header.tsx** - Using Clerk's `useClerk()` hook for signOut
8. **src/pages/Login.tsx** - Uses Clerk's `<SignIn>` component
9. **src/components/Layout.tsx** - Uses Clerk's `useAuth`/`useUser` hooks
10. **vite.config.ts** - Removed Better Auth config, updated manualChunks
11. **convex/auctions/helpers.ts** - Removed `findUserById` import, reads seller profile directly
12. **convex/auctions/queries/admin.ts** - Reads reporter profiles directly
13. **convex/auctions/queries/bids.ts** - Reads bidder profiles directly
14. **convex/auctions/queries/browse.ts** - Reads seller profile directly

### Note:

- Run `npx convex dev` to push the schema changes (profiles now have `name`/`email` fields)
- Test files have 37 errors (per constraints - tests will be fixed separately)
