# Project Tracks

This file tracks all major tracks for the project. Each track has its own detailed plan in its respective folder.

---

## Active Tracks

- [ ] **Track: deploy to vercel**
*Link: [./tracks/vercel_deploy_20260213/](./tracks/vercel_deploy_20260213/)*

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

## Tracks to be created
The following tracks are planned but not yet created. They will be added to the active or archive sections once they are initiated.

- [ ] **Extract duplicate setup steps to reduce duplication**
In @app/src/components/__tests__/ListingWizard.test.tsx around lines 72 - 106, Tests duplicate the setup steps to reach Step 4 in the ListingWizard test; extract that sequence into a helper to reduce duplication. Create a helper function (e.g., navigateToStep4) inside the describe block and move the repeated fireEvent/change/click steps that interact with the ListingWizard component (labels: Manufacturing Year, Location, Listing Title; clicks: Next Step, 'John Deere', '6155R', clicking all 'Yes' buttons) into it, then call navigateToStep4() from the 'validates required image slots' test (and any other tests that need the same setup) so the test body only asserts Media Gallery behavior.

- [ ] **Refactor global.fetch mock in tests to avoid pollution**
In @app/src/components/__tests__/ListingWizard.test.tsx around lines 21 - 24, The test currently sets a persistent global.fetch mock (global.fetch = vi.fn()...) which can pollute other tests; update ListingWizard.test.tsx to install the mock in a beforeEach (e.g., assign global.fetch = vi.fn().mockResolvedValue(...)) and remove/restore it in an afterEach by calling vi.resetAllMocks() or reassigning global.fetch back to the original savedFetch reference so other tests are not affected.

- [ ] **Clarify userId index documentation in Brief.md**
In @Brief.md around lines 292 - 298, The docs show an index "by_userId" on a field that in schema.ts is defined as userId: v.optional(v.union(v.null(), v.string())), which makes the index exclude records where userId is undefined or null; update the documentation snippet around defineTable and index("by_userId", ["userId"]) to either (a) reflect that userId is optional/null and note that queries against by_userId will not return records with undefined/null userId, or (b) change the example schema to make userId required/non-null if you intend the index to cover all user records (i.e., remove v.optional/v.null and use v.string()), and ensure any ingest code populates userId accordingly.

- [ ] **Update App.tsx JSDoc to include new /admin route**
In @app/src/App.tsx around lines 9 - 18, The JSDoc above the App component's router is missing the newly added "/admin" route; update the comment block that documents routes (the block referencing BrowserRouter/Routes in App or the file-level JSDoc) to include a line for "/admin → Admin" so the list now documents "/", "/auction/:id", "/sell", and "/admin" and briefly mention the Admin component as the handler.

- [ ] **Add test for Admin link visibility in Header for admin users**
In @app/src/components/__tests__/Header.test.tsx around lines 58 - 69, Add a test in Header.test.tsx that mocks authClient.useSession to return a user with role: "admin" (similar to existing tests that use renderHeader and vi.mocked(authClient.useSession)), then renderHeader(), open the mobile menu if needed (use the same Toggle menu interaction as in the existing test) and assert that the "Admin" navigation/link is present (e.g., expect(screen.getByText(/Admin/i)).toBeInTheDocument() or use getByRole('link', { name: /admin/i })). Ensure the new test mirrors the structure of the existing "renders user name and sign out button..." test and uses the same helpers (renderHeader, authClient.useSession mock) so it runs consistently.

- [ ] **Refactor ListingWizard image cleanup effect to separate concerns and avoid unnecessary re-subscriptions**
In @app/src/components/ListingWizard.tsx around lines 128 - 148, The current useEffect in ListingWizard.tsx mixes cleanup for imagesRef.current and the previews state and re-subscribes whenever previews changes; separate concerns by creating a previewsRef (mirror previews into previewsRef.current whenever you call setPreviews or in a small effect) and then split the effect into: (1) an unmount-only cleanup useEffect with empty deps that revokes blob URLs from imagesRef.current and previewsRef.current, and (2) if you need to revoke previews on every update, use a dedicated effect that compares previous and current previews (or revokes only the outgoing URLs) rather than keeping the original effect dependent on previews. Update references to use previewsRef.current and imagesRef.current inside the unmount cleanup so the cleanup effect can safely use [] as dependencies.

- [ ] **Clarify intent of legacy URL check in ListingWizard preview URL fallback**
In @app/src/components/ListingWizard.tsx around lines 429 - 430, The preview URL fallback uses storageId?.startsWith("http") to detect legacy image URLs but convex storage IDs are opaque, so clarify intent: in ListingWizard.tsx at the previewUrl computation (references: storageId, previews, slot.id, ListingFormData.images and "additional"), either add a concise comment explaining this is a backward-compatibility check for legacy HTTP(S) URLs or change the condition to explicitly check both "http://" and "https://" (or remove the branch if legacy URLs are impossible); update the code accordingly so the intent is explicit and future readers understand why storageId might be a URL.

- [ ] **Determine which code files need to be refactored to use the new Convex File Storage API and plan the refactor**

- [ ] **Determine which code files need to be refactored where they exceed 300 lines and plan the refactor**

- [ ] **Update the images schema in auctions.ts to make 'additional' optional**
In @app/convex/auctions.ts around lines 119 - 125, The images schema in auctions.ts is inconsistent: the images object currently declares additional as v.array(v.string()) (required) while elsewhere (and comments) treat it as optional; update the validator so additional is optional to match the schema and the comment—change the images object's additional declaration to v.optional(v.array(v.string())) (or, alternatively, make callers/mutation args always pass additional). Locate the images schema definition in auctions.ts and adjust the additional field in that object (and update any related code paths that assume || [] if you choose to require it).

- [ ] **Handle unused reason parameter in rejectAuction mutation**
In @app/convex/auctions.ts around lines 242 - 262, The mutation rejectAuction currently defines the args.reason parameter but never uses it; either remove reason from args or persist it for audit: if removing, delete reason from the args object in rejectAuction and any callers; if storing, update the auctions schema to include a rejectionReason (or lastActionReason) and modify the handler to pass args.reason into ctx.db.patch (e.g., include rejectionReason: args.reason and optionally rejectionBy: identity.id and rejectionAt: Date.now()) so the reason is saved alongside the status change; update any tests and consumers accordingly.

- [ ] **Improve RoleProtectedRoute UX by separating unauthenticated and unauthorized cases**
In @app/src/components/RoleProtectedRoute.tsx around lines 23 - 25, The current RoleProtectedRoute component silently redirects both unauthenticated users and users with the wrong role to "/", which causes confusing UX; update RoleProtectedRoute to check session first and redirect unauthenticated users to the login route (e.g., <Navigate to="/login" replace />), and handle insufficient-permission cases by rendering an explicit Unauthorized UI (a message, toast trigger, or a dedicated <Unauthorized /> component) instead of redirecting to "/", using the existing session, user?.role and allowedRole checks to decide which path to take.

- [ ] **Remove redundant auth checks from AdminDashboard or add comments if intentional**
In @app/src/pages/AdminDashboard.tsx around lines 61 - 79, The AdminDashboard component contains a redundant authorization block that checks isPending and user?.role !== "admin" even though RoleProtectedRoute already handles loading and role verification; remove the duplicate check (the entire conditional branches referencing isPending and user?.role) from AdminDashboard to avoid duplication, or if you want defense-in-depth keep them but add a clear comment above the checks mentioning RoleProtectedRoute handles auth and this is intentional redundancy; locate the logic inside the AdminDashboard component where isPending and user?.role are referenced to apply the change.

- [ ] **Refine button disabled logic in AdminDashboard to target only the processing auction**
In @app/src/pages/AdminDashboard.tsx around lines 177 - 190, The Approve/Reject buttons are currently disabled globally by using processingId !== null; change their disabled logic so only the auction being processed is disabled by using processingId === auction._id for both the Approve Button (the one rendering Loader2/Check) and the Reject Button (the one that calls handleReject). Alternatively, if you intended to block all interactions while any auction is processing, also apply the same processingId !== null check to the "Full Details" button—pick one approach and make the disabled expressions consistent across the related Buttons.

- [ ] **Simplify avgReviewTime calculation in AdminDashboard by removing unnecessary useMemo**
In @app/src/pages/AdminDashboard.tsx around lines 55 - 59, The avgReviewTime value is a hardcoded placeholder wrapped in a useMemo that depends on pendingAuctions but never uses it; replace the useMemo block (the const avgReviewTime = useMemo(...) that references pendingAuctions) with a simple constant assignment const avgReviewTime = "2.4h"; and keep the TODO comment (e.g., // TODO: Compute from real review data) so the code is simpler and avoids the unnecessary React hook and dependency.