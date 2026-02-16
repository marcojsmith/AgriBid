# Plan: Seller Profiles & Verification

## Phase 1: Auth Type Safety & Refactoring
- [x] Define `UserWithRole` in `src/types/auth.ts`.
- [x] Update `RoleProtectedRoute.tsx` to use the shared type.
- [x] Update `Header.tsx` to use the shared type and fix the unbalanced layout bug (admin button placeholder).

## Phase 2: Backend Logic & Aggregates
- [x] Update `getUserProfile` query in `app/convex/auctions.ts` to return `itemsSold` count.
- [x] Implement `getPublicProfile` query to return user info + their active/sold listings.

## Phase 3: Profile UI
- [x] Create `app/src/pages/Profile.tsx`.
- [x] Update `SellerInfo.tsx` component to include reputation badges.
- [x] Link seller names in `AuctionDetail.tsx` and `AuctionCard.tsx` to their profile pages.
