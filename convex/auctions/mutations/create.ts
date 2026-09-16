import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import {
  requireAuth,
  requireVerified,
  getAuthenticatedUserId,
} from "../../lib/auth";
import { normalizeImages } from "../../lib/storage";
import { updateCounter } from "../../admin_utils";
import { logActivity } from "../../userActivity";
import {
  assertLotEditable,
  assertLotOwnership,
  validateLotBeforeSubmit,
} from "../../lots/mutations/helpers";
import {
  MAX_ADDITIONAL_IMAGES,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
} from "../../constants";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Handler for generating a storage upload URL.
 * @param ctx - The mutation context.
 * @returns Promise<string>
 */
export const generateUploadUrlHandler = async (ctx: MutationCtx) => {
  await requireAuth(ctx);
  return await ctx.storage.generateUploadUrl();
};

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: generateUploadUrlHandler,
});

/**
 * Handler for creating a new lot.
 * @param ctx - The mutation context.
 * @param args - The arguments for creating a lot.
 * @param args.title - The title of the listing.
 * @param args.categoryId - The ID of the category for the listing.
 * @param args.make - The make of the equipment.
 * @param args.model - The model of the equipment.
 * @param args.year - The year of the equipment.
 * @param args.operatingHours - The operating hours of the equipment.
 * @param args.location - The location of the equipment.
 * @param args.description - The description of the listing.
 * @param args.startingPrice - The starting price of the listing.
 * @param args.reservePrice - The reserve price of the listing.
 * @param args.durationDays - Legacy listing duration; accepted but not persisted on the lot.
 * @param args.images - The images for the listing.
 * @param args.images.front - The front image of the equipment.
 * @param args.images.engine - The engine image of the equipment.
 * @param args.images.cabin - The cabin image of the equipment.
 * @param args.images.rear - The rear image of the equipment.
 * @param args.images.additional - Additional images of the equipment.
 * @param args.conditionChecklist - The condition checklist for the equipment.
 * @param args.conditionChecklist.engine - The condition of the engine.
 * @param args.conditionChecklist.hydraulics - The condition of the hydraulics.
 * @param args.conditionChecklist.tires - The condition of the tires.
 * @param args.conditionChecklist.serviceHistory - The service history of the equipment.
 * @param args.conditionChecklist.notes - Additional notes on the condition.
 * @param args.isDraft - Whether the listing is a draft.
 * @param args.startTime - Legacy scheduling field; accepted but not persisted on the lot.
 * @returns Promise<Id<"lots">>
 */
export const createLotHandler = async (
  ctx: MutationCtx,
  args: {
    title: string;
    categoryId: Id<"equipmentCategories">;
    make: string;
    model: string;
    year: number;
    operatingHours: number;
    location: string;
    description: string;
    startingPrice: number;
    reservePrice: number;
    durationDays: number;
    images: {
      front?: string;
      engine?: string;
      cabin?: string;
      rear?: string;
      additional?: string[];
    };
    conditionChecklist: {
      engine: boolean;
      hydraulics: boolean;
      tires: boolean;
      serviceHistory: boolean;
      notes?: string;
    };
    isDraft?: boolean;
    startTime?: number;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const { isDraft } = args;

  const images = { ...args.images };
  if (images.additional && images.additional.length > MAX_ADDITIONAL_IMAGES) {
    if (isDraft) {
      // If draft, truncate to max allowed
      images.additional = images.additional.slice(0, MAX_ADDITIONAL_IMAGES);
    } else {
      throw new ConvexError(
        `Additional images limit exceeded (max ${MAX_ADDITIONAL_IMAGES.toString()})`
      );
    }
  }

  // Validate categoryId exists
  const category = await ctx.db.get("equipmentCategories", args.categoryId);
  if (!category) {
    throw new ConvexError("Invalid categoryId: Category not found");
  }

  const normalizedImages = normalizeImages(images);
  const status = isDraft ? "draft" : "pending_review";

  if (!isDraft) {
    validateLotBeforeSubmit({
      title: args.title,
      description: args.description,
      startingPrice: args.startingPrice,
      reservePrice: args.reservePrice,
      images: normalizedImages,
    });
  }

  // A lot does not own a schedule; the parent auction does. `durationDays` and
  // `startTime` are accepted for backward compatibility with the listing
  // wizard but intentionally not persisted on the lot.
  const lotId = await ctx.db.insert("lots", {
    title: args.title,
    categoryId: args.categoryId,
    make: args.make,
    model: args.model,
    year: args.year,
    operatingHours: args.operatingHours,
    location: args.location,
    description: args.description,
    startingPrice: args.startingPrice,
    reservePrice: args.reservePrice,
    images: normalizedImages,
    conditionChecklist: args.conditionChecklist,
    sellerId: userId,
    status,
    currentPrice: args.startingPrice,
    minIncrement:
      args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT,
  });

  await updateCounter(ctx, "lots", "total", 1);
  if (status === "pending_review") {
    await updateCounter(ctx, "lots", "pending", 1);
  } else {
    await updateCounter(ctx, "lots", "draft", 1);
  }

  // A draft isn't a real "listing" event yet — only log when the lot is
  // actually submitted for review at creation time. Drafts that are submitted
  // later get their `listing_created` entry from the lot submit handler.
  if (status !== "draft") {
    await logActivity(ctx, {
      userId,
      type: "listing_created",
      description: `Listing created: ${args.title}`,
      relatedId: lotId,
    });
  }

  return lotId;
};

/**
 * Generic lot creation mutation.
 * Supports creating either a draft or a pending_review lot.
 */
export const createLot = mutation({
  args: {
    title: v.string(),
    categoryId: v.id("equipmentCategories"),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    description: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string())),
    }),
    conditionChecklist: v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    }),
    isDraft: v.optional(v.boolean()),
    startTime: v.optional(v.number()),
  },
  returns: v.id("lots"),
  handler: createLotHandler,
});

/**
 * Handler for saving a draft lot.
 * Allows partial updates for draft lots, enabling users to save incomplete work.
 * @param ctx - The mutation context.
 * @param args - The arguments for saving a draft.
 * @param args.lotId - The ID of the lot to update (optional).
 * @param args.title - The title of the listing (optional for drafts).
 * @param args.categoryId - The ID of the category for the listing (optional for drafts).
 * @param args.make - The make of the equipment (optional for drafts).
 * @param args.model - The model of the equipment (optional for drafts).
 * @param args.year - The year of the equipment (optional for drafts).
 * @param args.operatingHours - The operating hours of the equipment (optional for drafts).
 * @param args.location - The location of the equipment (optional for drafts).
 * @param args.description - The description of the listing (optional for drafts).
 * @param args.startingPrice - The starting price of the listing (optional for drafts).
 * @param args.reservePrice - The reserve price of the listing (optional for drafts).
 * @param args.durationDays - Legacy listing duration; accepted but not persisted on the lot.
 * @param args.images - The images for the listing (optional for drafts).
 * @param args.images.front - The front image of the equipment.
 * @param args.images.engine - The engine image of the equipment.
 * @param args.images.cabin - The cabin image of the equipment.
 * @param args.images.rear - The rear image of the equipment.
 * @param args.images.additional - Additional images of the equipment.
 * @param args.conditionChecklist - The condition checklist for the equipment (optional for drafts).
 * @param args.conditionChecklist.engine - The condition of the engine.
 * @param args.conditionChecklist.hydraulics - The condition of the hydraulics.
 * @param args.conditionChecklist.tires - The condition of the tires.
 * @param args.conditionChecklist.serviceHistory - The service history of the equipment.
 * @param args.conditionChecklist.notes - Additional notes on the condition.
 * @param args.startTime - Legacy scheduling field; accepted but not persisted on the lot.
 * @returns Promise<Id<"lots">>
 */
export const saveDraftHandler = async (
  ctx: MutationCtx,
  args: {
    lotId?: string;
    title?: string;
    categoryId?: Id<"equipmentCategories">;
    make?: string;
    model?: string;
    year?: number;
    operatingHours?: number;
    location?: string;
    description?: string;
    startingPrice?: number;
    reservePrice?: number;
    durationDays?: number;
    images?: {
      front?: string;
      engine?: string;
      cabin?: string;
      rear?: string;
      additional?: string[];
    };
    conditionChecklist?: {
      engine: boolean;
      hydraulics: boolean;
      tires: boolean;
      serviceHistory: boolean;
      notes?: string;
    };
    startTime?: number;
  }
) => {
  const { userId } = await requireVerified(ctx);

  const { lotId, ...restArgs } = args;

  // Enforce image cap for additional images
  if (
    restArgs.images?.additional &&
    restArgs.images.additional.length > MAX_ADDITIONAL_IMAGES
  ) {
    restArgs.images.additional = restArgs.images.additional.slice(
      0,
      MAX_ADDITIONAL_IMAGES
    );
  }

  const images = restArgs.images ? normalizeImages(restArgs.images) : undefined;

  let validLotId: Id<"lots"> | null = null;
  if (lotId) {
    validLotId = ctx.db.normalizeId("lots", lotId);
    if (!validLotId) {
      throw new ConvexError("Invalid lotId provided");
    }
  }

  if (validLotId) {
    const existing = await ctx.db.get("lots", validLotId);
    if (!existing) {
      throw new ConvexError("Lot not found");
    }
    assertLotOwnership(existing, userId);
    assertLotEditable(existing);

    if (existing.status === "pending_review") {
      const mergedState = {
        ...existing,
        ...restArgs,
        ...(images && { images }),
      };
      validateLotBeforeSubmit(mergedState);
    }

    // `durationDays` and `startTime` are legacy scheduling fields the lot no
    // longer owns, so they are dropped from the patch.
    const patchData: Record<string, unknown> = Object.fromEntries(
      (Object.entries(restArgs) as [string, unknown][]).filter(
        ([key, value]) =>
          key !== "images" &&
          key !== "durationDays" &&
          key !== "startTime" &&
          value !== undefined
      )
    );
    if (images !== undefined) {
      patchData.images = images;
    }
    if (restArgs.startingPrice !== undefined) {
      patchData.currentPrice = restArgs.startingPrice;
      patchData.minIncrement =
        restArgs.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
          ? SMALL_INCREMENT_AMOUNT
          : LARGE_INCREMENT_AMOUNT;
    }

    await ctx.db.patch("lots", validLotId, patchData);

    return validLotId;
  }

  // For new drafts, we need at least title and images
  if (!args.title) {
    throw new ConvexError("Title is required to create a new draft");
  }
  if (images === undefined) {
    throw new ConvexError("Images are required to create a new draft");
  }

  const newLotId = await ctx.db.insert("lots", {
    title: args.title,
    ...(args.categoryId && { categoryId: args.categoryId }),
    make: args.make ?? "",
    model: args.model ?? "",
    year: args.year ?? 0,
    operatingHours: args.operatingHours ?? 0,
    location: args.location ?? "",
    description: args.description ?? "",
    startingPrice: args.startingPrice ?? 0,
    reservePrice: args.reservePrice ?? args.startingPrice ?? 0,
    images,
    ...(args.conditionChecklist && {
      conditionChecklist: args.conditionChecklist,
    }),
    sellerId: userId,
    status: "draft",
    currentPrice: args.startingPrice ?? 0,
    minIncrement:
      (args.startingPrice ?? 0) < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT,
  });

  await updateCounter(ctx, "lots", "total", 1);
  await updateCounter(ctx, "lots", "draft", 1);

  return newLotId;
};

/**
 * Save or update a draft lot.
 * Creates new draft if no lotId provided, otherwise updates existing draft.
 * All fields except those required for new draft creation are optional to support partial saves.
 */
export const saveDraft = mutation({
  args: {
    lotId: v.optional(v.string()),
    title: v.optional(v.string()),
    categoryId: v.optional(v.id("equipmentCategories")),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    operatingHours: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    startingPrice: v.optional(v.number()),
    reservePrice: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    images: v.optional(
      v.object({
        front: v.optional(v.string()),
        engine: v.optional(v.string()),
        cabin: v.optional(v.string()),
        rear: v.optional(v.string()),
        additional: v.optional(v.array(v.string())),
      })
    ),
    conditionChecklist: v.optional(
      v.object({
        engine: v.boolean(),
        hydraulics: v.boolean(),
        tires: v.boolean(),
        serviceHistory: v.boolean(),
        notes: v.optional(v.string()),
      })
    ),
    startTime: v.optional(v.number()),
  },
  returns: v.id("lots"),
  handler: saveDraftHandler,
});
