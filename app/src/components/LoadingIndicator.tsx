import { cn } from "@/lib/utils";

interface LoadingIndicatorProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Renders a marketplace-style spinner used to indicate a loading state.
 *
 * @param props - Component props
 * @param props.className - Optional additional CSS classes to apply to the spinner container
 * @param props.size - Visual size of the spinner; one of "sm", "md", or "lg"
 * @returns A spinner element with role="status"
 */
export function LoadingIndicator({
  className,
  size = "md",
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: "h-6 w-6 border-b-2",
    md: "h-12 w-12 border-b-2",
    lg: "h-16 w-16 border-b-4",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface LoadingPageProps {
  className?: string;
  message?: string;
}

/**
 * Full page loading state wrapper.
 * Conforms to the marketplace page loading style (pulse text).
 * @param props - Component props
 * @param props.className - Additional CSS classes
 * @param props.message - Custom loading message
 * @returns A full-height loading state with pulse animation
 */
export function LoadingPage({
  className,
  message = "AGRIBID LOADING...",
}: LoadingPageProps) {
  return (
    <div
      className={cn(
        "flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold uppercase tracking-widest",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {message}
    </div>
  );
}
