# Open GitHub Issues Checklist

Below are open github issues (with their #ids).
When creating a PR reference the github issue number in the PR description to automatically close it.

Prioritized by size and quick wins for efficient resolution.

## Quick Wins (Small, Self-Contained Fixes)

### Priority: High

- [x] #214: bug: isWatched hardcoded to false in related auctions section of AuctionDetail
  - _Description_: Related auction cards always show unwatched state regardless of user's watchlist
  - _Labels_: bug
- [x] #215: feat: Add startTime bounds validation for non-draft auction mutations
  - _Description_: Validate startTime is not in the past and not more than 1 year in the future
  - _Labels_: enhancement
- [x] #213: chore: Add missing @param descriptions for args.startTime in createAuction/saveDraft JSDoc
  - _Description_: Add meaningful descriptions to @param args.startTime entries in createAuctionHandler and saveDraftHandler JSDoc
  - _Labels_: None
- [ ] #217: feat: Add og-image.png to public directory for SEO social previews
  - _Description_: Create 1200x630px Open Graph image at public/og-image.png for social media preview cards
  - _Labels_: None

## Small Improvements (Low to Moderate Effort)

### Priority: Medium-High

- [ ] #171: (Linting) Enhance ESLint with stricter rules
  - _Description_: Upgrade ESLint configuration to use stricter TypeScript rules. **Status (2026-03-19)**: Unresolved. Enabling `strictTypeChecked` and `stylisticTypeChecked` currently yields 1,463 problems (593 errors, 870 warnings).
  - _Labels_: None
- [ ] #118: Remember user settings
  - _Description_: Implement persistence for user preferences/settings
  - _Labels_: None
- [ ] #218: [Backend] Add location field to profiles table
  - _Description_: Add optional location field to profiles table for seller profile page display
  - _Labels_: backend
- [ ] #219: [Backend] Add granular verification status fields
  - _Description_: Add emailVerified, phoneVerified, bankingVerified, taxNumberVerified fields to profiles table
  - _Labels_: backend
- [ ] #230: make the application more generic
  - _Description_: Allow admin to configure application name and other branding settings
  - _Labels_: None

## Medium Complexity Issues

### Priority: Medium

- [ ] #129: Add in AI chatbot support
  - _Description_: Integrate AI-powered chatbot for user assistance
  - _Labels_: enhancement
- [ ] #216: feat: Admin page to manage organisation business details for SEO structured data
  - _Description_: Replace placeholder JSON-LD structured data with admin-managed business details (name, address, contact)
  - _Labels_: None
- [ ] #236: Add automated screenshot capture system for all app screens
  - _Description_: Playwright-based screenshot automation at 3 viewports (mobile, tablet, desktop) with cookie-based auth for protected routes
  - _Labels_: enhancement

## Larger Refactor/Feature Issues

### Priority: Lower (Requires more planning and effort)

- [ ] #132: Admin page for managing business info
  - _Description_: Create admin interface for business information management
  - _Labels_: enhancement, backend
- [ ] #131: Update profile page for users
  - _Description_: Enhance user profile page with additional features
  - _Labels_: enhancement, frontend
- [ ] #233: [Backend] Add seller-filtered auction listing page
  - _Description_: Create /sellers/:userId/listings route with status filtering (active/sold) and wire up "View all" links on profile page
  - _Labels_: enhancement, backend
- [ ] #232: [Backend] Add report profile functionality
  - _Description_: Add profileFlags table, reportProfile mutation, and admin moderation integration for profile reporting
  - _Labels_: enhancement, backend
- [ ] #231: [Backend] Create seller messaging/contact system
  - _Description_: Add conversations/messages tables, startConversation/sendMessage mutations, and Messages inbox page
  - _Labels_: enhancement, backend
- [ ] #221: [Backend] Create seller review/rating system
  - _Description_: Add reviews table, submitReview mutation, aggregated rating display on profile page
  - _Labels_: enhancement, backend
- [ ] #220: [Backend] Create user activity feed system
  - _Description_: Add userActivity table, logActivity mutation, instrument existing mutations, replace hardcoded activity on profile page
  - _Labels_: enhancement, backend

## How to Use This Checklist

1. Start with Quick Wins for immediate impact
2. Move to Small Improvements for steady progress
3. Tackle Medium Complexity issues during dedicated development time
4. Plan larger refactors/features for sprints or dedicated weeks
5. Update this checklist regularly as issues are resolved or new ones arise
