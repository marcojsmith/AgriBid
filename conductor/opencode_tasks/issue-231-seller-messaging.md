# Task: Seller messaging/contact system (GitHub issue #231)

## Context

- `src/pages/Profile.tsx` — the "Contact Seller" button (~line 568-577, inside the
  `{!isOwner && (...)}` block, right above the now-enabled Report Profile button from
  issue #232) is permanently disabled with `title="Coming soon - see issue #220"`
  (stale — #220 is the activity-feed issue, unrelated). `isOwner` computed ~line
  191-193; `userId` (profile being viewed) is in scope.
- `convex/schema.ts` — `notifications` table already exists (search `notifications:
defineTable`, ~line 248-267): `recipientId`, `type` (`info`/`success`/`warning`/
  `error`), `title`, `message`, `link`, `isRead`, `createdAt`, indexed by
  `by_recipient`/`by_recipient_createdAt`/`by_recipient_isRead_createdAt`. Direct
  inserts via `ctx.db.insert("notifications", {...})` are used elsewhere (e.g.
  `convex/admin/kyc.ts:121`, `convex/admin/mutations.ts:184`) — follow that pattern,
  no separate notification-sending helper exists to call.
- **Deviation from the issue's literal schema proposal, read this before writing
  Instructions**: the issue's Implementation Plan proposes
  `conversations.participantIds: v.array(v.string())` with `.index("by_participant",
["participantIds"])`. Do NOT do this — Convex array-field indexes are not a
  "contains" lookup; querying "conversations this user is part of" against an array
  index doesn't work the way the issue's pseudocode implies, and would force a full
  table scan or fragile workaround. Since every conversation here is strictly
  two-party (a buyer and a seller), model it as two separate scalar fields instead:
  `buyerId: v.string()` and `sellerId: v.string()`, each properly indexed
  (`by_buyer`, `by_seller`), and derive "conversations for the current user" as the
  union of both queries. Document this deviation in the Results section.
- `convex/lib/auth.ts` — `getAuthenticatedUserId(ctx)` is the auth pattern used by
  every other mutation in this codebase (`flagAuctionHandler`, `submitReviewHandler`,
  `reportProfileHandler`, etc.) — use it here too.
- `convex/constants.ts` — has `MS_PER_MINUTE`/`MS_PER_HOUR` already defined; use them
  for the rate-limit window rather than hardcoding milliseconds.
- Paginated-query convention in this codebase: `usePaginatedQuery` from `convex/react`
  (see `src/pages/dashboard/MyBids.tsx`, `src/pages/admin/AdminUsers.tsx`,
  `src/components/bidding/BidHistory.tsx` for the client-side pattern; server side use
  `paginationOptsValidator` + `.paginate()` exactly as `convex/reviews.ts`'s
  `getSellerReviews` already does).
- `src/App.tsx` — route declarations live in one `<Routes>` block (~line 88-115+),
  each page lazy-imported at the top (~line 9-44) and documented in the JSDoc comment
  above `function App()` (~line 58-77, a bullet list of routes) — add the new
  `/messages` and `/messages/:conversationId` routes there, wrapped in
  `<RoleProtectedRoute allowedRole="any">` like `/watchlist`, `/dashboard/bids`, etc.
- `src/pages/Notifications.tsx` and `src/pages/dashboard/MyBids.tsx` are good
  structural references for a new authenticated list+detail page in this codebase's
  style (Card-based layout, `usePaginatedQuery`, loading/empty states).

## Instructions

1. **Schema** — add two tables to `convex/schema.ts`, near `notifications`:

   ```typescript
   conversations: defineTable({
     buyerId: v.string(),
     sellerId: v.string(),
     auctionId: v.optional(v.id("auctions")),
     lastMessageAt: v.number(),
     createdAt: v.number(),
   })
     .index("by_buyer", ["buyerId", "lastMessageAt"])
     .index("by_seller", ["sellerId", "lastMessageAt"])
     .index("by_buyer_seller", ["buyerId", "sellerId"]);

   messages: defineTable({
     conversationId: v.id("conversations"),
     senderId: v.string(),
     content: v.string(),
     isRead: v.boolean(),
     createdAt: v.number(),
   })
     .index("by_conversation", ["conversationId", "createdAt"])
     .index("by_conversation_read", ["conversationId", "isRead"])
     .index("by_sender", ["senderId", "createdAt"]);
   ```

   (`by_conversation_read` is needed for an efficient `markRead`/unread-count
   implementation — the issue's proposed schema omits it but `getConversations`'s
   unread count and `markRead` both need it.)

2. **New file `convex/messages.ts`** with:
   - `startConversationHandler`/`startConversation` (public mutation). Args:
     `{ recipientId: v.string(), initialMessage: v.string(), auctionId:
v.optional(v.id("auctions")) }`. Guards: caller authenticated via
     `getAuthenticatedUserId`; reject messaging self (`recipientId === callerId`,
     `ConvexError`); reject empty/whitespace-only `initialMessage`; verify a profile
     exists for `recipientId` (same `profiles.by_userId` check as
     `reportProfileHandler` in `convex/profileFlags.ts`). The caller here is always
     the buyer/initiator (matches "Contact Seller" — caller is not the seller being
     viewed), so `buyerId = callerId`, `sellerId = recipientId`. Reuse an existing
     conversation between this exact `(buyerId, sellerId)` pair if one exists (query
     `by_buyer_seller`), else create one; insert the initial message; patch
     `lastMessageAt` on the conversation. Returns `v.id("conversations")`.
   - `sendMessageHandler`/`sendMessage` (public mutation). Args:
     `{ conversationId: v.id("conversations"), content: v.string() }`. Guards: caller
     authenticated; conversation exists; caller is `buyerId` or `sellerId` on it
     (`ConvexError` "You are not a participant in this conversation" otherwise);
     `content` non-empty after trim. **Simple rate limit** (per issue's Notes
     "Consider rate limiting messages to prevent spam"): reject if the same sender has
     sent more than 10 messages in the last `MS_PER_MINUTE` (query `by_sender`,
     filter in JS on `createdAt`, same style as the 30-day duplicate check in
     `convex/profileFlags.ts`'s `reportProfileHandler`) — clear `ConvexError` message.
     Insert message with `isRead: false`, patch conversation's `lastMessageAt`, and
     insert a `notifications` row for the _other_ participant (`type: "info"`, title
     e.g. "New message", `link: "/messages/" + conversationId`). Returns
     `v.object({ success: v.boolean() })`.
   - `getConversationsHandler`/`getConversations` (public query, paginated). Returns
     the caller's conversations (as buyer or seller — union both index queries,
     merge+sort by `lastMessageAt` desc, since a single query can't span two indexes;
     do this by fetching both lists via `.collect()` scoped reasonably — e.g. cap via
     `.take()` at a sane page-adjacent size — rather than true cursor pagination
     across the merge, since exact cross-index cursor pagination is genuinely hard in
     Convex; document this simplification in Results) with: the other participant's
     id/name (join `profiles.by_userId`), a preview of the last message's content,
     and an unread count for the caller (messages in that conversation where
     `isRead === false` and `senderId !== callerId`, via `by_conversation_read`).
   - `getMessagesHandler`/`getMessages` (public query). Args:
     `{ conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator
}`. Guards: caller is a participant (same check as `sendMessage`). Returns
     paginated messages via `by_conversation`, newest-page-first pattern matching
     `getSellerReviews` in `convex/reviews.ts`.
   - `markReadHandler`/`markRead` (public mutation). Args:
     `{ conversationId: v.id("conversations") }`. Guards: caller is a participant.
     Patches `isRead: true` on all messages in that conversation where
     `senderId !== callerId` and `isRead === false` (via `by_conversation_read`).
     Returns `v.object({ success: v.boolean(), markedCount: v.number() })`.
   - Admins viewing flagged conversations (issue's Notes) — **out of scope for this
     task**, no existing "flagged conversation" concept exists yet and inventing one
     isn't warranted by this issue alone.

3. **`src/pages/Profile.tsx`**: enable "Contact Seller" for non-owners.
   - Remove the stale `disabled`/`title="Coming soon - see issue #220"` and its
     `TODO(#220)` comment.
   - On click: call `startConversation({ recipientId: userId, initialMessage: <a
sensible default or prompt — simplest correct approach: open a small dialog
first asking for the initial message text, similar structurally to the Report
Profile dialog added in issue #232 (`Dialog`/`DialogContent`, single textarea,
submit button), then navigate to `/messages/:conversationId`via`useNavigate()` on success>, auctionId: undefined }`; show `toast.error` on
     failure. Do not silently fail.

4. **New page `src/pages/Messages.tsx`** (inbox + thread view):
   - Route `/messages` — list of conversations via `usePaginatedQuery` on
     `getConversations`: other participant's name, last-message preview, relative
     timestamp, unread badge.
   - Route `/messages/:conversationId` — thread view: message list via
     `usePaginatedQuery` on `getMessages` (oldest-first display), a send box wired to
     `sendMessage`, calling `markRead` on mount/when the thread is viewed. Guard:
     if the query throws because the caller isn't a participant, show a clear
     "Conversation not found" state rather than a crash — check how other pages in
     this codebase (e.g. `AuctionDetail.tsx`) handle a `null`/error query result and
     follow that convention.
   - Add both routes in `src/App.tsx`: lazy import, `<Route>` entries wrapped in
     `<RoleProtectedRoute allowedRole="any">`, and update the JSDoc route list above
     `function App()`.
   - A nav entry (e.g. in the header, near the existing notifications bell/dropdown)
     is a nice-to-have, not required — only add one if it's a small, low-risk
     addition once the rest is done; do not spend significant time on it if the
     header's structure makes it non-trivial.

5. **Tests**: `convex/messages.test.ts` — `startConversation` (success/creates new,
   success/reuses existing, self-message rejected, recipient-not-found rejected,
   blank-message rejected), `sendMessage` (success, non-participant rejected,
   rate-limit rejected, blank-content rejected, notification inserted for the other
   participant), `getConversations` (returns both buyer- and seller-side
   conversations with correct unread counts), `getMessages` (paginated, non-
   participant rejected), `markRead` (marks only the other party's unread messages,
   non-participant rejected). Follow `convex/profileFlags.test.ts`'s/
   `convex/reviews.test.ts`'s mocking conventions. Add `src/pages/Profile.test.tsx`
   coverage for the enabled Contact Seller button + dialog + navigation-on-success.
   Add a new `src/pages/Messages.test.tsx` covering the inbox list and thread view
   (mock `useParams`/`useNavigate` from `react-router-dom` the same way other page
   tests in this repo already do — check an existing page test for the convention).

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument + return
  validators on every mutation/query, no `any` types, prefer indexes over `.filter()`.
- Do not touch `auth.config.ts`, CORS helpers, deployment config, or unrelated files.
- Do not implement admin flagged-conversation viewing (explicitly out of scope, see
  step 2 above).
- Follow this repo's existing code style, `ConvexError` messages, dialog/component
  patterns, and lazy-route conventions rather than inventing new ones.
- Bump `package.json` version per `AGENTS.md`'s semver section (this branch continues
  from `0.13.0` — a minor bump for this additive feature, or higher if warranted by a
  documented semver rule).

## Verification

Run these yourself and record actual results in the Results section — do not assume:

1. `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`
   AND `bun run type-check` — both must pass (husky's pre-commit hook uses the
   former; a mismatch here blocks the commit, as happened on issue #221's follow-up).
2. `npx convex dev --once` — deploys cleanly (schema change: new `conversations`,
   `messages` tables).
3. `bun run test --run` (full suite) — all green, including new/updated tests.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs the
   current HEAD of this branch (use a path-scoped `git stash` baseline comparison if
   needed, not `eslint --stdin` — see `codebase_notes.md`'s "Seller Reviews" section
   for why `--stdin` is unreliable on this repo's type-aware lint config).
5. Manually confirm (via diff) that `auctions`, `auctionFlags`, `reviews`,
   `profileFlags`, `profiles`, `notifications` table definitions in
   `convex/schema.ts` are unchanged, and that "Report Profile" (issue #232, already
   enabled) in `Profile.tsx` is untouched.

## Results

<!-- opencode: fill this in when done -->
