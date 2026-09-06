import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  startConversationHandler,
  sendMessageHandler,
  getConversationsHandler,
  getMessagesHandler,
  markReadHandler,
} from "./messages";
import * as auth from "./lib/auth";
import { MS_PER_MINUTE } from "./constants";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

type MockDb = {
  get: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
};

type MockMutationCtx = {
  db: MockDb;
} & Partial<MutationCtx>;

type MockQueryCtx = {
  db: MockDb;
} & Partial<QueryCtx>;

const setupMockCtx = (tables: Record<string, unknown>) => {
  const tableQueries = new Map(Object.entries(tables));
  const mockDb: MockDb = {
    get: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    query: vi.fn((table: string) => {
      const tableQuery = tableQueries.get(table);
      if (!tableQuery) {
        throw new Error(`Unexpected table queried: ${table}`);
      }
      return tableQuery;
    }),
  };
  return { db: mockDb } as unknown as MockMutationCtx & MockQueryCtx;
};

describe("startConversation mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupCtx = ({
    recipientProfile = { userId: "user_seller", name: "Seph Seller" },
    existingConversation = null,
    newConversationId = "conv123",
  }: {
    recipientProfile?: unknown;
    existingConversation?: unknown;
    newConversationId?: string;
  } = {}) => {
    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(recipientProfile),
    };
    const conversationsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(existingConversation),
    };
    mockCtx = setupMockCtx({
      profiles: profilesQuery,
      conversations: conversationsQuery,
    }) as MockMutationCtx;
    mockCtx.db.insert
      .mockResolvedValueOnce(newConversationId)
      .mockResolvedValue("msg1");
    return { profilesQuery, conversationsQuery };
  };

  it("should create a new conversation and insert the initial message", async () => {
    setupCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await startConversationHandler(
      mockCtx as unknown as MutationCtx,
      {
        recipientId: "user_seller",
        initialMessage: "Hi, is the tractor still available?",
        auctionId: "auction1" as Id<"auctions">,
      }
    );

    expect(result).toBe("conv123");
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "conversations",
      expect.objectContaining({
        buyerId: "user_buyer",
        sellerId: "user_seller",
        auctionId: "auction1",
      })
    );
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "messages",
      expect.objectContaining({
        conversationId: "conv123",
        senderId: "user_buyer",
        content: "Hi, is the tractor still available?",
        isRead: false,
      })
    );
  });

  it("should reuse an existing conversation between the same buyer and seller", async () => {
    const existing = {
      _id: "conv_existing",
      buyerId: "user_buyer",
      sellerId: "user_seller",
      lastMessageAt: 1000,
    };
    setupCtx({ existingConversation: existing });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await startConversationHandler(
      mockCtx as unknown as MutationCtx,
      {
        recipientId: "user_seller",
        initialMessage: "Following up on my earlier question",
      }
    );

    expect(result).toBe("conv_existing");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("conv_existing", {
      lastMessageAt: expect.any(Number) as number,
    });
    expect(mockCtx.db.insert).not.toHaveBeenCalledWith(
      "conversations",
      expect.anything()
    );
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "messages",
      expect.objectContaining({
        conversationId: "conv_existing",
        senderId: "user_buyer",
        content: "Following up on my earlier question",
      })
    );
  });

  it("should reuse a conversation created in the opposite direction", async () => {
    const existing = {
      _id: "conv_reversed",
      buyerId: "user_seller",
      sellerId: "user_buyer",
      lastMessageAt: 1000,
    };
    const { conversationsQuery } = setupCtx({
      existingConversation: null,
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    // First conversation lookup (caller as buyer) finds nothing; second
    // (caller as seller) finds the existing reversed conversation.
    conversationsQuery.unique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    const result = await startConversationHandler(
      mockCtx as unknown as MutationCtx,
      {
        recipientId: "user_seller",
        initialMessage: "Reaching out from my side too",
      }
    );

    expect(result).toBe("conv_reversed");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("conv_reversed", {
      lastMessageAt: expect.any(Number) as number,
    });
    expect(mockCtx.db.insert).not.toHaveBeenCalledWith(
      "conversations",
      expect.anything()
    );
  });

  it("should reject messaging yourself", async () => {
    setupCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await expect(
      startConversationHandler(mockCtx as unknown as MutationCtx, {
        recipientId: "user_buyer",
        initialMessage: "Hello me",
      })
    ).rejects.toThrow("You cannot message yourself");
  });

  it("should reject when the recipient profile does not exist", async () => {
    setupCtx({ recipientProfile: null });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await expect(
      startConversationHandler(mockCtx as unknown as MutationCtx, {
        recipientId: "user_ghost",
        initialMessage: "Hello?",
      })
    ).rejects.toThrow("Profile not found");
  });

  it.each(["", "   "])(
    "should reject blank or whitespace-only initial message %s",
    async (initialMessage) => {
      setupCtx();
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

      await expect(
        startConversationHandler(mockCtx as unknown as MutationCtx, {
          recipientId: "user_seller",
          initialMessage,
        })
      ).rejects.toThrow("Message cannot be empty");
    }
  );
});

describe("sendMessage mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupCtx = ({
    conversation = {
      _id: "conv123",
      buyerId: "user_buyer",
      sellerId: "user_seller",
    },
    recentMessages = [],
    senderProfile = { userId: "user_buyer", name: "Ben Buyer" } as unknown,
  }: {
    conversation?: unknown;
    recentMessages?: Array<{ createdAt: number }>;
    senderProfile?: unknown;
  } = {}) => {
    const messagesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(recentMessages),
    };
    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(senderProfile),
    };
    mockCtx = setupMockCtx({
      messages: messagesQuery,
      profiles: profilesQuery,
    }) as MockMutationCtx;
    mockCtx.db.get.mockResolvedValue(conversation);
    mockCtx.db.insert.mockResolvedValue("msg1");
    return { messagesQuery };
  };

  it("should send a message, update lastMessageAt, and notify the other participant", async () => {
    setupCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await sendMessageHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
      content: "  Hi there  ",
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "messages",
      expect.objectContaining({
        conversationId: "conv123",
        senderId: "user_buyer",
        content: "Hi there",
        isRead: false,
      })
    );
    expect(mockCtx.db.patch).toHaveBeenCalledWith("conv123", {
      lastMessageAt: expect.any(Number) as number,
    });
  });

  it("should insert a notification for the other participant", async () => {
    setupCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await sendMessageHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
      content: "Hi there",
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        recipientId: "user_seller",
        type: "info",
        title: "New message",
        message: "You have a new message from Ben Buyer",
        link: "/messages/conv123",
        isRead: false,
      })
    );
  });

  it("should reject a non-participant", async () => {
    setupCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_outsider");

    await expect(
      sendMessageHandler(mockCtx as unknown as MutationCtx, {
        conversationId: "conv123" as Id<"conversations">,
        content: "Let me in",
      })
    ).rejects.toThrow("You are not a participant in this conversation");
  });

  it("should reject when 10 messages were already sent in the last minute", async () => {
    const now = Date.now();
    const recentMessages = Array.from({ length: 10 }, (_, i) => ({
      createdAt: now - i * 1000,
    }));
    setupCtx({ recentMessages });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await expect(
      sendMessageHandler(mockCtx as unknown as MutationCtx, {
        conversationId: "conv123" as Id<"conversations">,
        content: "Spam",
      })
    ).rejects.toThrow(
      "You are sending messages too quickly. Please wait a moment before trying again."
    );
  });

  it("should allow the 10th message when 9 were sent in the last minute", async () => {
    const now = Date.now();
    const recentMessages = Array.from({ length: 9 }, (_, i) => ({
      createdAt: now - i * 1000,
    }));
    setupCtx({ recentMessages });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await sendMessageHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
      content: "Tenth",
    });

    expect(result.success).toBe(true);
  });

  it("should scope the rate-limit lookup to the window via the by_sender index range", async () => {
    const rangeRecorder = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    };
    const messagesQuery = {
      withIndex: vi.fn(
        (_indexName: string, filter: (q: unknown) => unknown) => {
          filter(rangeRecorder);
          return { collect: vi.fn().mockResolvedValue([]) };
        }
      ),
    };
    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({ userId: "user_buyer", name: "Ben" }),
    };
    mockCtx = setupMockCtx({
      messages: messagesQuery,
      profiles: profilesQuery,
    }) as MockMutationCtx;
    mockCtx.db.get.mockResolvedValue({
      _id: "conv123",
      buyerId: "user_buyer",
      sellerId: "user_seller",
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await sendMessageHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
      content: "Hi there",
    });

    expect(messagesQuery.withIndex).toHaveBeenCalledWith(
      "by_sender",
      expect.any(Function)
    );
    expect(rangeRecorder.eq).toHaveBeenCalledWith("senderId", "user_buyer");
    expect(rangeRecorder.gte).toHaveBeenCalledWith(
      "createdAt",
      expect.any(Number) as number
    );
    const gteArg = rangeRecorder.gte.mock.calls[0]?.[1] as number;
    expect(Math.abs(Date.now() - MS_PER_MINUTE - gteArg)).toBeLessThan(2000);
  });

  it.each(["", "   "])(
    "should reject blank or whitespace-only content %s",
    async (content) => {
      setupCtx();
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

      await expect(
        sendMessageHandler(mockCtx as unknown as MutationCtx, {
          conversationId: "conv123" as Id<"conversations">,
          content,
        })
      ).rejects.toThrow("Message cannot be empty");
    }
  );
});

describe("getConversations query", () => {
  let mockCtx: MockQueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return buyer- and seller-side conversations with unread counts", async () => {
    const buyerSideConversation = {
      _id: "conv_as_buyer",
      _creationTime: 100,
      buyerId: "user_me",
      sellerId: "user_seller",
      auctionId: undefined,
      lastMessageAt: 2000,
      createdAt: 100,
    };
    const sellerSideConversation = {
      _id: "conv_as_seller",
      _creationTime: 200,
      buyerId: "user_buyer",
      sellerId: "user_me",
      auctionId: "auction9",
      lastMessageAt: 1000,
      createdAt: 200,
    };

    const recentChain = {
      order: vi.fn().mockReturnThis(),
      first: vi
        .fn()
        .mockResolvedValueOnce({ content: "Hello there" })
        .mockResolvedValueOnce({ content: "Is it available" }),
    };
    const readChain = {
      collect: vi
        .fn()
        .mockResolvedValueOnce([
          { senderId: "user_seller", isRead: false },
          { senderId: "user_me", isRead: false },
        ])
        .mockResolvedValueOnce([{ senderId: "user_buyer", isRead: false }]),
    };

    const conversationsQuery = {
      withIndex: vi.fn((indexName: string) => {
        if (indexName === "by_buyer") {
          return {
            order: vi.fn().mockReturnThis(),
            take: vi.fn().mockResolvedValue([buyerSideConversation]),
          };
        }
        return {
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([sellerSideConversation]),
        };
      }),
    };

    const messagesQuery = {
      withIndex: vi.fn((indexName: string) =>
        indexName === "by_conversation_read" ? readChain : recentChain
      ),
    };

    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user_seller", name: "Seph Seller" })
        .mockResolvedValueOnce({ userId: "user_buyer", name: "Ben Buyer" }),
    };

    mockCtx = setupMockCtx({
      conversations: conversationsQuery,
      messages: messagesQuery,
      profiles: profilesQuery,
    }) as unknown as MockQueryCtx;
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_me");

    const result = await getConversationsHandler(
      mockCtx as unknown as QueryCtx,
      { paginationOpts: { numItems: 20, cursor: null } }
    );

    expect(conversationsQuery.withIndex).toHaveBeenCalledWith(
      "by_buyer",
      expect.any(Function)
    );
    expect(conversationsQuery.withIndex).toHaveBeenCalledWith(
      "by_seller",
      expect.any(Function)
    );
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBe("");
    expect(result.page).toHaveLength(2);
    expect(result.page[0]).toMatchObject({
      _id: "conv_as_buyer",
      otherParticipantId: "user_seller",
      otherParticipantName: "Seph Seller",
      lastMessagePreview: "Hello there",
      unreadCount: 1,
    });
    expect(result.page[1]).toMatchObject({
      _id: "conv_as_seller",
      otherParticipantId: "user_buyer",
      otherParticipantName: "Ben Buyer",
      lastMessagePreview: "Is it available",
      unreadCount: 1,
    });
  });

  it("should sort conversations by lastMessageAt descending regardless of side", async () => {
    const newerSellerSide = {
      _id: "conv_seller_new",
      _creationTime: 1,
      buyerId: "user_buyer",
      sellerId: "user_me",
      lastMessageAt: 5000,
    };
    const olderBuyerSide = {
      _id: "conv_buyer_old",
      _creationTime: 2,
      buyerId: "user_me",
      sellerId: "user_seller",
      lastMessageAt: 1000,
    };

    const conversationsQuery = {
      withIndex: vi.fn((indexName: string) => {
        if (indexName === "by_buyer") {
          return {
            order: vi.fn().mockReturnThis(),
            take: vi.fn().mockResolvedValue([olderBuyerSide]),
          };
        }
        return {
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([newerSellerSide]),
        };
      }),
    };

    const messagesQuery = {
      withIndex: vi.fn((indexName: string) => {
        if (indexName === "by_conversation_read") {
          return { collect: vi.fn().mockResolvedValue([]) };
        }
        return {
          order: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        };
      }),
    };

    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null),
    };

    mockCtx = setupMockCtx({
      conversations: conversationsQuery,
      messages: messagesQuery,
      profiles: profilesQuery,
    }) as unknown as MockQueryCtx;
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_me");

    const result = await getConversationsHandler(
      mockCtx as unknown as QueryCtx,
      { paginationOpts: { numItems: 20, cursor: null } }
    );

    expect(result.page.map((c) => c._id)).toEqual([
      "conv_seller_new",
      "conv_buyer_old",
    ]);
  });

  it("should return an empty page when the caller has no conversations", async () => {
    const conversationsQuery = {
      withIndex: vi.fn(() => ({
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue([]),
      })),
    };

    mockCtx = setupMockCtx({
      conversations: conversationsQuery,
    }) as unknown as MockQueryCtx;
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_me");

    const result = await getConversationsHandler(
      mockCtx as unknown as QueryCtx,
      { paginationOpts: { numItems: 20, cursor: null } }
    );

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });
});

describe("getMessages query", () => {
  let mockCtx: MockQueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupCtx = (conversation: unknown) => {
    const messagesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: [
          {
            _id: "msg2",
            _creationTime: 200,
            conversationId: "conv123",
            senderId: "user_seller",
            content: "Yes, still available",
            isRead: true,
            createdAt: 200,
          },
          {
            _id: "msg1",
            _creationTime: 100,
            conversationId: "conv123",
            senderId: "user_buyer",
            content: "Is it available?",
            isRead: true,
            createdAt: 100,
          },
        ],
        isDone: false,
        continueCursor: "cursor1",
      }),
    };

    mockCtx = setupMockCtx({
      messages: messagesQuery,
    }) as unknown as MockQueryCtx;
    mockCtx.db.get.mockResolvedValue(conversation);
    return { messagesQuery };
  };

  it("should return a paginated page of messages with isMine flags", async () => {
    setupCtx({
      _id: "conv123",
      buyerId: "user_buyer",
      sellerId: "user_seller",
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await getMessagesHandler(mockCtx as unknown as QueryCtx, {
      conversationId: "conv123" as Id<"conversations">,
      paginationOpts: { numItems: 30, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.page[0]).toMatchObject({
      _id: "msg2",
      senderId: "user_seller",
      isMine: false,
    });
    expect(result.page[1]).toMatchObject({
      _id: "msg1",
      senderId: "user_buyer",
      isMine: true,
    });
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBe("cursor1");
  });

  it("should reject a non-participant", async () => {
    setupCtx({ _id: "conv123", buyerId: "user_a", sellerId: "user_b" });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_outsider");

    await expect(
      getMessagesHandler(mockCtx as unknown as QueryCtx, {
        conversationId: "conv123" as Id<"conversations">,
        paginationOpts: { numItems: 30, cursor: null },
      })
    ).rejects.toThrow("You are not a participant in this conversation");
  });

  it("should reject when the conversation does not exist", async () => {
    setupCtx(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    await expect(
      getMessagesHandler(mockCtx as unknown as QueryCtx, {
        conversationId: "conv_missing" as Id<"conversations">,
        paginationOpts: { numItems: 30, cursor: null },
      })
    ).rejects.toThrow(ConvexError);
  });
});

describe("markRead mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupCtx = (conversation: unknown, unreadMessages: unknown[]) => {
    const messagesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(unreadMessages),
    };
    mockCtx = setupMockCtx({
      messages: messagesQuery,
    }) as unknown as MockMutationCtx;
    mockCtx.db.get.mockResolvedValue(conversation);
  };

  it("should mark only the other party's unread messages as read", async () => {
    setupCtx(
      { _id: "conv123", buyerId: "user_buyer", sellerId: "user_seller" },
      [
        { _id: "m1", senderId: "user_seller", isRead: false },
        { _id: "m2", senderId: "user_buyer", isRead: false },
        { _id: "m3", senderId: "user_seller", isRead: false },
      ]
    );
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await markReadHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
    });

    expect(result).toEqual({ success: true, markedCount: 2 });
    expect(mockCtx.db.patch).toHaveBeenCalledTimes(2);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("m1", { isRead: true });
    expect(mockCtx.db.patch).toHaveBeenCalledWith("m3", { isRead: true });
    expect(mockCtx.db.patch).not.toHaveBeenCalledWith("m2", { isRead: true });
  });

  it("should succeed with zero marked messages when nothing is unread", async () => {
    setupCtx(
      { _id: "conv123", buyerId: "user_buyer", sellerId: "user_seller" },
      []
    );
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_buyer");

    const result = await markReadHandler(mockCtx as unknown as MutationCtx, {
      conversationId: "conv123" as Id<"conversations">,
    });

    expect(result).toEqual({ success: true, markedCount: 0 });
    expect(mockCtx.db.patch).not.toHaveBeenCalled();
  });

  it("should reject a non-participant", async () => {
    setupCtx({ _id: "conv123", buyerId: "user_a", sellerId: "user_b" }, []);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_outsider");

    await expect(
      markReadHandler(mockCtx as unknown as MutationCtx, {
        conversationId: "conv123" as Id<"conversations">,
      })
    ).rejects.toThrow("You are not a participant in this conversation");
  });
});
