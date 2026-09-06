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
