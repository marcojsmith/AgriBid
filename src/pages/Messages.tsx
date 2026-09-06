// app/src/pages/Messages.tsx
import { useEffect, useState, Component, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  usePaginatedQuery,
  useMutation,
  type PaginatedQueryItem,
  type UsePaginatedQueryReturnType,
} from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { ArrowLeft, Inbox, MessageSquare, Send } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { cn, getErrorMessage } from "@/lib/utils";

type Conversation = PaginatedQueryItem<typeof api.messages.getConversations>;

type Message = PaginatedQueryItem<typeof api.messages.getMessages>;

/**
 * Formats a timestamp as a short relative label for conversation lists.
 *
 * @param timestamp - Epoch milliseconds to format
 * @returns "Just now", "5m", "3h", "2d", "3w", or a date string for older items
 */
const formatRelativeTime = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(timestamp).toLocaleDateString();
};

/**
 * Derives up to two uppercase initials from a participant name for the
 * conversation avatar.
 *
 * @param name - The other participant's name (may be undefined)
 * @returns Two-letter initials, or "??" when no name is available
 */
const getInitials = (name?: string): string => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Renders the conversations inbox: a list of the caller's conversations with
 * the other participant's name, last-message preview, relative timestamp and
 * an unread badge, plus a load-more control when more pages are available.
 *
 * @param props - Component props
 * @param props.conversations - Paginated query result for getConversations
 * @returns The inbox list JSX element
 */
function ConversationsInbox({
  conversations,
}: {
  conversations: UsePaginatedQueryReturnType<
    typeof api.messages.getConversations
  >;
}) {
  const { results, status, loadMore } = conversations;

  if (status === "LoadingFirstPage") {
    return (
      <div className="py-24 text-center">
        <LoadingIndicator className="mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">
          Loading Messages...
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <Inbox className="h-12 w-12 text-muted-foreground/20 mx-auto" />
        <div className="space-y-1">
          <p className="text-xl font-black uppercase">No messages yet</p>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Contact a seller from their profile to start a conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y-2">
        {results.map((conversation: Conversation) => (
          <Link
            key={conversation._id}
            to={`/messages/${conversation._id}`}
            className={cn(
              "p-4 sm:p-6 flex gap-4 hover:bg-muted/30 transition-all group",
              conversation.unreadCount > 0 && "bg-muted/50"
            )}
          >
            <div className="h-12 w-12 rounded-md bg-primary/10 border-2 flex items-center justify-center shrink-0">
              <span className="text-sm font-black text-primary">
                {getInitials(conversation.otherParticipantName)}
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-black uppercase text-sm tracking-tight truncate">
                    {conversation.otherParticipantName ?? "Unknown User"}
                  </h3>
                  {conversation.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed truncate">
                {conversation.lastMessagePreview ?? "No messages yet"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="py-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadMore(20);
            }}
            disabled={status === "LoadingMore"}
            className="rounded-md border-2 font-black uppercase tracking-widest text-xs"
          >
            {status === "LoadingMore" ? (
              <>
                <LoadingIndicator size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </>
  );
}

interface ConversationErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary for the conversation thread. When the getMessages query
 * throws because the caller is not a participant (or the conversation does
 * not exist), it renders a clear not-found state instead of crashing.
 * Unexpected errors are re-thrown to the root error boundary.
 *
 * @param props - Component props
 * @param props.children - The conversation thread subtree to guard
 */
class ConversationErrorBoundary extends Component<
  ConversationErrorBoundaryProps,
  { error: unknown }
> {
  /**
   * Initialize the boundary with no captured error.
   *
   * @param props - Component props
   * @param props.children - The conversation thread subtree to guard
   */
  constructor(props: ConversationErrorBoundaryProps) {
    super(props);
    this.state = { error: undefined };
  }

  /**
   * Captures the thrown error into state.
   *
   * @param error - The error thrown by the subtree
   * @returns New boundary state containing the error
   */
  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  /**
   * Renders the subtree, or the not-found state for Convex rejections.
   *
   * @returns The conversation thread or the not-found fallback
   */
  render(): ReactNode {
    if (this.state.error !== undefined) {
      if (this.state.error instanceof ConvexError) {
        return (
          <div className="py-24 text-center space-y-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <div className="space-y-1">
              <p className="text-xl font-black uppercase">
                Conversation not found
              </p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                This conversation doesn&apos;t exist or you&apos;re not part of
                it.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-md border-2">
              <Link to="/messages">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
              </Link>
            </Button>
          </div>
        );
      }
      throw this.state.error;
    }
    return this.props.children;
  }
}

/**
 * Renders a single conversation thread: older-messages pagination, the
 * message list (oldest first, with sent/received alignment) and a send box.
 * Marks the conversation as read when it is viewed.
 *
 * @param props - Component props
 * @param props.conversationId - The conversation being viewed
 * @returns The thread view JSX element
 */
function ConversationThread({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const messages = usePaginatedQuery(
    api.messages.getMessages,
    { conversationId },
    { initialNumItems: 30 }
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markRead);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    markRead({ conversationId }).catch((error: unknown) => {
      console.error("Failed to mark conversation as read:", error);
    });
  }, [conversationId, markRead]);

  const handleSend = async () => {
    if (draft.trim().length === 0) return;

    setIsSending(true);
    try {
      await sendMessage({ conversationId, content: draft });
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send message"));
    } finally {
      setIsSending(false);
    }
  };

  // getMessages pages newest-first; reverse the accumulated results so the
  // thread renders oldest-first with the latest message at the bottom.
  const oldestFirst: Message[] = [...messages.results].reverse();

  return (
    <div className="space-y-4">
      <Link
        to="/messages"
        className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Messages
      </Link>

      {messages.status === "LoadingMore" && (
        <div className="text-center py-2">
          <LoadingIndicator size="sm" className="mx-auto" />
        </div>
      )}
      {messages.status === "CanLoadMore" && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              messages.loadMore(30);
            }}
            className="rounded-md border-2 font-black uppercase tracking-widest text-xs"
          >
            Load Older Messages
          </Button>
        </div>
      )}

      <Card className="border-2 overflow-hidden bg-card/50">
        <div className="divide-y divide-border min-h-[40vh]">
          {messages.status === "LoadingFirstPage" ? (
            <div className="py-24 text-center">
              <LoadingIndicator className="mx-auto" />
            </div>
          ) : (
            oldestFirst.map((message: Message) => (
              <div
                key={message._id}
                className={cn(
                  "px-4 py-3 flex",
                  message.isMine ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] sm:max-w-[70%] rounded-md px-3 py-2",
                    message.isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 uppercase tracking-widest",
                      message.isMine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          placeholder="Type a message..."
          aria-label="Type a message"
          className="rounded-md border-2 font-bold text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isSending || draft.trim().length === 0}
          aria-label="Send message"
          className="h-10 w-10 rounded-md shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

/**
 * Renders the Messages page: the conversations inbox at /messages, or the
 * thread view for the conversation in the route parameter at
 * /messages/:conversationId.
 *
 * @returns The Messages page JSX element (inbox, thread, or not-found state)
 */
export default function Messages() {
  const { conversationId } = useParams<{ conversationId: string }>();

  const conversations = usePaginatedQuery(
    api.messages.getConversations,
    {},
    { initialNumItems: 20 }
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-black uppercase tracking-tight">
          Messages
        </h1>
        <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
          Your conversations with buyers and sellers
        </p>
      </div>

      <Card className="border-2 overflow-hidden bg-card/50">
        {conversationId ? (
          <ConversationErrorBoundary>
            <ConversationThread
              conversationId={conversationId as Id<"conversations">}
            />
          </ConversationErrorBoundary>
        ) : (
          <ConversationsInbox conversations={conversations} />
        )}
      </Card>
    </div>
  );
}
