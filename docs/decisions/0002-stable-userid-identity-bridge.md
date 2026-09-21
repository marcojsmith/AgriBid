# 0002 - Stable userId identity bridge

Date: undated (from conductor/user_linking_design.md) | Status: Accepted

## Context

Identity (credentials, sessions) and business profile (roles, KYC, app state) need to be linked without coupling business data to the auth provider.

## Decision

Link via a stable shared string `profiles.userId` (the Clerk JWT `subject`), not an internal table `_id`. `auctions.sellerId`, `bids.bidderId`, and `watchlist.userId` all reference `profiles.userId`. A just-in-time `syncUser` mutation, called from `Layout.tsx` when the Clerk identity changes, creates or patches the profile (defaults `role: "buyer"`, `isVerified: false`).

## Consequences

- The auth provider was swapped (Better Auth to Clerk) with no change to business logic.
- Reads take `name`/`email` from the profile; no second identity lookup.
- Missing claims never overwrite stored values with `undefined`.
- Application fields stay out of the identity provider.
