# PR testing guide — stacked chain #262 → #263 → #264 → #267

Covers the 4 open PRs in the `feat/issue-232-report-profile → ... → feat/showcase-mock-data`
stack, in merge order. **Merge bottom-up, in this exact order: #262 → #263 → #264 → #267.**
Each PR's GitHub diff only shows its changes relative to the branch below it in the stack —
merging out of order (or reviewing a later PR's diff before earlier ones have merged) will show
confusing/incomplete diffs and can produce conflicts. Test each PR's preview deployment
independently; you don't need to wait for a merge to test the next one, but do merge in order.

---

## PR #262 — Seller messaging/contact system (issue #231)

### What it adds

- A buyer can message a seller from a listing (`SellerInfo`'s "Message" button) or from the
  seller's profile page (`Profile.tsx`'s "Contact Seller" dialog). The first message creates a
  conversation (or reuses an existing one between the same two users, in either direction).
- A `/messages` inbox (list of conversations, other participant's name, last-message preview,
  unread count) and `/messages/:conversationId` thread view (paginated messages, send box).
- Header nav gets a "Messages" entry (desktop `UserDropdown` and `MobileMenu`) with an unread-count
  badge.
- Recipients get an in-app notification ("New message") linking to the conversation.
- Server-side guards: rate limit of 10 messages/minute per sender, self-messaging blocked, only
  conversation participants can view/send.

### Prerequisites

- Two distinct logged-in accounts: a buyer and a seller with **no prior conversation** between
  them (to test conversation creation) — plus a second scenario with an **existing conversation**
  between the same two users to test reuse (started from a different auction than the first
  message, to verify the conversation's `auctionId` context updates).
- Seed/preview data may already have conversations between some account pairs from prior manual
  testing — check the `/messages` inbox for existing threads before assuming "no prior
  conversation" holds for a given pair.
- An active/published auction with a seller who is not the account you're logged in as.

### Test steps

1. **Start a conversation from a listing.** Log in as a buyer, open an auction where you are not
   the seller, click the seller's "Message" button in `SellerInfo`, type a message, send. Confirm
   it navigates you into the new conversation and the message appears.
2. **Verify the recipient side.** Log in as the seller. Confirm a "New message" notification
   appears, and the Messages nav entry (desktop dropdown + mobile menu) shows an unread badge.
   Open `/messages`, confirm the conversation appears with the buyer's name and message preview.
3. **Reply and round-trip.** As the seller, open the conversation, send a reply. Switch back to
   the buyer account, confirm the reply arrives and the unread badge/notification updates
   accordingly.
4. **Reuse an existing conversation from a different auction.** As the same buyer, go to a
   _different_ auction from the same seller and click "Message" (or use "Contact Seller" on the
   seller's profile) with a new initial message. Confirm no second conversation is created — the
   existing thread is reused and the new message is appended to it.
5. **Contact via profile page.** Log in as a buyer with no prior conversation with a given seller,
   go to that seller's public profile, use "Contact Seller", send a message. Confirm it creates a
   conversation and you're navigated to `/messages/<id>`.
6. **Self-messaging should fail.** As a seller, try to message yourself (e.g. by manipulating the
   contact flow on your own listing/profile — `SellerInfo` should already disable the "Message"
   button when `isOwnListing` is true, so confirm the button is disabled/absent rather than
   attempting a bypass).
7. **Non-participant access should fail.** As a third account uninvolved in a conversation, try
   navigating directly to `/messages/<conversationId>` for someone else's conversation (copy the
   URL from another session). Confirm you see a "Conversation not found" state, not the messages.
8. **Rate limit.** As one account, send 11 messages in under a minute to the same conversation.
   Confirm the 11th is rejected with a rate-limit error toast, not silently dropped.
9. **Empty/blank message.** Try sending a blank or whitespace-only message from both the contact
   dialog and the thread send box. Confirm it's rejected client-side (or server-side with a clear
   error) rather than creating an empty message.
10. **Error toast text.** Trigger a validation error (e.g. self-message attempt bypassed via
    devtools, or rate limit) and confirm the toast shows the actual server message (e.g. "You
    cannot message yourself"), not a generic fallback — this PR fixed a bug where `Profile.tsx`
    showed a wrapped/generic error instead of the real one.

### Regression watch

- Existing listing/profile pages (`AuctionDetail`, `Profile`) should render and function
  unchanged outside the new Message button/dialog.
- Header dropdown/mobile menu items unrelated to Messages (My Bids, Watchlist, My Listings,
  Support Tickets, Sign Out) should be unaffected.
- Notifications for other event types (not messaging) should still work as before.

---

## PR #263 — User activity feed system (issue #220)

### What it adds

- A `userActivity` feed table and `getSellerActivity` query, surfaced on `Profile.tsx` as an
  "Activity" section.
- Activity entries are logged (server-side, atomically with the triggering mutation) for: account
  creation, KYC verification requested/approved/rejected, role changes, listing created, listing
  sold, bid placed, bid won.
- KYC and role-change entries are **private** — only visible to the profile owner, not to other
  viewers of the same profile.

### Prerequisites

- An account with a mix of activity history: at least one KYC submission (requested, and
  approved/rejected via admin), one listing created, one listing published/sold, one bid placed
  and one bid won — to exercise every activity type and see the feed populated.
- Preview/seed data may not include KYC or role-change events for most seeded accounts, since
  those are triggered by admin action, not the general seed script — you may need to manually
  trigger a KYC request + admin approval/rejection to see those entry types.
- A second account to view the first account's profile as a non-owner, to test the private-entry
  filtering.

### Test steps

1. **Trigger a spread of activity.** As a test account: submit a KYC verification request, create
   a listing, publish it, place a bid on another auction, and (if feasible) win an auction.
2. **View own profile.** Confirm the Activity section on your own profile shows all of the above,
   most-recent-first, including the private KYC/role-change entries.
3. **Admin approves/rejects KYC.** As an admin, approve or reject the pending KYC request. Confirm
   a corresponding activity entry appears on the user's own profile view.
4. **View as another user.** Log in as a different account, view the first account's public
   profile. Confirm the KYC/role-change entries are **absent** but public entries (listing
   created, bid placed, etc.) are visible.
5. **View while logged out.** As an unauthenticated visitor, view a profile with mixed activity.
   Confirm only public entries show (same filtering as step 4).
6. **Volume/limit check.** For an account with many activity entries, confirm the feed is capped
   (default 10, doesn't try to render an unbounded list) and doesn't error out.

### Regression watch

- This PR also touches `bidding.ts`, `create.ts`, `publish.ts`, `internal.ts` (auction settlement),
  `kyc.ts`, and `users.ts` — the mutations these files contain (placing bids, creating/publishing
  listings, settling auctions, KYC decisions, user role changes) should all still behave exactly
  as before; the only change should be an added activity-log side effect. Watch for: bids/listings
  silently failing to create, auction settlement not completing, or KYC decisions not persisting
  — any of those would indicate the `logActivity` call broke its enclosing transaction.
- Profile page layout/other sections (listings, reviews, trust info) should be unaffected.

---

## PR #264 — og-image.png for social preview cards (issue #217)

### What it adds

- A static `public/og-image.png` asset used for social share previews (Open Graph / Twitter
  cards). No application logic changes.

### Prerequisites

- None beyond a deployed preview URL.

### Test steps

1. **Direct asset check.** Load `<preview-url>/og-image.png` directly in a browser; confirm it
   returns a valid image (not a 404 or broken placeholder).
2. **Social preview check.** Use a social-card debugger (e.g. paste the preview URL into a
   Slack/Discord message, or use a Twitter Card validator if available) and confirm the image
   renders as the preview thumbnail rather than a blank/broken card.
3. **No regressions expected** — this PR doesn't touch app code, so there's nothing else to
   exercise. If anything outside `og-image.png`/`package.json`/`conductor/issue-backlog-plan.md`
   changed unexpectedly in the diff, that's a red flag worth investigating before merge.

---

## PR #267 — Expand showcase mock data + weekly auto-reset

### What it adds

- Expands the seed script's showcase dataset (more categories/equipment/auctions/etc. — check
  `convex/seed.ts` for specifics if you need exact counts).
- A new weekly cron job (`convex/crons.ts`, `internal.seed.weeklyReset`, runs every `24 * 7`
  hours) that wipes all mock application data and reseeds it, so the public demo/preview
  deployment doesn't accumulate stale test data indefinitely. Admin profiles and static reference
  data are preserved across the reset.

### Prerequisites

- Access to trigger the seed/reset mutations manually (via Convex dashboard or an admin-only UI
  path, if one exists) rather than waiting a full week for the cron to fire.
- Awareness that this is **not** part of the original issue backlog — it's scoped as the user's
  own addition for demo/preview data hygiene, so there's no corresponding GitHub issue to
  cross-check acceptance criteria against.

### Test steps

1. **Seed script runs cleanly.** Manually invoke `runSeed` (or the equivalent flow used in this
   environment) against a scratch/dev deployment and confirm it completes without errors and
   populates the expanded dataset (more categories/listings than before this PR).
2. **Weekly reset runs cleanly.** Manually invoke `weeklyReset` (internal mutation — trigger via
   Convex dashboard's function runner, not the public API) and confirm: all mock auctions/bids/
   listings are cleared, the dataset is repopulated, and any admin/synthetic accounts you rely on
   for testing (e.g. the mock-seller profile) still exist and work afterward.
3. **Idempotency.** Run `weeklyReset` twice in a row. Confirm it doesn't error or leave duplicate/
   orphaned data the second time.
4. **Auth after reset.** If you were logged in as a seeded (non-synthetic) test account before a
   reset, confirm your session still works afterward (or fails gracefully / prompts re-auth) —
   don't expect a broken app state.

### Regression watch

- Existing showcase browsing (categories, auction listings, search/filter) should still work with
  the expanded dataset — watch for pages that assumed a fixed/small dataset size and now
  paginate oddly or time out.
- The 4 other existing cron jobs (settle expired auctions, cleanup drafts, cleanup presence,
  process error reports) should be unaffected by adding the new weekly-reset cron — check the
  Convex dashboard's cron job list shows all 5 registered without errors.
