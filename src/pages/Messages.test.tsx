import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, useParams } from "react-router-dom";
import { usePaginatedQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { HelmetProvider } from "react-helmet-async";

import Messages from "./Messages";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    messages: {
      getConversations: { name: "messages:getConversations" },
      getMessages: { name: "messages:getMessages" },
      sendMessage: { name: "messages:sendMessage" },
      markRead: { name: "messages:markRead" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

interface MockConversation {
  _id: string;
  _creationTime: number;
  buyerId: string;
  sellerId: string;
  auctionId: undefined;
  lastMessageAt: number;
  createdAt: number;
  otherParticipantId: string;
  otherParticipantName: string | undefined;
  lastMessagePreview: string;
  unreadCount: number;
}

const mockConversations: MockConversation[] = [
  {
    _id: "conv1",
    _creationTime: 100,
    buyerId: "user_me",
    sellerId: "user_seller",
    auctionId: undefined,
    lastMessageAt: Date.now() - 5 * 60_000,
    createdAt: 100,
    otherParticipantId: "user_seller",
    otherParticipantName: "Seph Seller",
    lastMessagePreview: "Hello there",
    unreadCount: 3,
  },
  {
    _id: "conv2",
    _creationTime: 200,
    buyerId: "user_buyer",
    sellerId: "user_me",
    auctionId: undefined,
    lastMessageAt: Date.now() - 3 * 60 * 60_000,
    createdAt: 200,
    otherParticipantId: "user_buyer",
    otherParticipantName: "Ben Buyer",
    lastMessagePreview: "Is it available",
    unreadCount: 0,
  },
];

const inboxResult = (
  overrides: Partial<{
    results: typeof mockConversations;
    status: string;
    loadMore: (numItems: number) => void;
  }> = {}
) => ({
  results: mockConversations,
  status: "Exhausted",
  loadMore: vi.fn(),
  ...overrides,
});

const mockThreadMessages = [
  {
    _id: "msg2",
    _creationTime: 200,
    conversationId: "conv1",
    senderId: "user_seller",
    content: "Yes, still available",
    isRead: true,
    createdAt: 200,
    isMine: false,
  },
  {
    _id: "msg1",
    _creationTime: 100,
    conversationId: "conv1",
    senderId: "user_me",
    content: "Is it available?",
    isRead: true,
    createdAt: 100,
    isMine: true,
  },
];

const threadResult = (
  overrides: Partial<{
    results: typeof mockThreadMessages;
    status: string;
    loadMore: (numItems: number) => void;
  }> = {}
) => ({
  results: mockThreadMessages,
  status: "Exhausted",
  loadMore: vi.fn(),
  ...overrides,
});

describe("Messages Page — inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({});
    (useMutation as Mock).mockReturnValue(vi.fn().mockResolvedValue({}));
    (usePaginatedQuery as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.getConversations) {
        return inboxResult();
      }
      return threadResult();
    });
  });

  const renderMessages = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Messages />
        </MemoryRouter>
      </HelmetProvider>
    );

  it("sets page title and noindex meta tag", async () => {
    renderMessages();
    await waitFor(() => {
      expect(document.title).toBe("Messages | AgriBid");
    });
    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta).toBeInTheDocument();
    expect(robotsMeta?.getAttribute("content")).toBe("noindex");
  });

  it("renders loading state", () => {
    (usePaginatedQuery as Mock).mockImplementation(() =>
      inboxResult({ status: "LoadingFirstPage" })
    );
    renderMessages();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders empty state when there are no conversations", () => {
    (usePaginatedQuery as Mock).mockImplementation(() =>
      inboxResult({ results: [] })
    );
    renderMessages();
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Contact a seller from their profile/i)
    ).toBeInTheDocument();
  });

  it("renders the conversation list with names, previews and unread badges", () => {
    renderMessages();

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Seph Seller")).toBeInTheDocument();
    expect(screen.getByText("Ben Buyer")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Is it available")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5m")).toBeInTheDocument();
    expect(screen.getByText("3h")).toBeInTheDocument();
  });

  it("links each conversation to its thread", () => {
    renderMessages();

    expect(
      screen.getByRole("link", { name: /Seph Seller/i }).getAttribute("href")
    ).toBe("/messages/conv1");
    expect(
      screen.getByRole("link", { name: /Ben Buyer/i }).getAttribute("href")
    ).toBe("/messages/conv2");
  });

  it("calls loadMore(20) when the Load More button is clicked", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockImplementation(() =>
      inboxResult({ status: "CanLoadMore", loadMore })
    );

    renderMessages();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(loadMore).toHaveBeenCalledWith(20);
  });

  it("renders relative timestamps across every bucket", () => {
    const now = Date.now();
    const conversations = [
      {
        ...mockConversations[0],
        _id: "conv_just_now",
        lastMessageAt: now - 30_000,
        otherParticipantName: "Ada Lovelace",
      },
      {
        ...mockConversations[0],
        _id: "conv_days",
        lastMessageAt: now - 3 * 24 * 60 * 60_000,
      },
      {
        ...mockConversations[0],
        _id: "conv_weeks",
        lastMessageAt: now - 21 * 24 * 60 * 60_000,
        otherParticipantName: undefined,
      },
    ];
    (usePaginatedQuery as Mock).mockImplementation(() =>
      inboxResult({ results: conversations })
    );

    renderMessages();

    expect(screen.getByText("Just now")).toBeInTheDocument();
    expect(screen.getByText("3d")).toBeInTheDocument();
    expect(screen.getByText("3w")).toBeInTheDocument();
  });

  it("falls back to initials when a participant name is missing or single-word", () => {
    const conversations = [
      {
        ...mockConversations[0],
        _id: "conv_noname",
        otherParticipantName: undefined,
      },
      {
        ...mockConversations[0],
        _id: "conv_onename",
        otherParticipantName: "Cher",
      },
    ];
    (usePaginatedQuery as Mock).mockImplementation(() =>
      inboxResult({ results: conversations })
    );

    renderMessages();

    expect(screen.getByText("??")).toBeInTheDocument();
    expect(screen.getByText("CH")).toBeInTheDocument();
  });
});

describe("Messages Page — thread view", () => {
  const mockMarkRead = vi.fn().mockResolvedValue({
    success: true,
    markedCount: 1,
  });
  const mockSendMessage = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({ conversationId: "conv1" });
    (useMutation as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.sendMessage) return mockSendMessage;
      if (query === mockApi.messages.markRead) return mockMarkRead;
      return vi.fn();
    });
    (usePaginatedQuery as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.getConversations) {
        return inboxResult();
      }
      return threadResult();
    });
  });

  const renderThread = () =>
    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

  it("renders messages oldest-first with the newest at the bottom", () => {
    renderThread();

    const older = screen.getByText("Is it available?");
    const newer = screen.getByText("Yes, still available");
    expect(older).toBeInTheDocument();
    expect(newer).toBeInTheDocument();
    expect(
      older.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("marks the conversation as read when the thread is viewed", async () => {
    renderThread();

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith({ conversationId: "conv1" });
    });
  });

  it("sends a message and clears the input on success", async () => {
    renderThread();

    fireEvent.change(screen.getByLabelText(/type a message/i), {
      target: { value: "Great, when can I collect?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        conversationId: "conv1",
        content: "Great, when can I collect?",
      });
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/type a message/i)).toHaveValue("");
    });
  });

  it("disables the send button when the draft is empty", () => {
    renderThread();

    expect(
      screen.getByRole("button", { name: /send message/i })
    ).toBeDisabled();
  });

  it("shows an error toast when sending fails", async () => {
    mockSendMessage.mockRejectedValueOnce(
      new ConvexError("You are sending messages too quickly.")
    );

    renderThread();
    fireEvent.change(screen.getByLabelText(/type a message/i), {
      target: { value: "Spam" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "You are sending messages too quickly."
      );
    });
  });

  it("shows a conversation-not-found state when the query rejects with a ConvexError", () => {
    (usePaginatedQuery as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.getConversations) {
        return inboxResult();
      }
      throw new ConvexError("You are not a participant in this conversation");
    });

    renderThread();

    expect(screen.getByText(/Conversation not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to messages/i })
    ).toHaveAttribute("href", "/messages");
  });

  it("re-throws non-Convex errors to the root error boundary", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Intentional no-op: suppress expected error logging in this test
    });
    (usePaginatedQuery as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.getConversations) {
        return inboxResult();
      }
      throw new Error("Network failure");
    });

    expect(() => renderThread()).toThrow("Network failure");
    consoleSpy.mockRestore();
  });

  it("logs but does not throw when marking the thread as read fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Intentional no-op: suppress expected error logging in this test
    });
    mockMarkRead.mockRejectedValueOnce(new Error("markRead failed"));

    renderThread();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark conversation as read:",
        expect.any(Error)
      );
    });
    expect(screen.getByText("Yes, still available")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("calls loadMore(30) from the Load Older Messages button", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockImplementation((query) => {
      if (query === mockApi.messages.getConversations) {
        return inboxResult();
      }
      return threadResult({ status: "CanLoadMore", loadMore });
    });

    renderThread();

    fireEvent.click(
      screen.getByRole("button", { name: /load older messages/i })
    );

    expect(loadMore).toHaveBeenCalledWith(30);
  });
});
