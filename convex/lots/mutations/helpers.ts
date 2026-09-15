import { ConvexError } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { updateCounter } from "../../admin_utils";

/**
 * Shape of the fields required to submit a lot for admin review.
 * Mirrors the legacy `AuctionValidationInput` but applies to a lot.
 */
export interface LotValidationInput {
  title?: string;
  description?: string;
  startingPrice?: number;
  reservePrice?: number;
  images?:
    | string[]
    | {
        front?: string;
        engine?: string;
        cabin?: string;
        rear?: string;
        additional?: string[];
      };
}

/**
 * Lot statuses a seller may still edit before the lot is reviewed/assigned.
 */
export const LOT_EDITABLE_STATUSES = ["draft", "pending_review"] as const;

/**
 * Union type of the lot statuses that permit editing.
 */
export type LotEditableStatus = (typeof LOT_EDITABLE_STATUSES)[number];

/**
 * Type guard for editable lot statuses.
 * @param status - The lot status to check.
 * @returns True when the status is editable.
 */
export function isLotEditableStatus(
  status: string
): status is LotEditableStatus {
  return (LOT_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Ensures a lot can be edited (draft or pending_review only).
 * @param lot - The lot document to check.
 * @throws ConvexError when the lot is no longer editable.
 */
export function assertLotEditable(lot: Doc<"lots">): void {
  if (!isLotEditableStatus(lot.status)) {
    throw new ConvexError(
      `Only ${LOT_EDITABLE_STATUSES.join(" or ")} lots can be edited`
    );
  }
}

/**
 * Ensures the caller owns the lot.
 * @param lot - The lot document to check.
 * @param userId - The id of the user to check ownership against.
 * @throws ConvexError when the caller is not the seller.
 */
export function assertLotOwnership(lot: Doc<"lots">, userId: string): void {
  if (lot.sellerId !== userId) {
    throw new ConvexError("You can only modify your own lots");
  }
}

/**
 * Checks whether a string or array exists and is non-empty.
 * @param value - The value to check.
 * @returns True when the value exists and is non-empty.
 */
export function isNonEmpty(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return value.length > 0;
}

/**
 * Validates that a lot has all required fields before it can be submitted for
 * admin review.
 * @param lot - The lot fields to validate.
 * @throws ConvexError when a required field is missing or invalid.
 */
export function validateLotBeforeSubmit(lot: LotValidationInput): void {
  if (!lot.title || lot.title.trim().length === 0) {
    throw new ConvexError("Title is required before submitting");
  }
  if (!lot.description || lot.description.trim().length === 0) {
    throw new ConvexError("Description is required before submitting");
  }
  if (lot.startingPrice === undefined || lot.startingPrice <= 0) {
    throw new ConvexError("Starting price must be greater than zero");
  }
  if (lot.reservePrice === undefined || lot.reservePrice <= 0) {
    throw new ConvexError("Reserve price must be greater than zero");
  }

  const hasImages = Array.isArray(lot.images)
    ? lot.images.length > 0
    : Boolean(
        lot.images &&
        (isNonEmpty(lot.images.front) ||
          isNonEmpty(lot.images.engine) ||
          isNonEmpty(lot.images.cabin) ||
          isNonEmpty(lot.images.rear) ||
          isNonEmpty(lot.images.additional))
      );

  if (!hasImages) {
    throw new ConvexError("At least one image is required before submitting");
  }
}

/**
 * Counter field a lot status maps to. `approved` and `assigned` both count as
 * live/`active`; `unsold` and `rejected` intentionally have no counter field.
 */
export type LotCounterKey = "active" | "pending" | "draft" | "soldCount";

/**
 * Maps a lot status to its corresponding counter field.
 * @param status - The lot status.
 * @returns The counter field name, or undefined when the status is not counted.
 */
export function getLotCounterKey(status: string): LotCounterKey | undefined {
  switch (status) {
    case "draft":
      return "draft";
    case "pending_review":
      return "pending";
    case "approved":
    case "assigned":
      return "active";
    case "sold":
      return "soldCount";
    default:
      return undefined;
  }
}

/**
 * Update the global `lots` counters when a lot changes status. Only writes when
 * the old and new statuses map to different counter fields.
 * @param ctx - The mutation context.
 * @param oldStatus - The previous lot status.
 * @param newStatus - The new lot status.
 */
export async function adjustLotStatusCounters(
  ctx: MutationCtx,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const oldKey = getLotCounterKey(oldStatus);
  const newKey = getLotCounterKey(newStatus);

  if (oldKey && oldKey !== newKey) {
    await updateCounter(ctx, "lots", oldKey, -1);
  }
  if (newKey && oldKey !== newKey) {
    await updateCounter(ctx, "lots", newKey, 1);
  }
}
