import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import {
  requireAuth,
  requireVerified,
  getAuthenticatedUserId,
} from "../../lib/auth";
import { normalizeImages } from "../../lib/storage";
import { updateCounter } from "../../admin_utils";
import {
  validateAuctionBeforePublish,
  assertOwnership,
  assertEditable,
} from "./helpers";
import {
  MAX_ADDITIONAL_IMAGES,
  AUCTION_MIN_DURATION_DAYS,
  AUCTION_MAX_DURATION_DAYS,
  AUCTION_DEFAULT_DURATION_DAYS,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
} from "../../constants";
import type { Id, Doc } from "../../_generated/dataModel";
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
 * Handler for creating a new auction.
 * @param ctx - The mutation context.
 * @param args - The arguments for creating an auction.
 * @param args.title - The title of the auction.
 * @param args.categoryId - The ID of the category for the auction.
 * @param args.make - The make of the equipment.
 * @param args.model - The model of the equipment.
 * @param args.year - The year of the equipment.
 * @param args.operatingHours - The operating hours of the equipment.
 * @param args.location - The location of the equipment.
 * @param args.description - The description of the auction.
 * @param args.startingPrice - The starting price of the auction.
 * @param args.reservePrice - The reserve price of the auction.
 * @param args.durationDays - The duration of the auction in days.
 * @param args.images - The images for the auction.
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
 * @param args.isDraft - Whether the auction is a draft.
 * @returns Promise<Id<"auctions">>
 */
export const createAuctionHandler = async (
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
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const { durationDays, isDraft, ...restArgs } = args;

  if (
    durationDays < AUCTION_MIN_DURATION_DAYS ||
    durationDays > AUCTION_MAX_DURATION_DAYS
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  if (
    restArgs.images.additional &&
    restArgs.images.additional.length > MAX_ADDITIONAL_IMAGES
  ) {
    if (isDraft) {
      // If draft, truncate to max allowed
      restArgs.images.additional = restArgs.images.additional.slice(
        0,
        MAX_ADDITIONAL_IMAGES
      );
    } else {
      throw new ConvexError(
        `Additional images limit exceeded (max ${MAX_ADDITIONAL_IMAGES.toString()})`
      );
    }
  }

  // Validate categoryId exists
  const category = await ctx.db.get(args.categoryId);
  if (!category) {
    throw new ConvexError("Invalid categoryId: Category not found");
  }

  const images = normalizeImages(restArgs.images);
  const status = isDraft ? "draft" : "pending_review";

  if (!isDraft) {
    validateAuctionBeforePublish({
      ...restArgs,
      images,
      sellerId: userId,
      status,
      currentPrice: args.startingPrice,
      minIncrement:
        args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
          ? SMALL_INCREMENT_AMOUNT
          : LARGE_INCREMENT_AMOUNT,
      durationDays: durationDays,
    } as unknown as Doc<"auctions">);
  }

  const auctionId = await ctx.db.insert("auctions", {
    ...restArgs,
    images,
    sellerId: userId,
    status,
    currentPrice: args.startingPrice,
    minIncrement:
      args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT,
    durationDays: durationDays,
  });

  await updateCounter(ctx, "auctions", "total", 1);
  if (status === "pending_review") {
    await updateCounter(ctx, "auctions", "pending", 1);
  } else {
    await updateCounter(ctx, "auctions", "draft", 1);
  }

  return auctionId;
};

/**
 * Generic auction creation mutation.
 * Supports creating either a draft or a pending_review auction.
 */
export const createAuction = mutation({
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
  },
  returns: v.id("auctions"),
  handler: createAuctionHandler,
});

/**
 * Handler for saving a draft auction.
 * Allows partial updates for draft auctions, enabling users to save incomplete work.
 * @param ctx - The mutation context.
 * @param args - The arguments for saving a draft.
 * @param args.auctionId - The ID of the auction to update (optional).
 * @param args.title - The title of the auction (optional for drafts).
 * @param args.categoryId - The ID of the category for the auction (optional for drafts).
 * @param args.make - The make of the equipment (optional for drafts).
 * @param args.model - The model of the equipment (optional for drafts).
 * @param args.year - The year of the equipment (optional for drafts).
 * @param args.operatingHours - The operating hours of the equipment (optional for drafts).
 * @param args.location - The location of the equipment (optional for drafts).
 * @param args.description - The description of the auction (optional for drafts).
 * @param args.startingPrice - The starting price of the auction (optional for drafts).
 * @param args.reservePrice - The reserve price of the auction (optional for drafts).
 * @param args.durationDays - The duration of the auction in days (optional for drafts).
 * @param args.images - The images for the auction (optional for drafts).
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
 * @returns Promise<Id<"auctions">>
 */
export const saveDraftHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId?: string;
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
  }
) => {
  const { userId } = await requireVerified(ctx);

  const { auctionId, durationDays, ...restArgs } = args;

  if (
    durationDays !== undefined &&
    (durationDays < AUCTION_MIN_DURATION_DAYS ||
      durationDays > AUCTION_MAX_DURATION_DAYS)
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

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

  let validAuctionId: Id<"auctions"> | null = null;
  if (auctionId) {
    validAuctionId = ctx.db.normalizeId("auctions", auctionId);
    if (!validAuctionId) {
      throw new ConvexError("Invalid auctionId provided");
    }
  }

  if (validAuctionId) {
    const existing = await ctx.db.get(validAuctionId);
    if (!existing) {
      throw new ConvexError("Auction not found");
    }
    assertOwnership(existing, userId);
    assertEditable(existing);

    if (existing.status === "pending_review") {
      const mergedState = {
        ...existing,
        ...restArgs,
        ...(images && { images }),
      } as Doc<"auctions">;
      validateAuctionBeforePublish(mergedState);
    }

    const patchData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(restArgs)) {
      if (value !== undefined) {
        patchData[key] = value;
      }
    }
    if (images !== undefined) {
      patchData.images = images;
    }
    if (durationDays !== undefined) {
      patchData.durationDays = durationDays;
    }
    if (restArgs.startingPrice !== undefined) {
      patchData.currentPrice = restArgs.startingPrice;
      patchData.minIncrement =
        restArgs.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
          ? SMALL_INCREMENT_AMOUNT
          : LARGE_INCREMENT_AMOUNT;
    }

    await ctx.db.patch(validAuctionId, patchData);

    return validAuctionId;
  }

  // For new drafts, we need at least title and images
  if (!args.title) {
    throw new ConvexError("Title is required to create a new draft");
  }
  if (images === undefined) {
    throw new ConvexError("Images are required to create a new draft");
  }

  const newAuctionId = await ctx.db.insert("auctions", {
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
    durationDays: durationDays ?? AUCTION_DEFAULT_DURATION_DAYS,
  });

  await updateCounter(ctx, "auctions", "total", 1);
  await updateCounter(ctx, "auctions", "draft", 1);

  return newAuctionId;
};

/**
 * Save or update a draft auction.
 * Creates new draft if no auctionId provided, otherwise updates existing draft.
 * All fields except those required for new draft creation are optional to support partial saves.
 */
export const saveDraft = mutation({
  args: {
    auctionId: v.optional(v.string()),
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
  },
  returns: v.id("auctions"),
  handler: saveDraftHandler,
});