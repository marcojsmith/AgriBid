import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminConnectionErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  iconSize?: "sm" | "md" | "lg";
}

/**
 * Standardized error UI for admin dashboard connection timeouts or query failures.
 */
export function AdminConnectionError({
  title = "Connection Timeout",
  description = "We're having trouble reaching the requested service. This could be due to a temporary network issue or high server load.",
  onRetry = () => window.location.reload(),
  className,
  iconSize = "md",
}: AdminConnectionErrorProps) {
  const iconSizes = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const iconInnerSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center space-y-4 max-w-md text-center p-8 border-2 border-dashed rounded-2xl bg-muted/10 animate-in fade-in zoom-in-95",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full bg-destructive/10 flex items-center justify-center",
          iconSizes[iconSize]
        )}
      >
        <AlertCircle
          aria-hidden="true"
          className={cn("text-destructive", iconInnerSizes[iconSize])}
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground font-medium">
          {description}
        </p>
      </div>
      <Button
        onClick={(e) => {
          e.preventDefault();
          onRetry();
        }}
        className="rounded-xl font-bold uppercase tracking-widest gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Retry Connection
      </Button>
    </div>
  );
}
