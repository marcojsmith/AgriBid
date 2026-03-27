# Open GitHub Issues Checklist

Below are open github issues (with their #ids).
When creating a PR reference the github issue number in the PR description to automatically close it.

Prioritized by size and quick wins for efficient resolution.

## Quick Wins (Small, Self-Contained Fixes)

### Priority: High (Can be completed quickly with minimal risk) - RESOLVED

- [x] #140: Console warning: Form field missing id or name attribute
  - _Description_: Browser console shows warning about form field missing id or name attribute on auction detail pages
  - _Labels_: quick-win, frontend
- [x] #114: Images are not the same size in auction cards on compact view
  - _Description_: Auction card images have inconsistent sizing in compact view
  - _Labels_: quick-win, frontend
- [x] #112: Change the filters in the filter panel to drop-down
  - _Description_: Convert filter panel inputs to dropdown selections
  - _Labels_: quick-win, frontend
- [x] #110: Add a resize animation to auction cards
  - _Description_: Implement resize animation for auction cards
  - _Labels_: quick-win, frontend

## Small Improvements (Low to Moderate Effort)

### Priority: Medium-High

- [ ] #171: (Linting) Enhance ESLint with stricter rules
  - _Description_: Upgrade ESLint configuration to use stricter TypeScript rules. **Status (2026-03-19)**: Unresolved. Enabling `strictTypeChecked` and `stylisticTypeChecked` currently yields 1,463 problems (593 errors, 870 warnings).
  - _Labels_: None
- [x] #208: Migrate from tsc to tsgo for faster type-checking
  - _Description_: Replace tsc with tsgo for 4-7x faster type-checking in CI and pre-commit hooks
  - _Labels_: enhancement, infra
- [x] #168: (Code Quality) Extract magic numbers into named constants
  - _Description_: Replace hardcoded numbers with descriptive constants
  - _Labels_: enhancement
- [x] #167: (Refactor) Centralize all custom hooks in src/hooks/
  - _Description_: Move all custom hooks to a centralized hooks directory
  - _Labels_: enhancement
- [x] #157: For all pages where we need to fetch data, we need to load the UI components first/show a loading spinner/show skeleton components
  - _Description_: Implement consistent loading states for data-fetching pages
  - _Labels_: None
- [x] #149: Align Brief.md location features with implementation phases
  - _Description_: Update documentation to match current implementation phases
  - _Labels_: None
- [x] #75: Revise README.md for best practice
  - _Description_: Improve README.md with better documentation practices
  - _Labels_: documentation
- [x] #71: Integrate KYC pending count in User Base summary card
  - _Description_: Add KYC pending count to user base summary dashboard
  - _Labels_: None
- [ ] #118: Remember user settings
  - _Description_: Implement persistence for user preferences/settings
  - _Labels_: None

## Medium Complexity Issues

### Priority: Medium

- [x] #174: Increase Vitest coverage thresholds to best practice levels
  - _Description_: Raise test coverage requirements to industry standards
  - _Labels_: enhancement
- [x] #172: (Docs) Replace default app/README.md with project-specific content
  - _Description_: Replace placeholder README with AgriBid-specific documentation
  - _Labels_: documentation
- [x] #170: (Testing) Configure test coverage reporting
  - _Description_: Set up proper test coverage reporting tools
  - _Labels_: enhancement
- [x] #169: (Refactor) Consolidate duplicate context patterns
  - _Description_: Eliminate duplicate React context implementations
  - _Labels_: enhancement
- [x] #133: SEO Strategy for Auction Platform
  - _Description_: Implement SEO best practices for auction listings. Phase 1 (meta tags, structured data, technical foundation), Phase 2 (performance, semantic HTML, local SEO, breadcrumbs, analytics), and Phase 3 (FAQPage schema, public FAQ page, admin-editable FAQ, auction Event schema, start times) all complete.
  - _Labels_: enhancement
- [x] #59: Implement automatic error reporting and GitHub issue creation
  - _Description_: Auto-capture frontend errors, deduplicate via fingerprint, and create/comment on GitHub issues
  - _Labels_: enhancement
- [ ] #129: Add in AI chatbot support
  - _Description_: Integrate AI-powered chatbot for user assistance
  - _Labels_: enhancement

## Larger Refactor/Feature Issues

### Priority: Lower (Requires more planning and effort)

- [x] #211: Implement automatic error reporting and GitHub issue creation (admin controls)
  - _Description_: Admin dashboard controls for GitHub error reporting config, error report list, and manual processing trigger
  - _Labels_: enhancement
- [x] #199: (Refactor) Eliminate barrel index.ts files
  - _Description_: Remove barrel re-export files and update all consumer imports to use direct paths
  - _Labels_: enhancement, refactor
- [x] #9: Fix useEffect re-hydration guard in AdminErrorReportingSettings
  - _Description_: Prevent settings form from resetting while user is editing when live data updates arrive
  - _Labels_: bug, frontend
- [x] #163: (Refactor) Split oversized auctions/queries.ts file (729 lines)
  - _Description_: Break down large queries file into smaller, focused modules
  - _Labels_: enhancement, backend
- [x] #162: (Refactor) Split oversized auctions/mutations.ts file (1,182 lines)
  - _Description_: Break down large mutations file into smaller, focused modules
  - _Labels_: enhancement, backend
- [x] #151: Enabling HTTP/2+ Protocol
  - _Description_: Configure server to use HTTP/2 for better performance
  - _Labels_: None
- [x] #148: Resolve notification scope conflict in Listing Storage spec
  - _Description_: Fix conflicting notification requirements in storage specifications
  - _Labels_: bug, documentation
- [ ] #132: Admin page for managing business info
  - _Description_: Create admin interface for business information management
  - _Labels_: enhancement, backend
- [ ] #131: Update profile page for users
  - _Description_: Enhance user profile page with additional features
  - _Labels_: enhancement, frontend
- [ ] #106: Missing functionality to configure platform fees on admin dashboard
  - _Description_: Add platform fee configuration to admin controls
  - _Labels_: enhancement, backend
- [ ] #105: Missing functionality to manage equipment metadata on admin page
  - _Description_: Add equipment metadata management to admin interface
  - _Labels_: enhancement, backend
- [ ] #84: Create sufficient and best practice unit tests for the codebase
  - _Description_: Establish comprehensive unit testing practices
  - _Labels_: enhancement
- [x] #81: Admin.ts will limit auctions to 200 - potentially returning inaccurate financial stats
  - _Description_: Fix auction limit causing incorrect financial calculations (resolved via cursor-based pagination and counter initialization)
  - _Labels_: bug, backend
- [x] #74: Replace admin KPI for verified users to be online users
  - _Description_: Change verified users metric to online users metric in admin
  - _Labels_: enhancement, backend
- [x] #66: Performance: Batch readReceipts queries to avoid N+1 pattern
  - _Description_: Optimize database queries to prevent N+1 query problem (resolved via batchFetchReadCounts helper)
  - _Labels_: backend, performance

## How to Use This Checklist

1. Start with Quick Wins for immediate impact
2. Move to Small Improvements for steady progress
3. Tackle Medium Complexity issues during dedicated development time
4. Plan larger refactors/features for sprints or dedicated weeks
5. Update this checklist regularly as issues are resolved or new ones arise
