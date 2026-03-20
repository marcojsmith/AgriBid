import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * A loading skeleton primitive component.
 *
 * @param props - Component props.
 * @param props.className - Additional CSS classes to apply.
 * @returns A pulsing placeholder element.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
