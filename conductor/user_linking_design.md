# User Linking Database Design: Identity vs. Profile

This document defines the architecture for linking the **Authentication Provider**
(Clerk) and the **Application Component** (AgriBid) within the database.

> **History:** AgriBid originally used Better Auth as a Convex component, which stored
> `user`/`account`/`session` tables inside the Convex database itself. The app migrated
> to Clerk (September 2026); Clerk owns identity entirely outside Convex now, and the
> original design's prediction held up — only the identity-side sync logic needed to
> change, all business logic keyed on `profiles.userId` was untouched.

## 1. Design Philosophy: The "Identity Bridge"

To maintain a clean separation of concerns, we distinguish between **Identity**
(Security, Credentials, Sessions) and **Profile** (Business Metadata, Roles,
Application State).

### Component Roles

- **Clerk (external)**: Owns the entire identity lifecycle — credentials, password
  hashing, sessions, OAuth linkage (Google). None of this lives in the Convex database;
  Convex only verifies the JWT Clerk issues.
- **App Component (Convex)**: Owns the `profiles` table and business entities like
  `auctions` and `bids`. It consumes the verified identity (via
  `ctx.auth.getUserIdentity()`) to provide context.

## 2. Linking Mechanism

We use a **Stable Shared Identifier** (`userId`, the Clerk JWT's `subject` claim) rather
than an internal Convex table's `_id` to link identity to application data. This is what
let the auth provider be swapped (Better Auth → Clerk) without touching any business
logic that references `userId`.

### Schema Definition

#### Identity (Managed by Clerk, external — no Convex table)

Clerk stores credentials, sessions, and OAuth linkage entirely outside Convex. The only
identity data AgriBid ever sees is the verified JWT claims returned by
`ctx.auth.getUserIdentity()`:

- `subject`: `string` (**The Link Key** — becomes `profiles.userId`)
- `email`: `string | undefined`
- `name`: `string | undefined`
- `pictureUrl`: `string | undefined`

See `convex/lib/auth.ts`'s `AuthUser` type and `getAuthUser()` for the exact mapping.

#### Profile (Managed by AgriBid)

Table: `profiles`

- `_id`: Convex ID
- `userId`: `string` (**The Foreign Key** — the Clerk subject) - Unique Index.
- `name`: `optional(string)` — cached copy of the Clerk identity's `name` claim, synced
  on every login. Display data only; Clerk remains the source of truth.
- `email`: `optional(string)` — cached copy of the Clerk identity's `email` claim, same
  sync behavior as `name`.
- `role`: `union("buyer", "seller", "admin")`
- `isVerified`: `boolean`
- `kycStatus`: `optional(union("pending", "verified", "rejected"))`
- `kycDocuments`: `optional(array(id("_storage")))`
- `kycRejectionReason`: `optional(string)`
- `firstName`: `optional(string)` (Encrypted PII)
- `lastName`: `optional(string)` (Encrypted PII)
- `idNumber`: `optional(string)` (Encrypted PII)
- `kycEmail`: `optional(string)` (Encrypted PII)
- `bio`: `optional(string)`
- `phoneNumber`: `optional(string)` (Encrypted PII)
- `companyName`: `optional(string)`
- `location`: `optional(string)`
- `createdAt`: `number` (Timestamp)
- `updatedAt`: `number` (Timestamp)

_Note: This schema reflects the canonical implementation in `convex/schema.ts`._

## 3. Relationship Map

| Source Entity | Relation  | Target Entity | Key Used                        |
| ------------- | --------- | ------------- | ------------------------------- |
| `auctions`    | Many -> 1 | `profiles`    | `sellerId` -> `profiles.userId` |
| `bids`        | Many -> 1 | `profiles`    | `bidderId` -> `profiles.userId` |
| `watchlist`   | Many -> 1 | `profiles`    | `userId` -> `profiles.userId`   |

## 4. Operational Flow: Just-In-Time Linking

To ensure a seamless user experience, we implement a **Link Sync** logic:

1. **Detection**: When a user's Clerk identity changes (first sign-in, or the id
   changes), the frontend (`Layout.tsx`) calls the `syncUser` mutation.
2. **Provisioning**:
   - If a `profiles` record exists for the `userId` (the Clerk subject), patch
     `name`/`email` from the current Clerk identity if present (see §5 on missing
     claims) and return success.
   - If not, create a new `profiles` record with default values (`role: "buyer"`,
     `isVerified: false`) plus `name`/`email` from the Clerk identity.
3. **Hydration**: Application queries read `name`/`email` directly off the `profiles`
   document — there is no second lookup against an external identity store on the read
   path.

## 5. Handling Missing Identity Claims

`syncUserHandler` only writes `name`/`email` into the profile when the corresponding
Clerk claim is present in that request's JWT. A transient missing claim (e.g. an
identity-token gap) does **not** overwrite a previously-stored value with `undefined` —
the existing stored value is left untouched until a sync provides a real value.

## 6. Implementation Benefits

- **Scalability**: Application-specific fields (like `rating` or `preferences`) don't
  clutter the identity provider.
- **Security**: Access control can be strictly enforced on the `profiles` table without
  any risk of accidentally modifying credentials — AgriBid's database never contains a
  password in the first place.
- **Interoperability**: This design already survived one auth provider migration
  (Better Auth → Clerk) with zero changes to business logic referencing `userId` — only
  the identity-claim mapping in `convex/lib/auth.ts` and the sync logic in
  `syncUserHandler` needed to change.
