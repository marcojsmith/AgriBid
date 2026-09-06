// app/convex/messages.ts
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";
import { MS_PER_MINUTE } from "./constants";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Window (in milliseconds) used for the per-sender message rate limit.
 * Senders may post at most MESSAGE_RATE_LIMIT_MAX messages per window.
 */
const MESSAGE_RATE_LIMIT_WINDOW_MS = MS_PER_MINUTE;

/**
 * Maximum number of messages a sender may post within the rate-limit window.
 */
const MESSAGE_RATE_LIMIT_MAX = 10; /**
 * Upper bound on how many conversations are fetched per index (buyer side and
 * seller side) when building the caller's conversation list. A single Convex
 * query cannot span two indexes, so both sides are fetched, merged and sorted
 * in JS instead of using true cross-index cursor pagination.
 */
const MAX_CONVERSATIONS_FETCHED_PER_SIDE = 100;

/**
 * Shared guard: ensures the conversation exists and the caller participates in
 * it (as buyer or seller).
 *
 * @param ctx - Query or Mutation context used to load the conversation
 * @param conversationId - The conversation to load
 * @param callerId - The authenticated caller's user ID
 * @returns The conversation document
 * @throws ConvexError("Conversation not found") when it does not exist
 * @throws ConvexError("You are not a participant in this conversation") when the caller is not the buyer or seller
 */
async function requireParticipant(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  callerId: string
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new ConvexError("Conversation not found");
  }
  if (conversation.buyerId !== callerId && conversation.sellerId !== callerId) {
    throw new ConvexError("You are not a participant in this conversation");
  }
  return conversation;
}

/**
 * Handler for starting (or reusing) a conversation with another user.
 * The caller is the buyer/initiator. If a conversation already exists between
 * the two users (in either direction) it is reused, otherwise a new one is
 * created; the initial message is inserted either way.
 *
 * @param ctx - Mutation context
 * @param args - Arguments for starting a conversation
 * @param args.recipientId - The userId of the seller being contacted
 * @param args.initialMessage - The first message content (must be non-blank)
 * @param args.auctionId - Optional auction the conversation is about
 * @returns The conversation ID
 */
export const startConversationHandler = async (
  ctx: MutationCtx,
  args: {
    recipientId: string;
    initialMessage: string;
    auctionId?: Id<"auctions">;
  }
): Promise<Id<"conversations">> => {
  const buyerId = await getAuthenticatedUserId(ctx);

  if (args.recipientId === buyerId) {
    throw new ConvexError("You cannot message yourself");
  }

  if (args.initialMessage.trim().length === 0) {
    throw new ConvexError("Message cannot be empty");
  }

  const recipientProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
    .unique();

  if (!recipientProfile) {
    throw new ConvexError("Profile not found");
  }

  const now = Date.now();

  // Reuse an existing conversation between the two users in either direction
  // so reversed contact initiation cannot create a parallel thread.
  const [asBuyer, asSeller] = await Promise.all([
    ctx.db
      .query("conversations")
      .withIndex("by_buyer_seller", (q) =>
        q.eq("buyerId", buyerId).eq("sellerId", args.recipientId)
      )
      .unique(),
    ctx.db
      .query("conversations")
      .withIndex("by_buyer_seller", (q) =>
        q.eq("buyerId", args.recipientId).eq("sellerId", buyerId)
      )
      .unique(),
  ]);

  const existing = asBuyer ?? asSeller;

  let conversationId: Id<"conversations">;
  if (existing) {
    conversationId = existing._id;
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  } else {
    conversationId = await ctx.db.insert("conversations", {
      buyerId,
      sellerId: args.recipientId,
      auctionId: args.auctionId,
      lastMessageAt: now,
      createdAt: now,
    });
  }

  await ctx.db.insert("messages", {
    conversationId,
    senderId: buyerId,
    content: args.initialMessage.trim(),
    isRead: false,
    createdAt: now,
  });

  return conversationId;
};

/**
 * Start (or reuse) a conversation with a seller and send the initial message.
 * The caller is the buyer/initiator; existing conversations between the two
 * users (in either direction) are reused.
 */
export const startConversation = mutation({
  args: {
    recipientId: v.string(),
    initialMessage: v.string(),
    auctionId: v.optional(v.id("auctions")),
  },
  returns: v.id("conversations"),
  handler: startConversationHandler,
});

/**
 * Handler for sending a message in an existing conversation.
 * Rejects non-participants, blank content, and senders exceeding the
 * per-minute rate limit. Patches the conversation's lastMessageAt and notifies
 * the other participant.
 *
 * @param ctx - Mutation context
 * @param args - Arguments for sending a message
 * @param args.conversationId - The conversation to send the message in
 * @param args.content - The message content (must be non-blank)
 * @returns Object with success boolean
 */
export const sendMessageHandler = async (
  ctx: MutationCtx,
  args: { conversationId: Id<"conversations">; content: string }
): Promise<{ success: boolean }> => {
  const senderId = await getAuthenticatedUserId(ctx);

  const conversation = await requireParticipant(
    ctx,
    args.conversationId,
    senderId
  );

  if (args.content.trim().length === 0) {
    throw new ConvexError("Message cannot be empty");
  }

  const windowStart = Date.now() - MESSAGE_RATE_LIMIT_WINDOW_MS;
  const recentMessages = await ctx.db
    .query("messages")
    .withIndex("by_sender", (q) =>
      q.eq("senderId", senderId).gte("createdAt", windowStart)
    )
    .collect();

  if (recentMessages.length >= MESSAGE_RATE_LIMIT_MAX) {
    throw new ConvexError(
      "You are sending messages too quickly. Please wait a moment before trying again."
    );
  }

  const now = Date.now();
  const recipientId =
    conversation.buyerId === senderId
      ? conversation.sellerId
      : conversation.buyerId;

  await ctx.db.insert("messages", {
    conversationId: args.conversationId,
    senderId,
    content: args.content.trim(),
    isRead: false,
    createdAt: now,
  });

  await ctx.db.patch(args.conversationId, { lastMessageAt: now });

  const senderProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", senderId))
    .unique();

  await ctx.db.insert("notifications", {
    recipientId,
    type: "info",
    title: "New message",
    message: senderProfile?.name
      ? `You have a new message from ${senderProfile.name}`
      : "You have a new message",
    link: `/messages/${args.conversationId}`,
    isRead: false,
    createdAt: now,
  });

  return { success: true };
};

/**
 * Send a message in a conversation the caller participates in.
 * Rate limited to 10 messages per minute per sender; notifies the other
 * participant.
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: sendMessageHandler,
});

/**
 * Handler for listing the caller's conversations (as buyer or seller),
 * most recently active first. Each entry includes the other participant's
 * id/name, a preview of the last message, and the caller's unread count.
 *
 * A single Convex query cannot span two indexes, so — following the merged
 * list + offset-cursor convention already used for notifications in
 * `convex/notifications.ts` — the buyer-side and seller-side lists are fetched
 * independently (capped per side), merged, sorted in JS, and paginated with an
 * offset cursor. Only the conversations on the requested page are enriched
 * with profile/preview/unread-count lookups.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @returns Paginated-shaped result containing the caller's conversations
 */
export const getConversationsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  const callerId = await getAuthenticatedUserId(ctx);

  const [buyerSide, sellerSide] = await Promise.all([
    ctx.db
      .query("conversations")
      .withIndex("by_buyer", (q) => q.eq("buyerId", callerId))
      .order("desc")
      .take(MAX_CONVERSATIONS_FETCHED_PER_SIDE),
    ctx.db
      .query("conversations")
      .withIndex("by_seller", (q) => q.eq("sellerId", callerId))
      .order("desc")
      .take(MAX_CONVERSATIONS_FETCHED_PER_SIDE),
  ]);

  const sorted = [...buyerSide, ...sellerSide].sort(
    (a, b) => b.lastMessageAt - a.lastMessageAt
  );

  const startIndex = args.paginationOpts.cursor
    ? parseInt(args.paginationOpts.cursor, 10)
    : 0;
  const end = startIndex + args.paginationOpts.numItems;
  const isDone = end >= sorted.length;
  const continueCursor = isDone ? "" : String(end);

  const page = await Promise.all(
    sorted.slice(startIndex, end).map(async (conversation) => {
      const otherParticipantId =
        conversation.buyerId === callerId
          ? conversation.sellerId
          : conversation.buyerId;

      const [profile, lastMessage, unread] = await Promise.all([
        ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", otherParticipantId))
          .unique(),
        ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .first(),
        ctx.db
          .query("messages")
          .withIndex("by_conversation_read", (q) =>
            q.eq("conversationId", conversation._id).eq("isRead", false)
          )
          .collect(),
      ]);

      return {
        _id: conversation._id,
        _creationTime: conversation._creationTime,
        buyerId: conversation.buyerId,
        sellerId: conversation.sellerId,
        auctionId: conversation.auctionId,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        otherParticipantId,
        otherParticipantName: profile?.name,
        lastMessagePreview: lastMessage?.content,
        unreadCount: unread.filter((message) => message.senderId !== callerId)
          .length,
      };
    })
  );

  return {
    page,
    isDone,
    continueCursor,
  };
};

/**
 * Query: Get the caller's conversations (as buyer or seller), with the other
 * participant's name, last-message preview and unread count attached.
 * Args: paginationOpts
 */
export const getConversations = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("conversations"),
        _creationTime: v.number(),
        buyerId: v.string(),
        sellerId: v.string(),
        auctionId: v.optional(v.id("auctions")),
        lastMessageAt: v.number(),
        createdAt: v.number(),
        otherParticipantId: v.string(),
        otherParticipantName: v.optional(v.string()),
        lastMessagePreview: v.optional(v.string()),
        unreadCount: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: getConversationsHandler,
});

/**
 * Handler for a paginated page of messages in a conversation the caller
 * participates in, newest first (matching getSellerReviews). Each message
 * carries an `isMine` flag so the client can align sent vs received messages.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.conversationId - The conversation to fetch messages for
 * @param args.paginationOpts - Pagination options
 * @returns Paginated messages, newest first
 */
export const getMessagesHandler = async (
  ctx: QueryCtx,
  args: {
    conversationId: Id<"conversations">;
    paginationOpts: PaginationOptions;
  }
) => {
  const callerId = await getAuthenticatedUserId(ctx);

  await requireParticipant(ctx, args.conversationId, callerId);

  const results = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", args.conversationId)
    )
    .order("desc")
    .paginate(args.paginationOpts);

  const page = results.page.map((message) => ({
    _id: message._id,
    _creationTime: message._creationTime,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    isRead: message.isRead,
    createdAt: message.createdAt,
    isMine: message.senderId === callerId,
  }));

  return {
    page,
    isDone: results.isDone,
    continueCursor: results.continueCursor,
  };
};

/**
 * Query: Get a paginated page of messages in a conversation (newest first).
 * Only participants may read a conversation's messages.
 * Args: conversationId, paginationOpts
 */
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("messages"),
        _creationTime: v.number(),
        conversationId: v.id("conversations"),
        senderId: v.string(),
        content: v.string(),
        isRead: v.boolean(),
        createdAt: v.number(),
        isMine: v.boolean(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: getMessagesHandler,
});

/**
 * Handler for marking all of the other participant's unread messages in a
 * conversation as read.
 *
 * @param ctx - Mutation context
 * @param args - Arguments for marking messages read
 * @param args.conversationId - The conversation to mark as read
 * @returns Object with success boolean and the number of messages marked
 */
export const markReadHandler = async (
  ctx: MutationCtx,
  args: { conversationId: Id<"conversations"> }
): Promise<{ success: boolean; markedCount: number }> => {
  const callerId = await getAuthenticatedUserId(ctx);

  await requireParticipant(ctx, args.conversationId, callerId);

  const unreadMessages = await ctx.db
    .query("messages")
    .withIndex("by_conversation_read", (q) =>
      q.eq("conversationId", args.conversationId).eq("isRead", false)
    )
    .collect();

  const toMark = unreadMessages.filter(
    (message) => message.senderId !== callerId
  );

  for (const message of toMark) {
    await ctx.db.patch(message._id, { isRead: true });
  }

  return { success: true, markedCount: toMark.length };
};

/**
 * Mutation: Mark all of the other participant's unread messages in a
 * conversation as read. Only participants may mark a conversation read.
 * Args: conversationId
 */
export const markRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.object({ success: v.boolean(), markedCount: v.number() }),
  handler: markReadHandler,
});
