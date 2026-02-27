import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, X, Bot, Loader2, Send, Square } from "lucide-react";
import { BidConfirmationDialog } from "./BidConfirmationDialog";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

const CHAT_STORAGE_KEY = "agribid_chat_session";

interface AIStatus {
  isEnabled: boolean;
  modelId: string;
  safetyLevel: "low" | "medium" | "high";
}

interface ToolInvocationResult {
  requiresApproval?: boolean;
  auctionId: string;
  proposedBid: number;
  auctionTitle: string;
  currentPrice: number;
}

interface ToolInvocation {
  toolName: string;
  state: string;
  result?: ToolInvocationResult;
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: ToolInvocation;
}

type ExtendedMessage = UIMessage & { parts?: MessagePart[]; content?: string };

export function ChatContainer() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) return stored;
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
    }
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, newId);
    } catch (e) {
      console.warn("Failed to write to localStorage:", e);
    }
    return newId;
  });

  const [pendingApproval, setPendingApproval] = useState<{
    auctionId: string;
    amount: number;
    title: string;
    currentPrice: number;
  } | null>(null);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const placeBidMutation = useMutation(api.auctions.bidding.placeBid);
  const lastProcessedSessionRef = useRef<string | null>(null);
  const lastProcessedMessageRef = useRef<string | null>(null);

  const aiStatus = useQuery(api.ai.config.getPublicAIStatus) as
    | AIStatus
    | undefined;

  // Validate existing session if any
  const validatedSession = useQuery(
    api.ai.chat.validateSession,
    sessionId ? { sessionId } : "skip"
  );

  // If session is invalid, reset it
  useEffect(() => {
    if (validatedSession === undefined) return;

    const sessionKey = `${validatedSession.valid}-${validatedSession.reason}`;
    if (sessionKey === lastProcessedSessionRef.current) return;
    lastProcessedSessionRef.current = sessionKey;

    if (
      !validatedSession.valid &&
      validatedSession.reason !== "Session not found"
    ) {
      console.warn("Chat session invalid, clearing:", validatedSession.reason);
      const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        localStorage.setItem(CHAT_STORAGE_KEY, newId);
      } catch (e) {
        console.warn("Failed to update localStorage:", e);
      }
      // Defer state update to next tick to avoid lint warning
      const timeoutId = setTimeout(() => {
        setSessionId(newId);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [validatedSession]);

  const { messages, status, error, stop, setMessages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_CONVEX_SITE_URL}/api/ai/chat/`,
      body: { sessionId },
      credentials: "include",
    }),
    resume: false, // Disabling resume to avoid GET /api/ai/chat/:id/stream 404s
  });

  const history = useQuery(
    api.ai.chat.getRecentMessages,
    sessionId ? { sessionId, limit: 20 } : "skip"
  );

  useEffect(() => {
    if (history && history.length > 0 && messages.length === 0) {
      const initialMessages = history.map((msg) => ({
        id: msg._id,
        role: msg.role as "user" | "assistant" | "system" | "data",
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      })) as unknown as UIMessage[];
      setMessages(initialMessages);
    }
  }, [history, setMessages, messages.length]);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for tool invocations
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.id === lastProcessedMessageRef.current) return;
    lastProcessedMessageRef.current = lastMessage.id;

    const extMessage = lastMessage as ExtendedMessage;
    const parts = extMessage.parts || [];
    for (const part of parts) {
      // Handle AI SDK 5 format: tool-{toolName}
      if (part.type?.startsWith?.("tool-")) {
        const toolPart = part as {
          state?: string;
          result?: ToolInvocationResult;
        };
        if (toolPart.state === "result" || toolPart.state === "completed") {
          const result = toolPart.result;
          if (result?.requiresApproval && !pendingApproval) {
            const timeoutId = setTimeout(() => {
              setPendingApproval({
                auctionId: result.auctionId,
                amount: result.proposedBid,
                title: result.auctionTitle,
                currentPrice: result.currentPrice,
              });
            }, 0);
            return () => clearTimeout(timeoutId);
          }
        }
      }
      // Handle legacy tool-invocation format
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation?.state === "result"
      ) {
        const result = part.toolInvocation.result;
        if (result?.requiresApproval && !pendingApproval) {
          // Defer state update to next tick to avoid lint warning
          const timeoutId = setTimeout(() => {
            setPendingApproval({
              auctionId: result.auctionId,
              amount: result.proposedBid,
              title: result.auctionTitle,
              currentPrice: result.currentPrice,
            });
          }, 0);
          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [messages, pendingApproval]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessage({ role: "user", content: input } as any);
    setInput("");
  };

  const handleApprovalConfirm = useCallback(async () => {
    if (!pendingApproval) return;

    const { auctionId, amount } = pendingApproval;
    setPendingApproval(null);

    try {
      // Use direct mutation for the confirmed bid - safer and bypasses AI loop
      await placeBidMutation({
        auctionId: auctionId as Id<"auctions">,
        amount,
      });
      toast.success("Bid placed successfully!");

      // Add a system-like message to the chat to inform the user
      const newMessage = {
        id: `system_${Date.now()}`,
        role: "assistant" as const,
        content: `I've successfully placed your bid of £${amount.toLocaleString()} on the auction.`,
        createdAt: new Date(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages((prev: any) => [...prev, newMessage]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place bid");
    }
  }, [pendingApproval, placeBidMutation, setMessages]);

  const handleApprovalCancel = useCallback(() => {
    setPendingApproval(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMessage: any = {
      id: `system_${Date.now()}`,
      role: "assistant",
      content: "Bid placement cancelled.",
    };
    setMessages((prev) => [...prev, newMessage]);
  }, [setMessages]);

  if (aiStatus === undefined || !sessionId) {
    return null;
  }

  if (!aiStatus.isEnabled) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        {isOpen ? (
          <Card className="w-[400px] h-[600px] flex flex-col shadow-2xl border-2">
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">AgriBid Assistant</h3>
                  <p className="text-xs text-muted-foreground">AI Helper</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error.message}
                  </p>
                </div>
              )}

              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-bold mb-2">
                    Welcome to AgriBid Assistant
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    I can help you find equipment, check bids, and more.
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Try asking:</p>
                    <p className="font-medium">
                      &quot;Find John Deere tractors under £5000&quot;
                    </p>
                    <p className="font-medium">
                      &quot;Show my current bids&quot;
                    </p>
                    <p className="font-medium">
                      &quot;What&apos;s on my watchlist?&quot;
                    </p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 mb-4 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === "user"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {message.role === "user" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {(() => {
                        const ext = message as UIMessage & {
                          parts?: MessagePart[];
                        };
                        if (ext.parts) {
                          return ext.parts?.map(
                            (part: MessagePart, i: number) => {
                              if (part.type === "text")
                                return <span key={i}>{part.text}</span>;

                              // Handle AI SDK 5 format: tool-{toolName}
                              // Only show if not yet completed (no result)
                              if (part.type?.startsWith?.("tool-")) {
                                const hasResult =
                                  (part as { result?: unknown }).result !==
                                  undefined;
                                if (hasResult) return null; // Don't show completed tools

                                const toolName = part.type.replace("tool-", "");
                                return (
                                  <span
                                    key={i}
                                    className="italic opacity-80 block text-xs"
                                  >
                                    <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                                    Using {toolName}...
                                  </span>
                                );
                              }

                              // Handle legacy tool-invocation format
                              if (
                                part.type === "tool-invocation" &&
                                part.toolInvocation?.state !== "result"
                              ) {
                                const toolName =
                                  part.toolInvocation?.toolName || "tool";
                                const toolDisplayName = toolName
                                  .replace(/([A-Z])/g, " $1")
                                  .trim();
                                return (
                                  <span
                                    key={i}
                                    className="italic opacity-80 block text-xs"
                                  >
                                    <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                                    Using {toolDisplayName}...
                                  </span>
                                );
                              }
                              return null;
                            }
                          );
                        }
                        // Handle legacy string content - cast to any to access
                        const msg = message as unknown as { content?: string };
                        return msg.content ?? "";
                      })()}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Using tools...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-muted/30">
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <textarea
                  id="chat-input"
                  name="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me about equipment..."
                  className="min-h-[60px] max-h-[120px] resize-none rounded-lg border bg-background px-3 py-2 text-sm"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {input.length}/2000
                  </span>
                  <div className="flex gap-2">
                    {isLoading ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => stop()}
                        className="gap-2"
                      >
                        <Square className="h-4 w-4" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!input.trim()}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </Card>
        ) : (
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg"
            size="icon"
            aria-label="Open AgriBid Assistant"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
      </div>

      {pendingApproval && (
        <BidConfirmationDialog
          isOpen={!!pendingApproval}
          onClose={handleApprovalCancel}
          onConfirm={handleApprovalConfirm}
          onCancel={handleApprovalCancel}
          auctionId={pendingApproval.auctionId as Id<"auctions">}
          proposedBidAmount={pendingApproval.amount}
          auctionTitle={pendingApproval.title}
        />
      )}
    </>
  );
}
