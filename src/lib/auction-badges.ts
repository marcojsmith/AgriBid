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
/** Urgent window: lots ending within 10 minutes (red). */
export const URGENT_MS = 10 * 60 * 1000;

/** Display status of an auction or lot, shared by `StatusBadge`. */
export type DisplayStatus =
  | { kind: "live" }
  | { kind: "closing-soon"; urgent: boolean }
  | {
      kind: "opens";
      startTime: number;
      /** When given, the label is "Opens in {relative}" instead of the date. */
      relative?: string;
    }
  | { kind: "closed" }
  | { kind: "sold" }
  | { kind: "passed" }
  | { kind: "under-consideration" };

/**
 * Derives the single display status for an auction or lot.
 *
 * Callers MUST pass `outcome` for closed lots: with no outcome, an ended lot
 * is reported as "passed" because the result is not known here. Outcome wins over time. Otherwise: before `startTime` it is "opens"; after
 * `endTime` with no outcome it is "passed"; within 24h of the end it is
 * "closing-soon" (urgent inside 10 minutes); else "live".
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
  outcome?: "sold" | "passed" | "under-consideration" | null;
}): DisplayStatus {
  const { startTime, endTime, now, outcome } = input;
  if (outcome === "sold") return { kind: "sold" };
  if (outcome === "passed") return { kind: "passed" };
  if (outcome === "under-consideration") {
    return { kind: "under-consideration" };
  }
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
