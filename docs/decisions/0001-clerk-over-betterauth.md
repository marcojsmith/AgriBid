# 0001 - Clerk over Better Auth

Date: 2026-09 (PR #254, env-driven config PR #255) | Status: Accepted

## Context

AgriBid originally used Better Auth as a Convex component, storing `user`/`account`/`session` tables inside Convex. The source notes do not record the motivation for switching.

## Decision

Migrate to Clerk. Clerk owns sign-up, sign-in, sessions, and Google OAuth outside Convex. Convex only verifies the Clerk JWT (`convex/auth.config.ts`, issuer from `CLERK_JWT_ISSUER_DOMAIN`) and maps claims in `convex/lib/auth.ts`. No `convex/auth.ts` and no auth HTTP routes.

## Consequences

- No credentials or sessions in the Convex database.
- `profiles` now caches `name`/`email` (synced by `syncUserHandler`); the `findUserById` helper is gone.
- `AuthUser._id` is a plain string (Clerk subject), not a branded `Id`.
- Dev and prod deployments must use separate Clerk instances, kept matched with `VITE_CLERK_PUBLISHABLE_KEY`.
- Business logic keyed on `profiles.userId` was untouched (see 0002).
- Stack docs that still said BetterAuth had to be corrected.
