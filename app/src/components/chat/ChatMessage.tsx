import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: {
    id: string;
    role: string;
    content: unknown;
    parts?: unknown[];
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content =
    typeof message.content === "string"
      ? message.content
      : String(message.content ?? "");

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{content}</div>

        {message.parts && message.parts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/10">
            <div className="text-xs text-muted-foreground">
              Processing tool calls...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
