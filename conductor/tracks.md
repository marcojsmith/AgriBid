# Project Tracks

This file tracks all major tracks for the project. Each track has its own detailed plan in its respective folder.

## Legend
- `[ ]` : Not Started
- `[~]` : In Progress
- `[x]` : Completed

---

## Active Tracks

- [x] **Track: deploy to vercel**
*Link: [./tracks/vercel_deploy_20260213/](./tracks/vercel_deploy_20260213/)*

- [~] **Track: Refactor ListingWizard for Modularity**
*Link: [./tracks/listing_wizard_refactor_20260216/](./tracks/listing_wizard_refactor_20260216/)*

---

## Archive

- [x] **Track: Listing Creation & Convex File Storage Integration**
*Link: [./tracks/listing_storage_20260215/](./tracks/listing_storage_20260215/)*

- [x] **Track: Global Navigation & Brand Layout**
*Link: [./tracks/global_nav_layout_20260213/](./tracks/global_nav_layout_20260213/)*

- [x] **Track: Auction Detail Page and Bid Submission Flow**
*Link: [./archive/auction_detail_20260213/](./archive/auction_detail_20260213/)*

- [x] **Track: Seller Listing Flow**
*Link: [./archive/seller_listing_flow_20260213/](./archive/seller_listing_flow_20260213/)*

---

## Completed minor tracks
The following items have been investigated and addressed as part of the appropriate track/branch.

### General

- [x] **Determine which code files need to be refactored where they exceed 300 lines and plan the refactor**
`app/src/components/ListingWizard.tsx` (990 lines) identified.

### Listing Creation & Convex File Storage Integration
- [x] **Extract duplicate setup steps to reduce duplication**
Completed in `ListingWizard.test.tsx`.

- [x] **Refactor global.fetch mock in tests to avoid pollution**
Completed in `ListingWizard.test.tsx`.

- [x] **Clarify userId index documentation in Brief.md**
Completed in `Brief.md`.

- [x] **Update App.tsx JSDoc to include new /admin route**
Completed in `App.tsx`.

- [x] **Add test for Admin link visibility in Header for admin users**
Completed in `Header.test.tsx`.

- [x] **Refactor ListingWizard image cleanup effect to separate concerns and avoid unnecessary re-subscriptions**
Completed in `ListingWizard.tsx`.

- [x] **Clarify intent of legacy URL check in ListingWizard preview URL fallback**
Completed in `ListingWizard.tsx`.

- [x] **Determine which code files need to be refactored to use the new Convex File Storage API and plan the refactor**
`auctions.ts` queries updated to resolve storage IDs; `ListingWizard.tsx` already uses it.

- [x] **Update the images schema in auctions.ts to make 'additional' optional**
Completed in `auctions.ts`.

- [x] **Handle unused reason parameter in rejectAuction mutation**
Completed in `auctions.ts` (removed unused parameter).

- [x] **Improve RoleProtectedRoute UX by separating unauthenticated and unauthorized cases**
Completed in `RoleProtectedRoute.tsx`.

- [x] **Remove redundant auth checks from AdminDashboard or add comments if intentional**
Completed in `AdminDashboard.tsx`.

- [x] **Refine button disabled logic in AdminDashboard to target only the processing auction**
Completed in `AdminDashboard.tsx`.

- [x] **Simplify avgReviewTime calculation in AdminDashboard by removing unnecessary useMemo**
Completed in `AdminDashboard.tsx`.

## Minor-tracks to be created
The following items are planned but not yet created.

- [ ] **Refactor RoleProtectedRoute to use proper type augmentation for session user roles instead of inline assertions**
In @app/src/components/RoleProtectedRoute.tsx around lines 12 - 14, The inline type assertion on session.user in RoleProtectedRoute is a workaround; instead augment the session/user types where your auth types are defined (e.g., NextAuth module augmentation) to include role?: string on the User (and Session.user if needed), update the global/next-auth type declarations so useSession() returns the correct typed user, then remove the assertion in RoleProtectedRoute (keeping the existing useSession call and user access) so the code is type-safe across the codebase.

- [ ] **Extract the duplicated type assertion for session user with role into a shared type and use it in both Header.tsx and RoleProtectedRoute.tsx**
In @app/src/components/Header.tsx at line 21, Extract the duplicated type assertion into a shared type (e.g., export type UserWithRole = NonNullable<Session['user']> & { role?: string }) in your auth utilities and replace the inline assertion in Header.tsx (the const user = session?.user ... line) and the one in RoleProtectedRoute.tsx to use this new UserWithRole type; update imports in both components to reference the shared type so the duplication is removed and both files use the same authoritative type.

- [ ] **Fix unbalanced layout in Header when admin button is absent by using a responsive grid or placeholder element**
In @app/src/components/Header.tsx around lines 232 - 245, The two-column grid ("grid grid-cols-2") can produce an unbalanced layout when the admin Button (rendered when user?.role === "admin") is absent; either switch to a responsive/conditional layout or add a placeholder to keep visual balance. Fix by updating the container to a responsive grid like "grid grid-cols-1 md:grid-cols-2" or, if you need two fixed columns, render a visually hidden placeholder element (e.g., an empty div with the same sizing/styling and aria-hidden="true") when user?.role !== "admin", keeping the existing Button, Link, and setIsMenuOpen usage intact (so Admin conditional remains unchanged but layout stays balanced).

- [ ] **Update Acceptance Criteria for Refactor ListingWizard Track**
In @conductor/tracks/listing_wizard_refactor_20260216/spec.md around lines 22 - 27, Update the acceptance criteria block to reflect that Phase 4 is complete by marking the remaining unchecked items as done: check the lines for "`ListingWizard.tsx` acts only as a thin orchestrator" and "All existing functionality (multi-step navigation, file uploads, validation, submission) remains identical" and "All current unit tests in `ListingWizard.test.tsx` pass without modification to the test logic" so all acceptance items are checked; ensure the ticked state matches `plan.md`'s Phase 4 completion and keep the same wording for clarity.

- [ ] **Add documentation for render-time state update in BidForm**
In @app/src/components/BidForm.tsx around lines 19 - 30, Add an inline comment above the block that updates prevNextMinBid and manualAmount explaining that this intentionally performs state updates during render to keep manualAmount in sync with nextMinBid (using nextMinBid, prevNextMinBid, setPrevNextMinBid, setManualAmount and manualAmount), clarifying the exact conditions when we overwrite manualAmount (only when user hasn’t manually entered a higher value) and why useEffect was not used; keep the comment short but explicit about assumptions and expected behavior so future maintainers understand the pattern and its safety.

- [ ] **Verify Admin link visibility in desktop navigation in Header.test.tsx**
In @app/src/components/__tests__/Header.test.tsx around lines 123 - 138, Add a complementary test in Header.test.tsx that verifies the Admin link appears in the desktop navigation (not just the mobile menu): mock authClient.useSession to return an admin user (same as current test), call the existing renderHeader() helper, do NOT click the mobile toggle, then assert that screen.getByRole('link', { name: /Admin/i }) (or a more specific selector within the desktop nav element) is present; reference the existing test utilities and helpers like renderHeader() and authClient.useSession to keep the setup consistent.

- [ ] **Remove unused Search import from TechnicalSpecsStep**
In @app/src/components/ListingWizard/steps/TechnicalSpecsStep.tsx at line 2, The import list in TechnicalSpecsStep.tsx includes an unused symbol "Search" from lucide-react; remove "Search" from the import statement (leaving Check) so the file only imports icons actually used by the component (look for the import line that currently reads something like import { Search, Check } from "lucide-react" and change it to import { Check } from "lucide-react").

- [ ] **Handle loading state for equipment metadata in TechnicalSpecsStep**
In @app/src/components/ListingWizard/steps/TechnicalSpecsStep.tsx around lines 9 - 13, The metadata fetch may be undefined during initial load, causing uniqueMakes/availableModels to render empty UI; in TechnicalSpecsStep, detect the loading state from useQuery(api.auctions.getEquipmentMetadata) (e.g., check an isLoading flag or metadata === undefined) and early-return or render a loading skeleton/spinner instead of the grid; update the logic around metadata, uniqueMakes, selectedMakeData, and availableModels so the component shows the loader while metadata is fetching and only computes the sets after data is available.

- [ ] **Prevent parseInt(e.target.value) || 0 from clobbering year input in GeneralInfoStep**
In @app/src/components/ListingWizard/steps/GeneralInfoStep.tsx around lines 23 - 31, The onChange handler in GeneralInfoStep currently uses parseInt(e.target.value) || 0 which replaces invalid/empty input with 0; change the logic in the Input's onChange (the handler that calls updateField("year", ...)) to parse the value with parseInt and only call updateField with the parsed number when it is a valid finite number, otherwise preserve the previous value (formData.year) or set an empty/nullable value so the user’s input isn’t clobbered; update references to the Input value binding (value={formData.year || ""}) and updateField usage to accept the nullable/unchanged case.

- [ ] **Add loading state to AdminDashboard while pending auctions are fetching**
In @app/src/pages/AdminDashboard.tsx around lines 16 - 20, The UI currently renders blank while pendingAuctions (from useQuery(api.auctions.getPendingAuctions)) is undefined; update the AdminDashboard component to show a loading state (spinner or skeleton) while the query is loading by checking the query's loading flag or undefined data (e.g., pendingAuctions.data === undefined or pendingAuctions.isLoading) and render a centered spinner/skeleton between the header and list instead of empty space; ensure the same UI branches used for approveAuction/rejectAuction remain unchanged and clear the loading view once pendingAuctions resolves.

- [ ] **Prevent concurrent mutations in AdminDashboard by using !!processingId**
In @app/src/pages/AdminDashboard.tsx around lines 148 - 164, The current logic only disables the action button for the auction whose id equals processingId, allowing concurrent actions across auctions; to prevent any concurrent mutations change the Buttons' disabled prop to disabled={!!processingId} (keep the existing loader conditional rendering using processingId === auction._id so only the active auction shows the spinner) and ensure any state setter uses null/string semantics for processingId; alternatively, if per-auction processing was intentional, rename the variable to processingAuctionId across the component and related handlers (handleApprove, handleReject) for clarity.

- [ ]
In @app/src/components/ListingWizard/steps/PricingDurationStep.tsx around lines 18 - 24, The number <Input> fields for startingPrice (and the other price/duration numeric input used later) currently allow negative values; add min="0" to those <Input> components to enforce non-negative browser-level validation and prevent negative values from being submitted, while keeping the existing onChange handler (updateField("startingPrice", parseInt(...))). Locate the <Input> with value={formData.startingPrice} and the corresponding numeric <Input> later in the file and add the min="0" attribute to each.

- [ ]
In @app/src/components/ListingWizard/steps/PricingDurationStep.tsx around lines 31 - 46, The reserve price input in PricingDurationStep.tsx lacks validation to ensure formData.reservePrice is >= the starting price; update the component to validate reserve vs starting price (compare formData.reservePrice to formData.startingPrice) whenever updateField("reservePrice", ...) runs, and surface a UI warning or form error message (e.g., a small red text under the input) and/or set a field error state that prevents proceeding if reservePrice < startingPrice; use the existing updateField handler and formData keys (reservePrice, startingPrice) and ensure the validation also runs on form submit/central validation so the constraint is enforced both interactively and on save.

- [ ]
In @app/src/components/ListingWizard/steps/MediaGalleryStep.tsx around lines 54 - 61, The hidden file input lacks an accessible name for screen readers; update the input in MediaGalleryStep to include an aria-label (or aria-labelledby) that uniquely identifies the slot (e.g., use slot.id or slot index) so screen readers know what the control does; specifically, add an attribute like aria-label={`Upload image for slot ${slot.id}`} to the <input> used with handleImageUpload and ensure it still respects the existing disabled={!!uploadingSlot} behavior.

- [ ]
In @app/src/components/ListingWizard/steps/ReviewSubmitStep.tsx at line 49, The price rendering uses toLocaleString() without a locale; update the formatting calls (e.g., the occurrences that call formData.startingPrice.toLocaleString() and the similar call on line 53) to specify a South African locale (e.g., 'en-ZA') or use Intl.NumberFormat('en-ZA', {style: 'currency' or minimumFractionDigits as needed}) so prices render consistently across browsers; locate these calls in ReviewSubmitStep (the JSX that renders R {formData.startingPrice.toLocaleString()}) and replace them with the locale-aware formatting.

- [ ]
In @app/src/components/ListingWizard/WizardNavigation.tsx around lines 36 - 44, The Next Step button should mirror the Submit button's validation behavior by checking getStepError(currentStep) and disabling the button (and applying the same disabled styles) when an error exists; update the Button that calls next() in WizardNavigation.tsx to compute a stepError (using getStepError(currentStep)) and pass a disabled prop (and matching disabled classes) so the button is not clickable when there is a validation error, keeping next() as a fallback for internal validation and toast messaging.

- [ ]
In @app/convex/seed.ts around lines 33 - 38, The current clear branch iterates and deletes each record sequentially (args.clear with ctx.db.query("auctions") / ctx.db.query("bids") and ctx.db.delete in a for loop) which is slow for large datasets; replace the per-item loop with a batched or parallel deletion strategy such as using a bulk delete API if available (e.g., ctx.db.deleteMany) or run ctx.db.delete calls in parallel using Promise.all on fixed-size chunks (chunking helps avoid too-large concurrent requests), and apply the same change for both auctions and bids and add a short comment documenting expected data volume for dev/preview usage.

- [ ]
In @app/convex/seed.ts around lines 244 - 256, Extract the duplicated security check used in clearAuctions and runSeed into a shared async helper (e.g., checkDestructiveAccess) that accepts the same context type (MutationCtx), performs the NODE_ENV/VERCEL_ENV/admin-role checks, and throws the existing Unauthorized error when not allowed; then replace the inline guard in clearAuctions and runSeed with a single await checkDestructiveAccess(ctx) call to remove duplication and keep behavior identical.

- [ ]
In @app/src/components/__tests__/ListingWizard.test.tsx around lines 12 - 18, The test mock for useMutation currently depends on Convex's internal _path format and exact strings ('auctions:generateUploadUrl' / 'auctions/generateUploadUrl'); change the matcher in the useMutation mock (the apiFunc/_path check) to be resilient by extracting the function name and doing a flexible match (e.g., check if typeof apiFunc === 'string' ? apiFunc.includes('generateUploadUrl') : apiFunc?._path?.includes('generateUploadUrl') or use a RegExp/endsWith) so the mock returns the upload URL for any _path variant; update references inside the useMutation mock and keep other branches returning {}.