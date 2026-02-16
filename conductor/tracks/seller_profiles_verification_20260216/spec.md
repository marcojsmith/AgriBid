# Specification: Seller Profiles & Verification

## 1. Requirements

### 1.1 Public Profiles
- Each user has a public profile page: `/profile/:userId`.
- Displays: Name, Member Since (Joined Date), Verification Status, and Items Sold count.
- Lists all `active` and `sold` auctions for that seller.

### 1.2 Reputation Metrics
- The `SellerInfo` component on the Auction Detail page should display the seller's "Items Sold" count.
- Add a "Verified Seller" badge (Gold/Green) for users with `isVerified: true`.

### 1.3 Auth Type Safety (Minor Task Integration)
- Augment the `Session` and `User` types to include `role` and `isVerified`.
- Remove manual type assertions (`as any` or `User & { role: string }`) in `Header.tsx` and `RoleProtectedRoute.tsx`.

## 2. Acceptance Criteria
- [ ] Navigating to `/profile/:userId` shows the seller's details and listings.
- [ ] Auction Detail page shows "Member since [Year]" and "[X] Items Sold".
- [ ] "Verified" badge appears next to the seller's name if applicable.
- [ ] TypeScript build passes without manual auth type assertions.
