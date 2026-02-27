import { Loader2 } from "lucide-react";

interface StreamingTextProps {
  content: unknown;
}

export function StreamingText({ content }: StreamingTextProps) {
  const displayContent =
    typeof content === "string" ? content : String(content ?? "");

  return (
    <div className="text-sm">
      <span className="whitespace-pre-wrap">{displayContent}</span>
      <Loader2 className="inline-block h-3 w-3 ml-1 animate-spin" />
    </div>
  );
}
