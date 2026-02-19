# User Linking Database Design: Identity vs. Profile

This document defines the architecture for linking the **Authentication Component** (Better Auth) and the **Application Component** (AgriBid) within the database.

## 1. Design Philosophy: The "Identity Bridge"

To maintain a clean separation of concerns, we distinguish between **Identity** (Security, Credentials, Sessions) and **Profile** (Business Metadata, Roles, Application State).

### Component Roles

- **Auth Component**: Owns the lifecycle of `user`, `account`, and `session` tables. It treats these as "Identity" stores.
- **App Component**: Owns the `profiles` table and business entities like `auctions` and `bids`. It consumes the identity to provide context.

## 2. Linking Mechanism

We use a **Stable Shared Identifier** (`userId`) rather than internal database IDs (`_id`) to link these components. This allows the Authentication provider to be swapped or updated without breaking business logic references.

### Schema Definition

#### Identity (Managed by Better Auth)

Table: `user`
- `_id`: Convex ID
- `userId`: `string` (**The Link Key**) - Indexed.
- `email`: `string`
- `image`: `string` (Avatar)

#### Profile (Managed by AgriBid)

Table: `profiles`
- `_id`: Convex ID
- `userId`: `string` (**The Foreign Key**) - Unique Index.
- `role`: `string` (e.g., "buyer", "seller", "admin")
- `isVerified`: `boolean`
- `bio`: `string`

## 3. Relationship Map

| Source Entity | Relation | Target Entity | Key Used |
|---------------|----------|---------------|----------|
| `auctions` | Many -> 1 | `profiles` | `sellerId` -> `profiles.userId` |
| `bids` | Many -> 1 | `profiles` | `bidderId` -> `profiles.userId` |
| `watchlist` | Many -> 1 | `profiles` | `userId` -> `profiles.userId` |

## 4. Operational Flow: Just-In-Time Linking

To ensure a seamless user experience, we implement a **Link Sync** logic:

1. **Detection**: When a user logs in, the frontend calls a `syncUser` mutation.
2. **Provisioning**:
   - If a `profiles` record exists for the `userId`, return success.
   - If not, create a new `profiles` record with default values (e.g., `role: "buyer"`).
3. **Hydration**: Application queries join the `user` and `profiles` data using the `userId`.

## 5. Implementation Benefits

- **Scalability**: Application-specific fields (like `rating` or `preferences`) don't clutter the core auth table.
- **Security**: Access control can be strictly enforced on the `profiles` table without risking accidental modification of core auth fields.
- **Interoperability**: If we migrate from Better Auth to another provider, we only need to update the `user` table sync logic; all business logic references to `userId` remain valid.
