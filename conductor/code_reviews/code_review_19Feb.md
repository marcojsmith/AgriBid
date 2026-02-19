Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@app/convex/admin_utils.ts`:
- Around line 271-279: When inserting a new counters row via
ctx.db.insert("counters", ...) ensure any initial delta used for
total/active/pending/verified is clamped to a minimum of 0 to avoid storing
negatives; change initialization logic in the insert path (the code that builds
values for total/active/pending/verified based on the incoming field and delta)
to use a clamp like Math.max(0, delta) for the selected field (e.g., compute
initTotal = field === "total" ? Math.max(0, delta) : 0, similarly for
initActive/initPending/initVerified) and then use those variables in the
ctx.db.insert call while leaving updatedAt as Date.now().

In `@app/convex/admin.ts`:
- Around line 368-402: Unify counter field initialization by ensuring both the
"auctions" and "profiles" counter records include the same set of numeric fields
initialized to 0 (e.g., total, active, pending, verified) and updatedAt; update
the insert payloads for profileCounter and auctionCounter to include all these
fields, and when patching (in the auctionCounter and profileCounter branches)
set any missing fields to 0 as well so getAdminStats can rely on a consistent
schema.

In `@app/convex/auctions.ts`:
- Around line 667-684: adminUpdateAuction currently patches an auction without
updating aggregate counters when the auction status changes; mirror the
status-delta logic from bulkUpdateAuctions into adminUpdateAuction by first
loading the auction (use ctx.db.get(args.auctionId) and throw if missing),
capture oldStatus = auction.status and newStatus = args.updates.status, call
ctx.db.patch(args.auctionId, args.updates), then if newStatus && oldStatus !==
newStatus compute statusToCounterKey (mapping active -> "active", pending_review
-> "pending"), derive oldKey/newKey from oldStatus/newStatus and call
updateCounter(ctx, "auctions", oldKey, -1) and updateCounter(ctx, "auctions",
newKey, 1) as applicable to keep counters consistent.

In `@app/src/App.tsx`:
- Around line 26-28: The wrapper div around LoadingIndicator is creating a
nested live region because LoadingIndicator already uses role="status" and
aria-live="polite"; remove the aria-live="polite" attribute (and any role
attributes if present) from the wrapper div so only LoadingIndicator provides
the live region, leaving the div purely presentational and keeping
LoadingIndicator as the single live announcer.

In `@app/src/components/admin/ModerationCard.tsx`:
- Around line 78-80: The ModerationCard currently formats the starting price
using auction.startingPrice.toLocaleString("en-ZA") while AdminDashboard uses
toLocaleString() without a locale; make currency formatting consistent by
extracting a shared formatter (e.g., a utility using Intl.NumberFormat with
"en-ZA" and currency: "ZAR") and replace both uses (in ModerationCard and
AdminDashboard) to call that formatter (or use a shared formatCurrency function)
so all Rand values render identically.

In `@app/src/components/header/MobileMenu.tsx`:
- Around line 78-100: The focus trap is using menuRef.querySelectorAll into
focusableElements but doesn't exclude disabled or hidden controls, so disabled
items like "Profile (Syncing...)" remain and allow focus to escape; in the
MobileMenu keydown handler (where focusableElements, firstElement, lastElement
are defined) convert the NodeList to an array and filter out elements that are
disabled, have tabindex -1, or are not visible/aria-hidden (e.g. check
element.hasAttribute('disabled'), element.getAttribute('aria-hidden') ===
'true', and element.tabIndex === -1 or visibility via offsetParent/closest
styles) before selecting firstElement/lastElement and applying the wrap focus
logic.
- Around line 153-158: The MobileMenu currently renders the name and a status
line even when userData is undefined, causing a misleading "Unverified" label;
update the JSX in MobileMenu to only render the status line (the element that
uses isVerified) when userData is loaded (or when isVerified is not undefined)
and show a sensible placeholder or nothing for the name while loading (e.g.,
skeleton or empty space). Locate the JSX that references userData?.name and
isVerified and wrap the status <p> in a conditional check (or render a loading
placeholder) so "Unverified" is not shown during Convex loading.

In `@app/src/pages/admin/AdminDashboardContent.tsx`:
- Around line 94-120: The KPI stats block living in AdminDashboardContent should
be moved into the shared AdminLayout so the Live Auctions/Total
Users/Moderation/Platform Growth header is available across all admin routes:
remove the StatCard grid from AdminDashboardContent and add the same JSX into
AdminLayout (keep the StatCard components, icons and conditional rendering), and
wire stats data into AdminLayout either by accepting a stats prop from the
individual pages or by fetching it inside AdminLayout (or via context/state) so
the values (stats.activeAuctions, stats.totalUsers, stats.pendingReview) remain
available; ensure styling/classNames are preserved and that AdminLayout handles
the case when stats is undefined.
- Around line 219-233: The file mixes two patterns: ModerationTab,
MarketplaceTab, UsersTab, and SettingsTab currently include their own
TabsContent wrappers while FinanceTab, SupportTab, and AuditTab are wrapped
here; pick one consistent approach and apply it across all tab components—either
remove the TabsContent wrappers from FinanceTab, SupportTab, and AuditTab and
let each component export its own internal TabsContent (to match
ModerationTab/MarketplaceTab/UsersTab/SettingsTab), or remove internal
TabsContent from ModerationTab/MarketplaceTab/UsersTab/SettingsTab and wrap
every tab here with <TabsContent value="..."> (using the same value keys used by
FinanceTab/SupportTab/AuditTab) so all tabs follow the same external-wrapping
pattern; update imports/exports and tests accordingly to reflect the unified
TabsContent location.

In `@app/src/pages/admin/tabs/MarketplaceTab.tsx`:
- Around line 88-97: The useMemo block computing
isAllSelected/isPartiallySelected also returns visibleSelectedCount which is
never used; remove visibleSelectedCount from the returned object and any
references to it so the computed memo only returns { isAllSelected,
isPartiallySelected } and keep the dependency array as [selectedAuctions,
filteredAuctions]; adjust any code that might have expected visibleSelectedCount
(none currently) and ensure selectedAuctions, filteredAuctions and useMemo
remain unchanged otherwise.

In `@app/src/pages/KYC.tsx`:
- Around line 297-302: The onClick handler for AlertDialogAction calls the async
function executeDeleteDocument but doesn't await it; change the handler to an
async function, await executeDeleteDocument(docToDelete), and wrap the call in a
try/catch so errors can be handled (e.g., show an error and keep the dialog
open) and only call setShowDeleteConfirm(false) after a successful await (or
explicitly close on failure if desired). Update the AlertDialogAction onClick to
use an async arrow function that references executeDeleteDocument and
setShowDeleteConfirm accordingly.

In `@app/src/pages/kyc/hooks/useKYCForm.ts`:
- Around line 134-159: Move the required-field check to the start of the
validate function so missing names are reported before specific field format
errors: in the validate() function, check formData.firstName.trim() and
formData.lastName.trim() first and return { valid: false, message: "Please fill
in all personal details" } if either is empty, then proceed with the existing
email (isValidEmail & confirmEmail), phone (isValidPhoneNumber), and id
(isValidIdNumber) validations so users with empty forms see the most relevant
error first.
- Line 46: The current initialization in useKYCForm (confirmEmail:
initialData.email || "") ignores any initialData.confirmEmail; update the
initializer to prefer initialData.confirmEmail when present (e.g., confirmEmail:
initialData.confirmEmail ?? initialData.email ?? "") so a caller-provided
confirmation value is respected, or alternatively remove confirmEmail from the
initialData/KYCFormData type (or add a clear comment) if the intent is to always
mirror email—adjust the KYCFormData type/useKYCForm initializer accordingly.

---

Outside diff comments:
In `@app/convex/users.ts`:
- Around line 262-269: The code in verifyUser unconditionally patches and calls
updateCounter which double-counts already-verified profiles; change verifyUser
to first check profile.isVerified and only call ctx.db.patch(profile._id, {
isVerified: true, updatedAt: now }) and updateCounter(ctx, "profiles",
"verified", 1) when profile.isVerified is false (i.e., the status actually
changes), otherwise skip the patch and the updateCounter call.

---

Duplicate comments:
In `@app/src/hooks/useFileUpload.ts`:
- Around line 85-107: performCleanup's fallback uses deleteUpload (which
requires admin) so non-admin callers who omit cleanupHandler quietly get
orphaned uploads; update performCleanup to detect authorization failures and log
a clear warning recommending callers provide a cleanupHandler (or run as admin).
Specifically, inside the cleanupHandler try/catch and in the Promise.allSettled
results loop for deleteUpload, inspect rejected errors (result.reason) for an
authorization/permission indicator (e.g., error.name/message/code) and, when
detected, call console.warn with a descriptive message that includes the
storageId(s) and advises supplying cleanupHandler or elevated privileges; keep
existing error logging for other failure types.