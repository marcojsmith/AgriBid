import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export const AUCTION_STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  draft: "secondary",
  pending_review: "outline",
  approved: "default",
  assigned: "default",
  sold: "default",
  unsold: "destructive",
  rejected: "destructive",
};

export const FLAG_REASON_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  misleading: "destructive",
  suspicious: "destructive",
  inappropriate: "secondary",
  other: "outline",
};

export const EDITABLE_AUCTION_STATUSES = ["draft", "pending_review"] as const;
export type EditableAuctionStatus = (typeof EDITABLE_AUCTION_STATUSES)[number];

/**
 * Checks if an auction status allows editing.
 * @param status - The auction status to check
 * @returns True if the status is editable, false otherwise.
 */
export function isEditableStatus(status: string): boolean {
  return EDITABLE_AUCTION_STATUSES.includes(status as EditableAuctionStatus);
}

/**
 * Formats an auction status for display.
 * @param status - The auction status string
 * @returns A formatted label string.
 */
export function getAuctionStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

/** Closing-soon window: lots ending within 24 hours. */
export const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;
/** Urgent window: lots ending within 1 hour. */
export const URGENT_MS = 60 * 60 * 1000;

/** Display status of an auction or lot, shared by `StatusBadge`. */
export type DisplayStatus =
  | { kind: "live" }
  | { kind: "closing-soon"; urgent: boolean }
  | { kind: "opens"; startTime: number }
  | { kind: "sold" }
  | { kind: "passed" };

/**
 * Derives the single display status for an auction or lot.
 *
 * Outcome wins over time. Otherwise: before `startTime` it is "opens"; after
 * `endTime` with no outcome it is "passed"; within 24h of the end it is
 * "closing-soon" (urgent inside 1h); else "live".
 *
 * @param input - Times in ms, current time, and the final outcome if known
 * @param input.startTime - When bidding opens (ms), if scheduled
 * @param input.endTime - When bidding closes (ms), if known
 * @param input.now - The current time (ms)
 * @param input.outcome - The final result, once decided
 * @returns The display status
 */
export function deriveDisplayStatus(input: {
  startTime?: number | null;
  endTime?: number | null;
  now: number;
  outcome?: "sold" | "passed" | null;
}): DisplayStatus {
  const { startTime, endTime, now, outcome } = input;
  if (outcome === "sold") return { kind: "sold" };
  if (outcome === "passed") return { kind: "passed" };
  if (typeof startTime === "number" && now < startTime) {
    return { kind: "opens", startTime };
  }
  if (typeof endTime === "number") {
    if (now >= endTime) return { kind: "passed" };
    const remaining = endTime - now;
    if (remaining < CLOSING_SOON_MS) {
      return { kind: "closing-soon", urgent: remaining < URGENT_MS };
    }
  }
  return { kind: "live" };
}
