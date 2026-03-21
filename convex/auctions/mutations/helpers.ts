import { ConvexError } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { updateCounter } from "../../admin_utils";

export const EDITABLE_STATUSES = ["draft", "pending_review"] as const;
export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

/**
 * Type guard to check if a status is an EditableStatus.
 * @param status - The status string to check.
 * @returns True if the status is an EditableStatus.
 */
export function isEditableStatus(status: string): status is EditableStatus {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Ensures an auction can be edited (must be in draft or pending_review).
 * @param auction - The auction document to check.
 */
export function assertEditable(auction: Doc<"auctions">): void {
  if (!isEditableStatus(auction.status)) {
    throw new ConvexError(
      `Only ${EDITABLE_STATUSES.join(" or ")} auctions can be edited`
    );
  }
}

/**
 * Ensures the caller owns the auction.
 * @param auction - The auction document to check.
 * @param userId - The ID of the user to check ownership against.
 */
export function assertOwnership(
  auction: Doc<"auctions">,
  userId: string
): void {
  if (auction.sellerId !== userId) {
    throw new ConvexError("You can only modify your own auctions");
  }
}

/**
 * Checks if a string or array exists and is not empty.
 * @param value - The value to check.
 * @returns True if the value exists and is non-empty.
 */
export function isNonEmpty(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return value.length > 0;
}

/**
 * Validates that an auction has all required fields before it can be published.
 *
 * @param auction - The auction document to validate
 * @throws ConvexError if any required field is missing or invalid
 */
export function validateAuctionBeforePublish(auction: Doc<"auctions">): void {
  if (!auction.title || auction.title.trim().length === 0) {
    throw new ConvexError("Title is required before publishing");
  }
  if (!auction.description || auction.description.trim().length === 0) {
    throw new ConvexError("Description is required before publishing");
  }
  if (auction.startingPrice <= 0) {
    throw new ConvexError("Starting price must be greater than zero");
  }
  if (auction.reservePrice <= 0) {
    throw new ConvexError("Reserve price must be greater than zero");
  }

  const hasImages = Array.isArray(auction.images)
    ? auction.images.length > 0
    : isNonEmpty(auction.images.front) ||
      isNonEmpty(auction.images.engine) ||
      isNonEmpty(auction.images.cabin) ||
      isNonEmpty(auction.images.rear) ||
      isNonEmpty(auction.images.additional);

  if (!hasImages) {
    throw new ConvexError("At least one image is required before submitting");
  }
}

/**
 * Helper to map auction status to its corresponding counter field.
 * @param status - The auction status.
 * @returns The counter field name or undefined.
 */
export function getCounterKey(
  status: string
): "active" | "pending" | "draft" | undefined {
  switch (status) {
    case "active":
      return "active";
    case "pending_review":
      return "pending";
    case "draft":
      return "draft";
    default:
      return undefined;
  }
}

/**
 * Update global auction counters when an auction changes status.
 * @param ctx - The mutation context.
 * @param oldStatus - The previous status of the auction.
 * @param newStatus - The new status of the auction.
 */
export async function adjustStatusCounters(
  ctx: MutationCtx,
  oldStatus: string,
  newStatus: string
) {
  const oldKey = getCounterKey(oldStatus);
  const newKey = getCounterKey(newStatus);

  if (oldKey) await updateCounter(ctx, "auctions", oldKey, -1);
  if (newKey) await updateCounter(ctx, "auctions", newKey, 1);
}
