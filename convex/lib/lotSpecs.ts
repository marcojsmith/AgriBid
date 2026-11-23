import { ConvexError, v } from "convex/values";

import { COLD_START_VIDEO_MAX_BYTES } from "../constants";
import { safeDelete } from "./storage";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Fixed photo shot list (Serial plate is optional for sellers). */
export const PHOTO_ANGLES = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "cab_interior",
  "hour_meter",
  "engine_bay",
  "tyres",
  "serial_plate",
] as const;

/** One entry of the fixed photo shot list. */
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

/** Validator for a per-photo angle caption. */
export const photoAngleValidator = v.union(
  v.literal("front"),
  v.literal("rear"),
  v.literal("left_side"),
  v.literal("right_side"),
  v.literal("cab_interior"),
  v.literal("hour_meter"),
  v.literal("engine_bay"),
  v.literal("tyres"),
  v.literal("serial_plate")
);

/** Human labels for each photo angle. */
export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: "Front",
  rear: "Rear",
  left_side: "Left side",
  right_side: "Right side",
  cab_interior: "Cab interior",
  hour_meter: "Hour meter",
  engine_bay: "Engine bay",
  tyres: "Tyres",
  serial_plate: "Serial plate",
};

/** Validator for the drive type of a machine. */
export const driveValidator = v.union(
  v.literal("2wd"),
  v.literal("4wd"),
  v.literal("tracks")
);

/** Drive type of a machine. */
export type Drive = "2wd" | "4wd" | "tracks";

/** Validator for the seller type stored on a profile. */
export const sellerTypeValidator = v.union(
  v.literal("private_farmer"),
  v.literal("farming_business"),
  v.literal("dealer")
);

/** Seller type stored on a profile. */
export type SellerType = "private_farmer" | "farming_business" | "dealer";

/** Public labels for each seller type. */
export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  private_farmer: "Private farmer",
  farming_business: "Farming business",
  dealer: "Dealer",
};

/** Validator for the per-photo angle map (storage id or URL -> angle). */
export const imageAnglesValidator = v.record(v.string(), photoAngleValidator);

/** Optional lot spec fields shared by the lot validators and mutations. */
export const lotSpecFields = {
  powerKw: v.optional(v.number()),
  drive: v.optional(driveValidator),
  transmission: v.optional(v.string()),
  frontTyrePct: v.optional(v.number()),
  rearTyrePct: v.optional(v.number()),
  serialNumber: v.optional(v.string()),
  coldStartVideo: v.optional(v.id("_storage")),
  imageAngles: v.optional(imageAnglesValidator),
};

/**
 * Lot spec fields for edit mutations: like {@link lotSpecFields} but
 * `coldStartVideo` also accepts `null` to remove the video.
 */
export const lotSpecEditFields = {
  ...lotSpecFields,
  coldStartVideo: v.optional(v.union(v.id("_storage"), v.null())),
};

/** Image references of a lot (object form or legacy array of refs). */
export type LotImageRefs =
  | string[]
  | {
      front?: string;
      engine?: string;
      cabin?: string;
      rear?: string;
      additional?: string[];
    };

/**
 * Collects every image reference of a lot.
 *
 * @param images - The lot's images (object form or legacy array)
 * @returns A flat list of image references
 */
export function collectImageRefs(images: LotImageRefs | undefined): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter((ref) => ref.length > 0);
  return [
    images.front,
    images.engine,
    images.cabin,
    images.rear,
    ...(images.additional ?? []),
  ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
}

/**
 * Ensures every key of an `imageAngles` map is one of the lot's own images.
 *
 * @param imageAngles - Map of image reference to angle caption
 * @param images - The lot's images
 * @throws ConvexError when a key does not reference one of the lot's images
 */
export function assertImageAnglesMatchImages(
  imageAngles: Record<string, string> | undefined,
  images: LotImageRefs | undefined
): void {
  if (!imageAngles) return;
  const refs = new Set(collectImageRefs(images));
  for (const key of Object.keys(imageAngles)) {
    if (!refs.has(key)) {
      throw new ConvexError("Image angles must reference the lot's own images");
    }
  }
}

/**
 * Ensures a cold start video reference points at an existing storage file that
 * is a video and at most `COLD_START_VIDEO_MAX_BYTES`. Both the content type
 * and the size come from the `_storage` system metadata, never from anything
 * the client supplied. No-op when no video is provided (or on removal).
 *
 * @param ctx - Query or mutation context
 * @param storageId - The storage id the caller wants to attach, if any
 * @throws ConvexError when the file is missing, not a video, or too large
 */
export async function assertValidColdStartVideo(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage"> | null | undefined
): Promise<void> {
  if (storageId === undefined || storageId === null) return;
  const file = await ctx.db.system.get("_storage", storageId);
  if (!file) {
    throw new ConvexError("Cold start video file not found");
  }
  if (!file.contentType?.startsWith("video/")) {
    throw new ConvexError("Cold start video must be a video file");
  }
  if (file.size > COLD_START_VIDEO_MAX_BYTES) {
    throw new ConvexError(
      `Cold start video must be at most ${(COLD_START_VIDEO_MAX_BYTES / (1024 * 1024)).toString()} MB`
    );
  }
}

/**
 * Deletes a lot's previous cold start video file once it has been replaced by
 * a different file or removed (`null`). Call after the lot was patched. Does
 * nothing when the field was not touched, there was no previous video, or the
 * same file is kept.
 *
 * @param ctx - Mutation context
 * @param previous - The lot's cold start video before the update
 * @param next - The requested value: a new id, `null` to remove, or `undefined` for untouched
 */
export async function deleteReplacedColdStartVideo(
  ctx: MutationCtx,
  previous: Id<"_storage"> | undefined,
  next: Id<"_storage"> | null | undefined
): Promise<void> {
  if (previous === undefined || next === undefined || next === previous) {
    return;
  }
  await safeDelete(ctx, previous, "old cold start video");
}

/** Max length of free-text spec fields (transmission, serial number). */
export const MAX_SPEC_TEXT_LENGTH = 100;

/**
 * Validates the numeric and text lot spec fields.
 *
 * @param specs - The spec values to check
 * @param specs.powerKw - Engine power in kW (0-2000)
 * @param specs.frontTyrePct - Front tyre tread remaining (0-100)
 * @param specs.rearTyrePct - Rear tyre tread remaining (0-100)
 * @param specs.transmission - Transmission description
 * @param specs.serialNumber - Serial number
 * @throws Error when a value is out of range or too long
 */
export function assertValidLotSpecs(specs: {
  powerKw?: number;
  frontTyrePct?: number;
  rearTyrePct?: number;
  transmission?: string;
  serialNumber?: string;
}): void {
  const inRange = (n: number, max: number): boolean =>
    Number.isFinite(n) && n >= 0 && n <= max;
  if (specs.powerKw !== undefined && !inRange(specs.powerKw, 2000)) {
    throw new Error("Power must be between 0 and 2000 kW");
  }
  if (specs.frontTyrePct !== undefined && !inRange(specs.frontTyrePct, 100)) {
    throw new Error("Front tyre % must be between 0 and 100");
  }
  if (specs.rearTyrePct !== undefined && !inRange(specs.rearTyrePct, 100)) {
    throw new Error("Rear tyre % must be between 0 and 100");
  }
  for (const [label, text] of [
    ["Transmission", specs.transmission],
    ["Serial number", specs.serialNumber],
  ] as const) {
    if (text !== undefined && text.length > MAX_SPEC_TEXT_LENGTH) {
      throw new Error(
        `${label} must be at most ${MAX_SPEC_TEXT_LENGTH.toString()} characters`
      );
    }
  }
}
