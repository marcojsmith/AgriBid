# Task: Wire up the "Message" button in SellerInfo (auction detail page)

## Background

The user asked why they couldn't message a seller from an auction page. Investigation
found the seller-messaging feature shipped in issue #231 (PR #262) only wired up the
"Contact Seller" button on the profile page (`src/pages/Profile.tsx`) — but there is a
**second, separate** disabled "Message" button in `src/components/SellerInfo.tsx`
(a shared card component rendered on the auction detail page,
`src/pages/AuctionDetail.tsx:493`) that was never touched by #231 and is still
hardcoded `disabled`. This task wires that one up too, and checks for any other spot
where messaging should reasonably be surfaced.

A repo-wide grep for other stale "Not implemented"/"Coming soon" messaging-adjacent
strings turned up nothing else related to messaging — `src/components/SellerInfo.tsx`
is the only remaining gap. (There's an unrelated "Coming soon - see issue #219" on
`Profile.tsx:636` — that's a different feature, out of scope here, do not touch it.)

## Context

- `src/components/SellerInfo.tsx` — a seller info card, currently only used by
  `src/pages/AuctionDetail.tsx:493` (`<SellerInfo sellerId={auction.sellerId} />`).
  The disabled button is at ~line 92-101:
  ```tsx
  <Button
    variant="outline"
    disabled
    className="h-11 font-bold rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all gap-2"
    aria-label={`Message ${seller.name} (Not implemented)`}
  >
    <Mail className="h-4 w-4" />
    Message
  </Button>
  ```
  It sits in a `grid grid-cols-2` alongside a "View Profile" `Link` to
  `/profile/${sellerId}`.
- `src/components/SellerInfo.test.tsx` — existing tests mock `convex/react`'s
  `useQuery` only; no router mocks beyond `MemoryRouter`, no mutation mocks yet.
- `src/pages/AuctionDetail.tsx` — already computes `isOwner = session?.user?.id ===
auction?.sellerId` (~line 107) via `useSession()` from `@/lib/auth-client`
  (~line 21, 87). The auction's own ID is `auction._id` (`Id<"auctions">`). Pass
  through whatever `SellerInfo` needs to (a) know if the viewer is the seller
  themselves (so the button can be hidden/disabled for the seller viewing their own
  auction — messaging yourself is already blocked server-side by
  `startConversationHandler` in `convex/messages.ts`, but the UI shouldn't offer a
  button that will just error) and (b) link the resulting conversation to this
  specific auction via `auctionId`.
- `convex/messages.ts` — `startConversation` (public mutation) already accepts args
  `{ recipientId: v.string(), initialMessage: v.string(), auctionId:
v.optional(v.id("auctions")) }` and returns `v.id("conversations")`. This is the
  exact mutation to call — no backend changes needed for this task, this is UI-only.
- `src/pages/Profile.tsx`'s "Contact Seller" dialog (added in PR #262, search
  `contactDialogOpen`/`handleContactSeller`) is the exact pattern to mirror: a small
  `Dialog`/`DialogContent` with a message textarea, Cancel/Send buttons, calling
  `startConversation` via `useMutation`, `toast.success`/`toast.error` on
  submit/failure, and `useNavigate()` to `/messages/${conversationId}` on success.
  Reuse this same interaction pattern in `SellerInfo`, don't invent a new one.

## Instructions

1. **`src/components/SellerInfo.tsx`**: enable the "Message" button.
   - Add two new optional props to `SellerInfoProps`: `auctionId?: Id<"auctions">`
     (to link the started conversation to this auction) and `isOwnListing?: boolean`
     (defaults to `false` if omitted — when `true`, render the Message button as
     `disabled` with a title/aria-label indicating it's your own listing, same spirit
     as how other "can't act on your own X" buttons in this codebase are handled,
     e.g. check `AuctionDetail.tsx`'s existing owner-gated UI for the tone/pattern).
   - Add local state for a small message-compose dialog (mirror `Profile.tsx`'s
     Contact Seller dialog: `Dialog`/`DialogContent`, a single message `Textarea`,
     Cancel/Send), `useMutation(api.messages.startConversation)`, and `useNavigate()`
     from `react-router-dom`.
   - On submit: call `startConversation({ recipientId: sellerId, initialMessage:
<trimmed textarea value>, auctionId })`. Blank message → inline validation /
     `toast.error`, no mutation call (mirror `Profile.tsx`'s validation exactly).
     Success → `toast.success(...)`, close dialog, `navigate('/messages/' +
conversationId)`. Failure → `toast.error` with the server's `ConvexError`
     message, dialog stays open (no silent failures, matching `Profile.tsx`'s
     `handleContactSeller`).
   - Remove the `disabled` attribute and the `(Not implemented)` suffix from the
     `aria-label` for the non-owner case; keep the button disabled only when
     `isOwnListing` is true.

2. **`src/pages/AuctionDetail.tsx`**: pass the new props through.
   - Update the `<SellerInfo sellerId={auction.sellerId} />` call (~line 493) to
     `<SellerInfo sellerId={auction.sellerId} auctionId={auction._id}
isOwnListing={isOwner} />` (reusing the `isOwner` already computed at ~line 107).

3. **Check for other reasonable messaging entry points** (per the user's explicit
   request to check "even if it is outside of scope") — do this as a quick audit,
   not a mandate to add messaging everywhere:
   - Grep the repo for any other disabled "Message"/"Contact" buttons or stale
     `TODO`s referencing #220/#221/#231 that reference messaging specifically. If you
     find another genuine gap (a place where a user is clearly blocked from
     contacting a seller with no alternative path), wire it up the same way and
     document it in Results. If you don't find anything else, say so explicitly in
     Results — don't go looking for places to _add_ a new messaging entry point that
     wasn't already a stubbed/disabled affordance; that would be scope creep beyond
     "check we didn't miss an existing stub."
   - Specifically check: `src/pages/SellerListings.tsx` (uses the same
     `getSellerInfo` query but not the `SellerInfo` component — does it render any
     seller contact affordance at all?), `src/pages/dashboard/MyBids.tsx` and
     `src/pages/dashboard/MyListings.tsx` (do either show a seller/buyer contact
     option?), and any bid-related components (e.g. `BidHistory.tsx`) that might show
     a bidder or seller identity with an implied "contact" affordance.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` if any backend touch turns
  out to be needed (it shouldn't — this is UI-only, reusing the existing
  `startConversation` mutation).
- Do not modify `convex/messages.ts` or any other backend file unless step 3's audit
  turns up a real gap requiring it — flag that in Results before proceeding rather
  than assuming it's fine.
- Do not touch the unrelated `TODO(#219)` on `Profile.tsx:636`.
- Follow this repo's existing code style and the exact dialog/toast/navigation
  pattern already established in `Profile.tsx`'s Contact Seller flow — don't invent a
  new interaction pattern for what is functionally the same feature.
- Bump `package.json` version per `AGENTS.md`'s semver section (this branch continues
  from `0.14.1`).

## Verification

Run these yourself and record actual results — do not assume:

1. `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`
   AND `bun run type-check` — both must pass.
2. `bun run test --run` (full suite) — all green, including updated
   `SellerInfo.test.tsx` and `AuctionDetail.test.tsx` (check it exists and covers the
   new props) coverage: message dialog opens/sends/navigates on success, shows error
   toast on failure, button disabled with correct label when `isOwnListing`.
3. `bunx eslint` on every touched/created file — zero errors, no new warnings vs the
   current HEAD of this branch.
4. `npx convex dev --once` only if step 3's audit required a backend change —
   otherwise this can be skipped since no schema/query changes are expected.
5. Manually confirm (via diff) that no unrelated `SellerInfo`/`AuctionDetail`
   behavior (bidding, condition report, flag dialog, the "View Profile" link) was
   touched beyond what's described above.

## Results

<!-- opencode: fill this in when done -->

**Status: Complete.** All three instruction steps implemented; all verification checks pass.

### Changes

| File                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/SellerInfo.tsx`      | Message button wired up. Added optional `auctionId?: Id<"auctions">` and `isOwnListing?: boolean` (default `false`) props; `Dialog`/`DialogContent` compose dialog with a single `Textarea` + Cancel/Send, mirroring `Profile.tsx`'s Contact Seller pattern exactly (same validation text `"Please enter a message"`, same `"Message sent"` success toast, `useMutation(api.messages.startConversation)`, `useNavigate()` to `/messages/${conversationId}` on success, `toast.error` with the server's error message and dialog stays open on failure, Send disabled while sending). Removed the hardcoded `disabled` and the `(Not implemented)` aria-label suffix for the non-owner case (`aria-label={\`Message ${seller.name}\`}`). When `isOwnListing`is true the button stays`disabled`with`title="This is your own listing"`and the same string as`aria-label`. |
| `src/pages/AuctionDetail.tsx`        | `<SellerInfo sellerId={auction.sellerId} />` → `<SellerInfo sellerId={auction.sellerId} auctionId={auction._id} isOwnListing={isOwner} />` (reusing the existing `isOwner` at line 107). No other lines touched (confirmed via diff).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/components/SellerInfo.test.tsx` | 4 → 13 tests. Added `useMutation` mock, `sonner` mock, and the repo-standard Dialog mock (same as `Profile.test.tsx`/`AuctionDetail.test.tsx`). New "Message dialog" suite covers: enabled button without "(Not implemented)" label; dialog opens with message field + send button; cancel closes; blank/whitespace-only message → error toast + no mutation call; success → mutation called with `{ recipientId: "seller123", initialMessage, auctionId: "auction1" }`, success toast, navigation to `/messages/:conversationId`; `auctionId: undefined` when prop omitted; failure → error toast with server message, dialog stays open, no navigation; `isOwnListing` → disabled button with the own-listing title/aria-label. Existing 4 tests unchanged and passing.                                                                                              |
| `src/pages/AuctionDetail.test.tsx`   | `SellerInfo` mock now captures its props via `vi.hoisted`; +2 tests assert pass-through of `{ sellerId: "seller1", auctionId: "auction1", isOwnListing: false }` for a non-owner session and `isOwnListing: true` when the viewer is the seller. 15 → 17 tests, all passing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `package.json`                       | Version bump `0.14.1` → `0.14.2` (patch: bug fix/UI tweak).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `codebase_notes.md`                  | Follow-up notes added under the Seller Messaging section.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Step 3 audit — other messaging entry points

**No other gaps found; no additional wiring done.** Explicit findings:

- Repo-wide grep for disabled "Message"/"Contact" buttons and stale `Not implemented`/`Coming soon`/`TODO(#220|#221|#231)` messaging strings: `SellerInfo.tsx` was the **only** remaining stub (matches the task's background section). `Profile.tsx:636` `TODO(#219)` untouched as instructed.
- `src/pages/SellerListings.tsx` — no seller contact affordance at all, but it renders a prominent "Back to profile" link to `/profile/:userId`, which has the working Contact Seller button. Not a gap (alternative path exists; nothing stubbed).
- `src/pages/dashboard/MyBids.tsx` — no contact affordance; every bid card links to `/auction/${auction._id}`, where the now-functional SellerInfo Message button lives. Not a gap.
- `src/pages/dashboard/MyListings.tsx` — user's own listings; every card links to the auction detail page (and sellers reach buyers via `/messages` directly). Not a gap.
- `src/components/bidding/BidHistory.tsx` — shows bidder identities but **deliberately anonymised** (`anonymizeName`, `src/components/bidding/BidHistory.tsx:54`); there is no implied contact affordance, and adding contact-a-bidder would be a new feature (and a privacy question), not a missed stub. Out of scope.
- Backend: no changes needed or made — `convex/messages.ts` and all other backend files untouched; `startConversation` already accepted everything required.

### Verification results

1. **Type-check** — both pass:
   - `bunx tsgo -p tsconfig.json --noEmit` ✅ and `bunx tsgo -p convex/tsconfig.json --noEmit` ✅ ("BOTH TSGO CHECKS PASSED")
   - `bun run type-check` ✅ (`tsgo -b tsconfig.build.json --noEmit`, no output)
2. **Full test suite** — `bun run test --run` ✅ **171 test files passed, 2131 tests passed, 0 failures** (stderr `act(...)` warnings are pre-existing noise from `ListingWizardContext.test.tsx`, untouched by this change). Updated `SellerInfo.test.tsx` (13 passed) and `AuctionDetail.test.tsx` (17 passed) cover all the scenarios listed in this step.
3. **ESLint** — `bunx eslint` on all 4 touched `.tsx` files: **0 errors**. 3 warnings, all pre-existing at HEAD (verified by linting `git show HEAD:` copies — identical warnings): `AuctionDetail.tsx:107` `no-unnecessary-condition` (the pre-existing `isOwner` optional chain, not modified) and 2× `require-await` in pre-existing `AuctionDetail.test.tsx` async test callbacks (line numbers only shifted 308→323, 418→433 because tests were appended). **No new warnings introduced.** (Noted in `codebase_notes.md` as a candidate for a separate cleanup commit — fixing them would touch unrelated pre-existing test code, so left alone per scope.)
4. **`npx convex dev --once`** — skipped as permitted: no backend/schema/query changes (audit confirmed no backend need).
5. **Diff confirmation** — `git diff` on `AuctionDetail.tsx` shows only the 5-line `SellerInfo` prop change; bidding, condition report, flag dialog, related auctions, and the "View Profile" link behaviour untouched. `SellerInfo.tsx` diff only adds the dialog/props and un-disables the button; skeleton/null states and the verification banner unchanged. `package.json` diff is the version bump only. Untracked `docs/ui-design/gpt-image-2-*.png` predates this task and was not touched.
