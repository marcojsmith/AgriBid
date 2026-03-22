import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  "data-testid"?: string;
}

/**
 * A loading skeleton primitive component.
 *
 * @param props - Component props.
 * @param props.className - Additional CSS classes to apply.
 * @param props.data-testid - Test identifier for the skeleton element.
 * @returns A pulsing placeholder element.
 */
export function Skeleton({ className, "data-testid": testid }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      data-testid={testid}
    />
  );
}
