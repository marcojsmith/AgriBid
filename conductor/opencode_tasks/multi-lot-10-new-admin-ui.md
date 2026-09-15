# Task: Multi-lot auctions — Step 10: new admin UI + public gallery

Part of the multi-lot auction rework (GitHub issue #318). Final step, 10 of 10.

**Completed entirely by Claude (orchestrator) directly, not opencode.** opencode's OpenRouter key was still at its monthly limit throughout this step (confirmed dead on the first model call during step 9's retry) — per the user's explicit direction, all of step 10 was implemented directly rather than attempted through opencode.

## Scope

Steps 1-9 made the entire *existing* app (backend and frontend) work on the multi-lot model. This step builds the genuinely new UI that issue #318 asked for and that never existed before: admin auction (container) management, lot-to-auction assignment, and a public auction gallery.

## What was built

### Backend (new)

- `convex/auctions/queries/events.ts`: four new queries for the auction-container entity, which had no query surface at all before this step:
  - `getAllAuctionEvents` (admin) — every auction container, newest first, with resolved banner URL and lot count.
  - `getAuctionEventById` (admin) — single container lookup, same shape, `null` if missing.
  - `getPublishedAuctionEvents` (public, no auth) — merges `published` + `closed` containers for the gallery, draft containers never exposed.
  - `getAssignmentCandidates` (admin) — for one auction, returns `{ unassigned, assigned }`: every `approved` lot platform-wide plus every lot currently assigned to that auction, both lot-summary shaped.
  - Re-exported through both `convex/auctions.ts` and `convex/auctions/queries.ts` barrels, matching existing convention.
- Renamed `convex/auctions/mutations/adminCrud.ts`'s `createAuction`/`createAuctionHandler` → `createAuctionEvent`/`createAuctionEventHandler` (see "Bug found" below) — semantically clearer anyway, since "createAuction" was ambiguous with the per-lot `create.ts`'s `createAuction`.

### Frontend (new)

- `src/pages/admin/AdminSales.tsx` — auction event list: banner card grid, status badges, lot counts, Publish/Close actions, links to each event's assignment screen, "New Auction Event" button.
- `src/pages/admin/sales/AuctionEventFormDialog.tsx` — create/edit dialog: title, description, banner image upload (reuses the existing `useFileUpload` hook), start/end `datetime-local` inputs, default buyer premium / seller commission percentage inputs (stored as 0-1 fractions, entered as %). Uploads the banner before saving and cleans it up on failure.
- `src/pages/admin/AdminSaleDetail.tsx` — the lot assignment screen (issue #318's main missing piece): two columns, "Assigned Lots" (with Unassign) and "Approved & Awaiting Assignment" (with Assign), wired to `convex/auctions/mutations/assignment.ts`'s `assignLotToAuction`/`unassignLot` from step 3.
- `src/pages/AuctionGallery.tsx` — public gallery at `/auctions`: banner-image card grid of published/closed auctions, "Live Now" badge when currently in-window, linked from the site footer's Platform section.
- Routes added to `src/App.tsx`: `/admin/sales`, `/admin/sales/:id`, `/auctions`. Sidebar entry ("Auction Events") added to `src/components/admin/AdminLayout.tsx`.

## Bug found: Convex codegen quirk on `adminCrud.ts`'s `createAuction`

While wiring `AuctionEventFormDialog.tsx`, `useMutation(api.auctions.mutations.adminCrud.createAuction)`'s inferred args type resolved to `never` for every field — confirmed via an isolated type-probe file, not a project misconfiguration (the *sibling* `updateAuction` in the same file resolved correctly; `create.ts`'s differently-named `createAuction` also resolved correctly). Renaming `adminCrud.ts`'s export to `createAuctionEvent` did **not** fix it — so it isn't a name collision with `create.ts`'s `createAuction` either. Root cause not fully identified within the session's time budget. Worked around with an explicit local interface (`CreateAuctionEventArgs`, mirroring the backend's `CreateAuctionArgs`) and a documented type cast at the call site — the mutation's real runtime args/behavior are unaffected (only the generated `FunctionReference`'s TypeScript inference was wrong), and `bun run type-check` confirms zero errors from this workaround. Worth a dedicated follow-up investigation if this pattern (an admin-container mutation whose handler is a separately-declared, explicitly-typed function) recurs.

## Bugs found and fixed while doing the final verification sweep

Running the full test suite (`bun run test --run src` / `convex`) for the first time all together (rather than the narrow per-file scope each prior step verified) surfaced five pre-existing gaps from steps 7-9 that had never been caught, since they weren't in those steps' explicit test scope:

- `src/lib/auction-badges.test.ts` — tested the removed `"active"` key directly (step 9 replaced it with `approved`/`assigned` but never touched this dedicated test file). Fixed.
- `src/components/SellerInfo.test.tsx` — test wrapper still passed/asserted `auctionId` even though `SellerInfo.tsx`'s real prop was renamed to `lotId` back in step 8. Fixed.
- `src/pages/AuctionDetail.test.tsx` — five failures: stale `status: "active"` fixture, `startTime` instead of `auctionStartTime`, `flagAuction` call assertions using `auctionId` instead of `lotId`, and `SellerInfo` prop-capture assertions same issue. This file was never in step 7's touched-test-file list even though `AuctionDetail.tsx` itself was explicitly rewritten that step. Fixed.
- `convex/auctions/publishAuction.test.ts` — asserted the old `"You can only modify your own auctions"` error string; step 8 changed `convex/auctions/mutations/helpers.ts`'s message to `"...lots"` but this separate legacy test file (distinct from `mutations/publish.test.ts`, which *was* updated then) was missed. Fixed.
- `src/pages/admin/AdminFees.test.tsx` / `AdminFinance.test.tsx` — broke because both hand-list `lucide-react`'s exports in a `vi.mock`, and this step's new `CalendarClock` sidebar icon wasn't in either list. Added.

None of these were caused by step 10's own new code — they were latent gaps in earlier steps' test coverage, surfaced because this is the first time the *entire* suite ran together rather than each step's own narrow scope.

## Verification

- `bun run type-check`: **104 errors** — unchanged from step 9's end state. Zero errors in any file this step touched. Remaining errors are `convex/seed.ts` (pre-existing, flagged since step 5) and `convex/auctions/mutations/publish.ts`/`publish.test.ts` (legacy dead code, flagged since step 3).
- `bun run test --run src`: **128 files, 1452 tests, all passing.**
- `bun run test --run convex`: **58 files, 872 tests, all passing.**
- Combined: **186 test files, 2324 tests, 100% passing** — the full suite, not a subset, run together for the first time in this effort.
- `bunx eslint` on every new/touched file: 0 errors (only pre-existing unrelated warnings).

## Known gaps / deliberately out of scope

- `AdminSales.tsx`'s auction-window edit path exists (`updateAuction` mutation, used by the same form dialog in edit mode) but there's no UI enforcement surfacing the backend's post-assignment edit constraints (issue #318: can't move `startTime` past an assigned lot's accepted bids, can't shorten `endTime` below an assigned lot's `extendedEndTime`) beyond the backend throwing a `ConvexError` that the dialog's generic error toast will display. A dedicated inline warning would be a nicer follow-up.
- No drag-and-drop or bulk-assign UI for lot assignment — one lot at a time via the Assign/Unassign buttons. Sufficient for the issue's requirements but a UX polish opportunity.
- `convex/auctions/mutations/publish.ts`'s legacy dead code (flagged in every step since 3) is still there, still unreferenced by any real UI path — a standalone deletion task, not touched here to keep this step's diff focused.
- `convex/seed.ts` still needs its own dedicated fixture-rewrite task (flagged repeatedly since step 5).
