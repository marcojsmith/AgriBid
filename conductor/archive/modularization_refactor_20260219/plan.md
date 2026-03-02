# Plan: Comprehensive Codebase Modularization & Refactor

## Phase 1: AdminDashboard.tsx Refactor
- [x] Create `app/src/pages/admin/` and `app/src/components/admin/`
- [x] Extract helper components to `app/src/components/admin/`
- [x] Extract `normalizeAuctionImages` to `app/src/lib/auction-utils.ts`
- [x] Extract Tab contents to separate components in `app/src/pages/admin/tabs/`
- [x] Refactor `AdminDashboard.tsx` to use extracted components
- [x] Verify functionality

## Phase 2: KYC.tsx Refactor
- [x] Create `app/src/pages/kyc/hooks/useKYCForm.ts` and `app/src/pages/kyc/hooks/useKYCFileUpload.ts`
- [x] Extract `ListItem` to `app/src/components/kyc/ListItem.tsx`
- [x] Extract sections to `app/src/pages/kyc/sections/`
- [x] Refactor `KYC.tsx`
- [x] Verify functionality

## Phase 3: Header.tsx Refactor
- [x] Extract `MobileMenu` to `app/src/components/header/MobileMenu.tsx`
- [x] Extract `UserDropdown` to `app/src/components/header/UserDropdown.tsx`
- [x] Extract `SearchBar` to `app/src/components/header/SearchBar.tsx`
- [x] Refactor `Header.tsx`
- [x] Verify functionality

## Phase 4: AuctionCard.tsx & BiddingPanel.tsx Refactor
- [x] Extract `AuctionCardThumbnail`, `AuctionCardPrice` from `AuctionCard.tsx`
- [x] Extract `BidForm`, `BidHistory` from `BiddingPanel.tsx` (moved to `app/src/components/bidding/`)
- [x] Refactor both components
- [x] Verify functionality

## Phase 5: Infrastructure & Documentation
- [x] Setup `app/src/hooks/index.ts` and `useFileUpload` hook
- [x] Update `conductor/code_styleguides/typescript.md` with size guidelines
- [x] Update `conductor/code_styleguides/react.md` (created)
