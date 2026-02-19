Fix the following issues. The issues can be from different files or can overlap on same lines in one file.

- Verify each finding against the current code and only fix it if needed.

In @app/.gitignore around lines 1 - 2, Remove the leading blank line in the .gitignore and keep the ".env.local" entry as-is; optionally add additional environment patterns if your workflow uses them (e.g., ".env", ".env.*.local") by appending them to .gitignore so all local secret files are ignored.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/admin.ts around lines 283 - 295, The getAuditLogs handler currently passes args.limit directly to take(), leaving an unbounded limit like getRecentBids; clamp the requested limit before calling ctx.db.query("auditLogs").withIndex("by_timestamp").order("desc").take(...). Introduce a MAX_AUDIT_LOG_LIMIT constant (e.g., 100), compute const limit = Math.min(args.limit || 50, MAX_AUDIT_LOG_LIMIT), and use that limit in take(limit) to ensure a safe, consistent upper bound.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/admin_debug.ts around lines 10 - 15, The current admin promotion check uses process.env.ALLOW_DEV_ADMIN_PROMOTION alone which allows bypass in production; change the allowDevPromotion logic in admin_debug.ts so it requires NODE_ENV !== "production" AND ALLOW_DEV_ADMIN_PROMOTION === "true" (i.e., guard allowDevPromotion with NODE_ENV), keep the existing callerRole check using getCallerRole(ctx), and add a startup-time validation that throws/fails fast if NODE_ENV === "production" but ALLOW_DEV_ADMIN_PROMOTION is set to "true"; also update any documentation/comments to mark this flag as a dev-only feature.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/auctions.ts around lines 651 - 662, The audit payload is duplicating the full auction ID list; update the logAudit call in BULK_UPDATE_AUCTIONS to remove details.fullAuctionIds and only include count, updates (Object.keys(args.updates)), and a preview (args.auctionIds.slice(0,3)); keep targetId as the existing comma-separated string if you need a searchable identifier but do not store the full array twice in details.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/auctions.ts around lines 531 - 548, getAllAuctions currently calls ctx.db.query("auctions").collect() which loads all rows into memory; change the handler to accept pagination args (e.g., limit and cursor/page) with safe defaults and a max cap, then replace .collect() with a bounded query (e.g., .take(limit) / use cursor-based query) to fetch only that page, preserve the admin role check, and call resolveImageUrls only on the fetched slice before returning; ensure you return pagination metadata (nextCursor/hasMore) or use offset/limit semantics so callers can page through results.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/auctions.ts around lines 265 - 284, deleteUpload currently allows any authenticated user to remove any storageId; fix by enforcing ownership: fetch the current user via ctx.auth.getUserIdentity() (already used), then look up the stored upload record (e.g., query the uploads/attachments record by storageId using your Convex query functions) and verify the record.userId matches identity.userId before calling ctx.storage.delete; if no record or mismatched owner, throw an authorization error or return; alternatively, if intended, restrict deletion to admin users by checking identity.role/isAdmin instead of owner comparison. Ensure checks are added before the existing ctx.storage.delete call and before returning for non-existent storage.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/notifications.ts around lines 26 - 32, The readReceipts query uses .collect() which returns all receipts for a user and can grow unbounded; replace this with a bounded query by either (A) limiting by time (e.g., add a createdAt filter) or a .limit to restrict results, or (B) only request receipts for the specific notifications you care about by querying readReceipts with the by_user_notification index and an additional filter on notificationId (e.g., an .in or equivalent) using the set of notification IDs you fetched for the 20 personal + 10 announcements; update the code around ctx.db.query("readReceipts").withIndex("by_user_notification", (q) => q.eq("userId", userId)).collect() and the creation of readNotificationIds accordingly so it only iterates over a bounded result set.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/notifications.ts around lines 139 - 176, The markAllRead mutation uses Promise.all over unreadPersonal and announcements which can create unbounded concurrent mutations; instead, process these updates in bounded batches: chunk unreadPersonal and announcements into fixed-size batches (e.g., 25-50), then for each chunk await a Promise.all of ctx.db.patch calls for unreadPersonal or ctx.db.insert calls for readReceipts, iterating chunks sequentially (or use a simple concurrency limiter) so updates to ctx.db.patch and ctx.db.insert are batched and do not run all at once; use the existing variables unreadPersonal, announcements, existingReceipts and the markAllRead function to locate where to implement the batching.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/schema.ts around lines 93 - 118, The profiles table's "by_userId" index doesn't enforce uniqueness, so update the profile creation flow to enforce one profile per user: before inserting, query the profiles table using the "by_userId" index for an existing record (lookup via profiles index "by_userId") and either abort/return an error or perform an upsert/update instead of a blind insert; adjust the mutation/endpoint that creates profiles (the create/profile insertion logic) to use this check-then-insert or atomic upsert pattern so duplicate profiles for the same userId cannot be created.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/schema.ts around lines 152 - 171, Add an index on the transactions table for the status field so queries like fetching all pending or failed transactions are efficient: update the transactions defineTable block (symbol: transactions) to include .index("by_status", ["status"]) alongside the existing .index("by_auction"), .index("by_seller"), and .index("by_buyer") calls.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/seed.ts around lines 110 - 119, The deletion loop for the auth model uses a hardcoded pagination size (numItems: 100) which is inconsistent with the rest of the seeding logic that uses BATCH_SIZE; update the call to ctx.runMutation for components.auth.adapter.deleteMany to use the shared BATCH_SIZE constant (paginationOpts: { cursor, numItems: BATCH_SIZE }) and ensure the BATCH_SIZE symbol is imported/available in this module so the deletion batch size matches the rest of the seed logic (refer to ctx.runMutation, components.auth.adapter.deleteMany, and DeleteManyResult).

- Verify each finding against the current code and only fix it if needed.

In @app/convex/users.ts around lines 314 - 320, Update the mutation/query argument schema that defines args.documents in app/convex/users.ts to use Convex's id validator (v.id("_storage")) instead of v.string() — i.e., change the validator from v.array(v.string()) to v.array(v.id("_storage"))) — and then remove the unsafe cast to Id<"_storage"> in the storage-validation loop (or remove the loop entirely if Convex validation is trusted); ensure any remaining checks use the documents values as already-validated storage IDs (no type assertions) when calling ctx.storage.getUrl.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/Header.tsx around lines 148 - 149, In the Header component's JSX div that currently has className "flex flex-col items-end hidden sm:flex", remove the redundant leading "flex" token so the className becomes "flex-col items-end hidden sm:flex" (keeping "flex-col" and "hidden sm:flex" intact) to avoid duplicating display declarations while preserving layout behavior at the sm breakpoint.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/Layout.tsx around lines 19 - 25, The effect in useEffect is over-triggering because syncUser (the mutation function) can change identity; update the effect to depend only on userId and call the current syncUser — either remove syncUser from the dependency array so it becomes useEffect(..., [userId]) or stabilize the call by storing syncUser in a ref (const syncUserRef = useRef(syncUser); syncUserRef.current = syncUser) and call syncUserRef.current() inside the effect; target the useEffect block that currently references userId and syncUser to implement one of these fixes.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/admin/AuditTab.tsx around lines 120 - 128, The "More" button logic can falsely remain enabled when exactly `limit` logs exist; update the log-fetching and UI to fetch `limit + 1` items (e.g., in the loader/fetch function used by AuditTab) then render only the first `limit` entries and derive a `hasMore` flag as (fetched.length > limit); wire the Button's disabled prop to !hasMore (instead of using logs.length < limit) and keep `onClick={() => setLimit(prev => prev + 50)}` or switch to increasing a page cursor — reference `AuditTab`, the `logs` array, `limit` state, `setLimit`, and the `More` Button when making these changes.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/admin/BidMonitor.tsx around lines 115 - 117, In BidMonitor.tsx where the TableCell renders the truncated bidder ID (currently using bid.bidderId.substring(0, 8)), add a title attribute on that TableCell (or its inner element) set to the full bidderId (bid.bidderId) so admins can see the entire ID on hover; ensure you handle the case where bid.bidderId may be undefined/null before using it.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/admin/FinanceTab.tsx at line 15, Remove the duplicated frontend COMMISSION_RATE constant and stop recalculating commission on the client; instead have the UI consume the backend-provided commission data from getFinancialStats (either a commissionRate field or use the backend-calculated estimatedCommission) and update FinanceTab.tsx to read that value for per-row display and totals; specifically remove references to COMMISSION_RATE and replace the per-row calculation at the location that computes commission (currently using COMMISSION_RATE on each row) with the backend-provided estimatedCommission or commissionRate from the getFinancialStats response.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/admin/SupportTab.tsx around lines 104 - 117, The current loading state uses a single string resolvingId in SupportTab.tsx so only one ticket shows a spinner; change resolvingId to a Set<string> (or Map) to track multiple in-flight resolves, update handleResolve(ticketId) to add the id to the Set before the async call and remove it in finally, and update the button disabled/conditional checks (resolvingId.has(ticket._id) instead of ===) and any state initialization/cleanup accordingly so multiple concurrent resolves display independent spinners.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/ui/label.tsx at line 4, The import uses the unified radix-ui package; change it to the scoped package for consistency by replacing the current import so the component continues to reference LabelPrimitive from the @radix-ui/react-label package (match the pattern used in dialog.tsx and dropdown-menu.tsx); update the import statement that defines LabelPrimitive so all usages in label.tsx continue to work unchanged.

- Verify each finding against the current code and only fix it if needed.

In @app/src/lib/notifications.tsx around lines 30 - 47, The JSDoc for handleNotificationClick incorrectly claims it rethrows errors from markReadFn; update the comment to match the implementation by removing or replacing the @throws line and documenting that errors from markReadFn are caught, logged via console.error, and swallowed (navigation still occurs if link is provided), so callers are not expected to receive exceptions from handleNotificationClick.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/AdminDashboard.tsx around lines 101 - 104, The current useQuery calls for allAuctions and allProfiles (allAuctions → api.auctions.getAllAuctions, allProfiles → api.users.listAllProfiles) load everything on mount; change these to paginated requests (e.g., pass page/limit or use cursor) and switch to a paginated hook such as useInfiniteQuery or a query with explicit page params, update the UI to request more pages (load more / infinite scroll) and adapt the backend resolver/endpoint to return paged results (items + nextCursor/total) so the front-end functions (allAuctions, allProfiles) only fetch one page at a time rather than the full dataset.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/AdminDashboard.tsx around lines 1227 - 1235, The auction.images type only models the object form but the schema also permits a legacy string[]; update the type for auction (in AdminDashboard) to allow images: { front?: string; engine?: string; cabin?: string; rear?: string; additional?: string[] } | string[] and add a small runtime normalizer (e.g., normalizeAuctionImages(images): {front?:string;engine?:string;cabin?:string;rear?:string;additional?:string[]}) that converts the legacy array into the object shape (map indexes or treat all entries as additional if ordering is unknown); then replace direct uses of auction.images.front/engine/etc. with the normalizer result (call normalizeAuctionImages(auction.images) in the code that reads images) so both formats are handled safely.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/KYC.tsx around lines 409 - 422, The Badge list uses files.map with key={f.name}, which can produce duplicate React keys if files share names; change the key to a unique identifier (e.g., use the file object’s unique property or compose one) by replacing key={f.name} in the files.map rendering with a stable unique value such as key={`${f.name}-${f.lastModified}`}, key={`${f.name}-${f.size}-${index}`}, or key={f.id} if available; update the map callback signature (files.map((f, index) => ...)) as needed and ensure the same identifier is used for any related list operations in this component (files, Badge, and the map callback).

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/KYC.tsx around lines 84 - 91, The current logic around setFiles leaves previous files in state when the user selects only invalid files (hasError=true and validFiles.length===0); update the handler around validFiles/hasError so that when validFiles has items you call setFiles(validFiles), and when the selection contains no valid files you explicitly clear state via setFiles([]) (or preserve with a clear comment if that was intended); keep the input-reset behavior (e.target.value = "") for error cases. Reference setFiles, validFiles, hasError and e.target.value when applying the change.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/Notifications.tsx around lines 93 - 110, The JSX uses a ternary chain to render the loading, empty, or list states for the notifications variable; refactor this by replacing the ternary chain around notifications (the block that renders Loader2 and Inbox) with an explicit early-return or a clear conditional block before the notifications.map so that: if notifications === undefined render the Loader2 "Syncing History..." UI, else if notifications.length === 0 render the Inbox "No notifications" UI, else fall through to render notifications.map(...). Update the component's render flow (around the notifications map usage) to remove the ternary chain and ensure only one conditional branch renders.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/Support.tsx around lines 115 - 159, Add client-side maxlength controls for the subject and message inputs: set a maxLength of 100 on the Input bound to subject and 2000 on the Textarea bound to message, and ensure the onChange handlers for subject (setSubject) and message (setMessage) guard/truncate input to those lengths so users get immediate feedback; update the JSX for the Input and Textarea components (the elements using value={subject} onChange={(e) => setSubject(...)} and value={message} onChange={(e) => setMessage(...)} respectively) to include the maxLength props and optional truncation logic.

- Verify each finding against the current code and only fix it if needed.

In @codebase_notes.md around lines 17 - 22, Remove the trailing whitespace at the end of the sentence "ensuring compatibility with the Convex runtime's OIDC validation." in the "OIDC Discovery Rewrite" section; edit that line to delete the extra space character after "paths" so the line ends cleanly with no trailing space.

- Verify each finding against the current code and only fix it if needed.

In @conductor/user_linking_design.md at line 46, The markdown line containing the heading "2. **Provisioning**:" has a trailing space at the end; remove the trailing whitespace so the line ends with the colon and no extra space to satisfy MD009 (e.g., edit the "2. **Provisioning**:" line in user_linking_design.md to delete the trailing space).

- Verify each finding against the current code and only fix it if needed.

In @conductor/user_linking_design.md around lines 9 - 10, Add a single blank line immediately after each markdown heading to satisfy MD022: insert a newline after the "### Component Roles" heading and likewise after the other headings in this document (the other section titles flagged by the linter). Ensure each heading is followed by one blank line before the next paragraph or list so all headings in conductor/user_linking_design.md conform to markdown lint rules.

- Verify each finding against the current code and only fix it if needed.

In @conductor/user_linking_design.md at line 23, Split the concatenated schema fields so `email` and `image` are on separate lines; replace the single line "`email`: `string`- `image`: `string` (Avatar)" with two distinct entries such as "`email`: `string`" on one line and "`image`: `string` (Avatar)" on the next, keeping the same markdown/code formatting for consistency with other fields.

- Verify each finding against the current code and only fix it if needed.

In @.husky/pre-commit at line 1, The pre-commit hook contains an invalid invocation "npm npx lint-staged" in .husky/pre-commit; fix it by removing the stray "npm" so npx is invoked directly (use npx lint-staged) or, if you want to run via npm, invoke it through npm exec (npm exec -- npx lint-staged) and keep the rest of the hook (&& npm run build) unchanged.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/config.ts around lines 38 - 41, Replace the hardcoded COMMISSION_RATE constant with a value read from environment variables and a safe default: use the existing getEnv helper (as used by ALLOWED_ORIGINS) to read "COMMISSION_RATE", parse it to a float, and fall back to 0.05 when missing or invalid; update the exported symbol COMMISSION_RATE accordingly and ensure any consuming code still imports COMMISSION_RATE unchanged.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/BidHistory.tsx at line 110, The currency formatting in the BidHistory component is inconsistent: replace the call to bid.amount.toLocaleString() with the same locale used elsewhere (e.g., toLocaleString("en-ZA")) so ZAR formatting matches AuctionCard; locate the expression inside the BidHistory component where R{bid.amount.toLocaleString()} is rendered and change it to use toLocaleString("en-ZA") (optionally include currency/number options if you want explicit formatting).

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/FilterSidebar.tsx at line 7, The filter UI drifts from the URL because the effect that syncs searchParams into localFilters was removed; restore a useEffect in FilterSidebar that listens to searchParams and calls setLocalFilters({...}) to populate make, minYear, maxYear, minPrice, maxPrice, and maxHours from searchParams (using searchParams.get(...) || ""), and add useEffect back to the import list so the component updates localFilters when the URL changes (e.g., browser back/forward or shared links).

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/ListingWizard/steps/ConditionChecklistStep.tsx around lines 51 - 53, The paragraph rendering item.desc in ConditionChecklistStep.tsx uses an overly small utility class "text-[10px]"; update the JSX in the ConditionChecklistStep component (the <p> that displays {item.desc}) to use a larger, accessible font size such as Tailwind's "text-xs" (12px) instead of "text-[10px]" to meet minimum readability guidelines while preserving the other classes ("text-muted-foreground font-medium uppercase").

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/ListingWizard/steps/ReviewSubmitStep.tsx at line 85, In the ReviewSubmitStep component remove the explicit space text node after the closing div (the `</div>{" "}` sequence) unless that space is intentionally required for inline layout; update the JSX to simply close the div and, if spacing is needed, apply CSS (margin/padding or gap) to the surrounding elements instead of the `{" "}` spacer.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/BidForm.test.tsx around lines 7 - 38, The tests for BidForm (in BidForm.test.tsx) miss coverage for the new isVerified prop; add tests that render <BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} isVerified={false} /> and assert that quick bid buttons and manual submit are disabled and that the verification banner (text or role rendered by BidForm when unverified) is present, then add a test rendering without isVerified to assert default behavior (buttons enabled and no banner) to confirm default true; reference the BidForm component and the test file’s existing "validates manual bid input correctly" and "renders quick bid buttons with correct amounts" tests to mirror structure and assertions.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/BiddingPanel.test.tsx around lines 16 - 21, The auth mock used in the test (the vi.mock for useSession) only provides user.name; add a stable user identifier (e.g., user.id or sub) to the mocked session object so BiddingPanel and any profile-fetching logic can resolve user profile queries; update the mock returned by useSession in BiddingPanel.test.tsx to include the id (for example add user.id = "test-user-id") and adjust any assertions or mock network responses that rely on that id.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/BiddingPanel.test.tsx around lines 24 - 27, The test mock for convex/react returns null for useQuery which breaks BiddingPanel's loading detection and prevents testing the new verification gating; update the vi.mock for "convex/react" so useQuery returns a profile object with isVerified and kycStatus fields (e.g., { profile: { isVerified: false, kycStatus: undefined } }) to simulate an unverified user, then add tests exercising BiddingPanel (rendering the component, interacting as needed) for both unverified and verified states by changing the mocked profile (isVerified: true) to assert the bidding UI is gated/unlocked accordingly; target the useQuery mock, BiddingPanel component, api.users.getMyProfile usage, and userData/isVerified/kycStatus checks when adding the tests.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/GuestRestrictions.test.tsx around lines 35 - 43, The mock's useQuery implementation can be simplified by unifying how apiFunc is normalized to a string: in the useQuery mock (function name useQuery) replace the nested typeof checks and type assertions for apiFunc with a single normalized path extraction (use apiFunc if it's a string, otherwise read apiFunc._path with a fallback to an empty string), assign that to path or pathStr, then perform the includes("isWatched") check and return false or [] accordingly; this removes the cast (apiFunc as { _path: string }) and the extra conditional branches while preserving behavior.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/ImageGallery.test.tsx around lines 1 - 45, Add tests in ImageGallery.test.tsx that cover the two new behaviors: (1) verify that lightbox navigation buttons inside the ImageGallery's lightbox dialog call event.stopPropagation() to prevent closing the dialog—simulate clicking the next/prev buttons (e.g., the elements rendered by the component's lightbox navigation within the dialog) and assert that a mocked event.stopPropagation handler was invoked or that clicking these buttons does not trigger dialog close; (2) verify the overlay on inactive thumbnails by rendering ImageGallery with multiple images and asserting that thumbnails other than the active one contain the expected overlay element/class (the inactive thumbnail overlay rendered by ImageGallery) while the active thumbnail does not. Reference the ImageGallery component, the lightbox dialog role, the lightbox navigation buttons, and the thumbnail elements in your tests.

- Verify each finding against the current code and only fix it if needed.

In @app/src/components/__tests__/SellerInfo.test.tsx around lines 1 - 31, Add tests in SellerInfo.test.tsx to cover the component's other states: mock convex/react's useQuery to return undefined to assert the loading/skeleton UI is shown (look for skeleton placeholders or loading text used by SellerInfo), mock useQuery to return null and assert "Seller information unavailable" is rendered, and mock useQuery to return an object with isVerified: false to assert the verification badge/text ("High-Integrity Verification") is NOT present; each test should render <SellerInfo sellerId="..."/> inside MemoryRouter just like the existing verified case.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/Login.tsx around lines 87 - 91, The generated display name currently only strips leading/trailing digits and separators and can leave embedded dots/underscores (see emailPrefix → name logic); update the transformation so embedded separators (characters like '.', '_', '-') are normalized to single spaces, collapse/trim multiple spaces, then title-case each word and fallback to "User" if result is empty—i.e., operate on emailPrefix (derived from email) by replacing /[._-]+/g with a space, trim and collapse spaces, then capitalize the first letter of each token before joining to produce name.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/dashboard/MyBids.tsx around lines 55 - 76, The nested ternary chains computing statusLabel and statusVariant in MyBids.tsx are hard to read; extract them into a small pure helper (e.g., getStatusDisplay) that takes the AuctionWithBid (or auction) and returns { label, variant } based on auction.isWinning, auction.isWon and the computed isLost ((auction.status === "sold" && !isWon) || auction.status === "unsold"); replace the existing statusLabel/statusVariant expressions with a call to this helper to improve readability and maintain the exact same label and variant mappings ("WON"/"default", "WINNING"/"secondary", "RESERVE NOT MET"/"destructive", "OUTBID / SOLD"/"destructive", fallback auction.status/"outline").