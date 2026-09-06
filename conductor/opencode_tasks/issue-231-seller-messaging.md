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

**Status: complete.** All 5 instruction steps implemented (with the schema deviation mandated in Context), all Verification items run with real results recorded below. Not committed — left uncommitted on `feat/issue-231-seller-messaging` for review.

### Schema deviation (as instructed by Context, documented here)

The issue's Implementation Plan proposes `conversations.participantIds: v.array(v.string())` with `.index("by_participant", ["participantIds"])`. **Not implemented.** As the task file's Context section mandates, every conversation is strictly two-party, so participants are modelled as two scalar fields — `buyerId: v.string()` and `sellerId: v.string()` — each with its own index (`by_buyer` = `[buyerId, lastMessageAt]`, `by_seller` = `[sellerId, lastMessageAt]`, plus `by_buyer_seller` for pair-reuse lookups). "Conversations for the current user" is derived as the union of the `by_buyer` and `by_seller` queries. A schema comment in `convex/schema.ts` documents why the array-field approach was rejected (Convex array-field indexes are not "contains" lookups).

### Files changed

| File                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`            | Added `conversations` + `messages` tables (exact definitions from step 1, including the extra `by_conversation_read` index the issue's schema omitted; required by `getConversations`' unread counts and `markRead`), inserted after `readReceipts` (adjacent to `notifications`), with a comment explaining the scalar buyer/seller modelling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `convex/messages.ts`          | **New.** `startConversationHandler`/`startConversation` (auth via `getAuthenticatedUserId`; self-message, blank-message, and missing-recipient-profile rejected with `ConvexError`s; reuses an existing conversation between the two users **in either direction** via `by_buyer_seller` `.unique()` (see CodeRabbit note below), else creates one; inserts the trimmed initial message; patches `lastMessageAt`; returns `v.id("conversations")`). `sendMessageHandler`/`sendMessage` (participant guard via shared `requireParticipant` helper — `ConvexError` "You are not a participant in this conversation"; blank content rejected; rate limit of 10 messages per sender per `MS_PER_MINUTE` enforced with a `by_sender` index range (`.eq("senderId").gte("createdAt", windowStart)`) and `>=` on the pre-send count; inserts message with `isRead: false`, patches `lastMessageAt`, inserts a `notifications` row for the other participant (`type: "info"`, title "New message", message includes sender's profile name when available, `link: "/messages/<conversationId>"`); returns `{ success }`). `getConversationsHandler`/`getConversations` (paginated public query — see pagination note below; other participant's id + name via `profiles.by_userId`, last-message preview via `by_conversation` desc `.first()`, unread count via `by_conversation_read` filtering out the caller's own messages). `getMessagesHandler`/`getMessages` (paginated public query, `by_conversation` desc matching `getSellerReviews`; participant guard throws `ConvexError`; each message carries a server-computed `isMine` flag). `markReadHandler`/`markRead` (participant guard; patches `isRead: true` on the other party's unread messages only via `by_conversation_read`; returns `{ success, markedCount }`). Admin flagged-conversation viewing intentionally **not** implemented (out of scope per step 2) |
| `src/pages/Profile.tsx`       | "Contact Seller" enabled for non-owners: stale `disabled`/`title="Coming soon - see issue #220"` and the `TODO(#220)` comment removed; button is now a `DialogTrigger`. Added a small dialog mirroring the Report Profile dialog structure (`Dialog`/`DialogContent`, single `Textarea` labelled "Message", Cancel/Send) plus `contactDialogOpen`/`contactMessage`/`isSendingMessage` state, `useMutation(api.messages.startConversation)`, `useNavigate`, and `handleContactSeller` (blank-message → `toast.error`; success → `toast.success("Message sent")` + `navigate("/messages/<conversationId>")`; failure → `toast.error` with the server message — no silent failures). **Report Profile dialog and its handler are untouched (verified via diff)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/pages/Messages.tsx`      | **New.** Single component handling both routes: `/messages` renders the inbox (`usePaginatedQuery` on `getConversations`, `initialNumItems: 20`; other participant's initials avatar + name, last-message preview, relative timestamp, unread count badge, Link per row, Load More when `CanLoadMore`); `/messages/:conversationId` renders the thread (`ConversationThread`): `usePaginatedQuery` on `getMessages` (`initialNumItems: 30`), messages displayed **oldest-first** (accumulated newest-first pages reversed), "Load Older Messages" at the top, sent/received bubble alignment via `isMine`, send box (Input + submit Button, disabled while sending or when draft is blank) wired to `sendMessage` with `toast.error` on failure, and `markRead` called on mount via `useEffect`. A local `ConversationErrorBoundary` wraps the thread: server `ConvexError`s (non-participant / missing conversation) render a "Conversation not found" state with a back link, any other error is re-thrown to the root `ErrorBoundary`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/App.tsx`                 | Lazy import for `Messages`; `/messages` and `/messages/:conversationId` routes wrapped in `<RoleProtectedRoute allowedRole="any">`; JSDoc route list updated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `convex/messages.test.ts`     | **New.** 24 tests following the `reviews.test.ts`/`profileFlags.test.ts` mocking conventions (`vi.mock("./lib/auth")`, per-table query-chain mocks): `startConversation` — creates new (insert shapes verified), reuses existing (patch + no conversations insert), reuses opposite-direction conversation, self-message rejected, recipient-not-found rejected, blank message rejected (both `""` and `"   "`); `sendMessage` — success (trimmed insert + `lastMessageAt` patch), notification shape for the other participant, non-participant rejected, 10-in-window rejected, 9-in-window allowed, `by_sender` index range asserted (`.eq("senderId")` + `.gte("createdAt", windowStart)`), blank content rejected; `getConversations` — buyer+seller sides returned with names/previews/unread counts (own unread messages excluded), merged sort by `lastMessageAt` desc across sides, empty page; `getMessages` — paginated page with `isMine` flags + cursor passthrough, non-participant rejected, missing conversation rejected; `markRead` — only the other party's unread messages patched (own left unread), zero-unread success, non-participant rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/pages/Profile.test.tsx`  | Added `messages.startConversation` to the api mock; "shows non-owner buttons" now asserts Contact Seller is enabled; new 6-test "Contact Seller dialog" suite (opens with message field + Send button, cancel closes, blank message → error toast, success → exact mutation args + success toast + navigation to a rendered `/messages/:conversationId` route, whitespace-only message rejected, mutation failure → error toast + stays on profile)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/pages/Messages.test.tsx` | **New.** 12 tests (`useParams`/`usePaginatedQuery`/`useMutation`/`sonner` mocked per repo conventions; `useParams` mocked via `vi.importActual` like `AuctionDetail.test.tsx`): inbox — loading, empty, list (names/previews/unread badge/timestamps), row hrefs, `loadMore(20)`; thread — oldest-first DOM order, `markRead` on mount with the route conversationId, send + input cleared, send disabled when draft empty, send-failure toast, `ConvexError` → "Conversation not found" + back link, non-Convex error re-thrown to the root boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `package.json`                | `0.13.0` → `0.14.0` (minor, additive feature, per AGENTS.md semver section)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `convex/_generated/api.d.ts`  | Regenerated by `npx convex dev --once` (new `messages` module + `conversations`/`messages` schema types) — generated file, not hand-edited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `codebase_notes.md`           | Added "Seller Messaging (issue #231)" section: scalar participant modelling rationale, merged cross-index pagination convention, why paginated queries can't return `null` for authz denials, rate-limit index-range approach, bidirectional conversation reuse, and a vitest mock gotcha about `mockResolvedValueOnce` queues inside per-call `withIndex` factories                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Design decisions & documented simplifications

- **`getConversations` cross-index pagination** — a single Convex query cannot span two indexes, so (as the task anticipated) there is no true cross-index cursor pagination. Rather than returning everything in one `isDone: true` page, `getConversationsHandler` follows the **existing in-repo convention** of `getMyNotificationsHandler` in `convex/notifications.ts`: both index queries are fetched with `.order("desc").take(100)` per side (`MAX_CONVERSATIONS_FETCHED_PER_SIDE = 100`), merged, sorted by `lastMessageAt` desc, and paginated with an offset cursor (`parseInt(cursor)` / `slice` / `String(end)`). Only the conversations on the requested page are enriched with the 3 per-conversation lookups (profile, last message, unread), keeping reads proportional to page size. Cost of the simplification: the list is capped at 100 conversations per side and a concurrent `lastMessageAt` change between pages can shift the offset window — both acceptable for an MVP inbox.
- **Thread not-found handling** — the task asked for a "Conversation not found" state when the query rejects for a non-participant. `usePaginatedQuery` throws query errors (a `null` return would also break its pagination bookkeeping), so `getMessages` throws `ConvexError("You are not a participant in this conversation")` (identical guard to `sendMessage`, and matching the task's "non-participant rejected" test requirement), and the page renders the thread inside a local `ConversationErrorBoundary` that maps `ConvexError` → the not-found state (AuctionDetail-style messaging) and re-throws anything else to the root boundary. This works because Convex's sync layer rehydrates server `ConvexError`s as real `ConvexError` instances on the client.
- **`isMine` on message pages** — `getMessages` attaches a server-computed `isMine` boolean to each message so the thread can align sent/received bubbles without an extra client-side profile lookup (precedent: `getSellerReviews` attaches the derived `reviewerName`).
- **Rate limit window check uses an index range** — the task suggested the profileFlags collect-then-filter-in-JS style, but the task's own Constraints say "prefer indexes over `.filter()`"; `by_sender` is `[senderId, createdAt]`, so the window is applied as `.gte("createdAt", windowStart)` with no JS filtering (flagged by CodeRabbit, fixed).
- **Rate-limit boundary is `>=`** — with the pre-send count, the task's literal "more than 10" would allow an 11th message inside the window, contradicting a 10-message budget; fixed to `>=` so the maximum is exactly 10 per minute (flagged by CodeRabbit, fixed).
- **Conversation reuse is bidirectional** — the task scoped reuse to the exact `(buyerId, sellerId)` pair, but that would create parallel threads when the seller later contacts the buyer who originally contacted them; `startConversation` now checks both directions via the same `by_buyer_seller` index (flagged by CodeRabbit, fixed).
- **Header nav entry not added** — the task listed this as a nice-to-have "only if small, low-risk". The header has two navigation surfaces (`UserDropdown.tsx` and `MobileMenu.tsx`), each with its own dedicated test file; a proper entry means new links in both plus test updates in both. That exceeds "small, low-risk", so per the task's explicit guidance it was skipped. Users reach `/messages` via the "New message" notification links (which deep-link to `/messages/<conversationId>`), the post-contact navigation in Profile.tsx, and direct URL. A follow-up issue can add the header entry to both surfaces.

### Verification results (all run, not assumed)

1. **Type checks — PASS.**
   - `bunx tsgo -p tsconfig.json --noEmit` → clean (husky pre-commit variant)
   - `bunx tsgo -p convex/tsconfig.json --noEmit` → clean
   - `bun run type-check` (`tsgo -b tsconfig.build.json --noEmit`) → clean
   - (Run order note: `npx convex dev --once` was executed before the type checks so `convex/_generated` contains the new tables/module types.)
2. **`npx convex dev --once` — PASS.** "✔ Convex functions ready! (5.92s)" on the initial push and "✔ Convex functions ready! (5.54s)" on the re-run after the CodeRabbit fixes — new `conversations`/`messages` tables + `messages` module deployed cleanly, no prompts, no errors.
3. **`bun run test --run` (full suite) — PASS.** 171 test files, **2110 tests passed, 0 failed** (up from 2068 after issue #232 on this branch: +24 `convex/messages.test.ts`, +6 Profile Contact-Seller tests, +12 Messages tests). Two iterations were needed: (a) a `getConversationsHandler` test mock recreated query chains inside a per-call `withIndex` factory, resetting `mockResolvedValueOnce` queues (fixed by building persistent chains); (b) `ConversationErrorBoundary` initially lacked a state initializer, crashing every thread-view test with "Cannot read properties of null (reading 'error')" (fixed with a constructor).
4. **`bunx eslint` on every touched/created file — PASS.** `convex/schema.ts`, `convex/messages.ts`, `convex/messages.test.ts`, `src/pages/Profile.tsx`, `src/pages/Profile.test.tsx`, `src/pages/Messages.tsx`, `src/pages/Messages.test.tsx`, `src/App.tsx`: **0 errors, 7 warnings**. Baseline check (path-scoped `git stash push -- src/pages/Profile.tsx src/pages/Profile.test.tsx`, lint HEAD versions, `git stash pop` — popped cleanly): identical 7 warnings on HEAD (6× `require-await` in Profile.test.tsx + 1× `no-unnecessary-condition` in Profile.tsx, shifted line numbers only). **Zero new warnings vs HEAD.** (`eslint --stdin` was not used — see `codebase_notes.md` "Seller Reviews" section. Note: the stash pop did not hit the `api.d.ts` regeneration issue this time.)
5. **Diff confirmation — PASS.**
   - `git diff convex/schema.ts` contains only the additive `conversations` + `messages` block after `readReceipts`; `auctions`, `auctionFlags`, `reviews`, `profileFlags`, `profiles`, `notifications` (and `readReceipts`) definitions are byte-identical.
   - In `src/pages/Profile.tsx` the only removed lines are the `useParams, Link` import (modified to add `useNavigate`), the stale `TODO(#220)` comment, and the disabled Contact Seller button; the Report Profile dialog, `handleReportProfile`, and the untouched `Complete Verification` (`#219`) button are context-only in the diff.
6. **CodeRabbit pre-commit review (AGENTS.md §8) — PASS after fixes.** Note: the installed CLI no longer supports `--prompt-only`; used `bunx coderabbit review --uncommitted --include-untracked --agent` instead. First run: 2 major + 1 minor (bidirectional conversation reuse; index-range rate limit; `>=` boundary) — all three assessed as valid and fixed (see Design decisions). Re-run: **0 findings** across all 10 changed files.
