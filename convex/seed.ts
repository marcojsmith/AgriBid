// app/convex/seed.ts
import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import {
  DEFAULT_BUYER_PREMIUM_PCT,
  DEFAULT_DEPOSIT_AMOUNT,
  DEFAULT_DEPOSIT_ENABLED,
  DEFAULT_DEPOSIT_REFUND_DAYS,
  DEFAULT_MIN_PHOTOS_PER_LOT,
  DEFAULT_SELLER_COMMISSION_PCT,
  DEFAULT_SELLER_LISTING_FEE,
  DEFAULT_SELLER_PAYOUT_DAYS,
  MS_PER_DAY,
  MS_PER_HOUR,
} from "./constants";
import type { SellerType } from "./lib/lotSpecs";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCallerRole } from "./lib/auth";
import { deleteAuctionImages, safeDelete } from "./lib/storage";
import { logAudit } from "./admin_utils";
import { ensureLegalPageDraftRows } from "./lib/legalPages";
import { recalculateCounters } from "./lib/seedCounters";
import { scheduleRetime } from "./wbtDemo";
import {
  SELLER_RESPONSE_TIMES,
  type SellerResponseTime,
} from "./lib/provinces";

export type DestructiveAccessPath = "admin" | "secret" | "dev";

type SeedTableNames =
  | "auctions"
  | "lots"
  | "bids"
  | "profiles"
  | "watchlist"
  | "equipmentMetadata"
  | "equipmentCategories"
  | "counters"
  | "lotViewers"
  | "engagementScores"
  | "proxy_bids"
  | "reviews"
  | "conversations"
  | "messages"
  | "notifications"
  | "supportTickets"
  | "userActivity"
  | "lotFlags"
  | "profileFlags"
  | "lotFees";

const BATCH_SIZE = 500;

/**
 * Deletes the `lotNumber:*`, `watchers:*`, `bids:*`, `views:*` and
 * `anonviews:*` counters, which are scoped to lots and auctions that no longer
 * exist after a lots/auctions clear.
 *
 * @param ctx - Mutation context.
 */
async function clearLotScopedCounters(ctx: MutationCtx): Promise<void> {
  for (const [from, to] of [
    ["lotNumber:", "lotNumber;"],
    ["watchers:", "watchers;"],
    ["bids:", "bids;"],
    ["views:", "views;"],
    ["anonviews:", "anonviews;"],
  ] as const) {
    let batch = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.gte("name", from).lt("name", to))
      .take(BATCH_SIZE);
    while (batch.length > 0) {
      await Promise.all(batch.map((c) => ctx.db.delete("counters", c._id)));
      batch = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.gte("name", from).lt("name", to))
        .take(BATCH_SIZE);
    }
  }
}

/**
 * Resets the lotFees counter to zero after clearing the table.
 * Ensures consistency between cleared lotFees rows and aggregate counters.
 *
 * @param ctx - Mutation context.
 */
async function resetLotFeeCounters(ctx: MutationCtx): Promise<void> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "lotFees"))
    .unique();

  if (counter) {
    await ctx.db.patch("counters", counter._id, {
      buyerTotal: 0,
      sellerTotal: 0,
      updatedAt: Date.now(),
    });
  }
}

const MOCK_SELLER_EMAIL = "mock-seller@farm.com";
const MOCK_ADMIN_EMAIL = "admin@agribid.com";

/**
 * userId used for the synthetic mock-seller profile recreated by the weekly
 * reset. It is display-only and can never authenticate.
 */
const MOCK_SELLER_FALLBACK_USER_ID = "mock-seller";

const MOCK_BUYER_PROFILES = [
  {
    userId: "mock-buyer-1",
    name: "Amelia Mokoena",
    email: "mock-buyer-1@agribid.demo",
    createdDaysAgo: 120,
  },
  {
    userId: "mock-buyer-2",
    name: "Thabo Nkosi",
    email: "mock-buyer-2@agribid.demo",
    createdDaysAgo: 110,
  },
  {
    userId: "mock-buyer-3",
    name: "Sarah Bennett",
    email: "mock-buyer-3@agribid.demo",
    createdDaysAgo: 95,
  },
  {
    userId: "mock-buyer-4",
    name: "Pieter van der Merwe",
    email: "mock-buyer-4@agribid.demo",
    createdDaysAgo: 80,
  },
  {
    userId: "mock-buyer-5",
    name: "Lucy Chen",
    email: "mock-buyer-5@agribid.demo",
    createdDaysAgo: 65,
  },
  {
    userId: "mock-buyer-6",
    name: "David Okafor",
    email: "mock-buyer-6@agribid.demo",
    createdDaysAgo: 50,
  },
];

const MOCK_EXTRA_SELLER_PROFILES = [
  {
    userId: "mock-seller-2",
    name: "Greenfield Agri Imports",
    email: "mock-seller-2@agribid.demo",
    location: "Bloemfontein, ZA",
    bio: "Importer and reseller of quality pre-owned agricultural equipment.",
    createdDaysAgo: 200,
    sellerType: "dealer",
    vatRegistered: true,
  },
  {
    userId: "mock-seller-3",
    name: "Highveld Machinery Co",
    email: "mock-seller-3@agribid.demo",
    location: "Pretoria, ZA",
    bio: "Family-run machinery dealership serving Highveld farmers since 1994.",
    createdDaysAgo: 150,
    sellerType: "dealer",
    vatRegistered: true,
  },
  {
    // The private (non-VAT) seller of the demo: Malmesbury farmer.
    userId: "mock-seller-4",
    name: "Koos Steyn",
    email: "mock-seller-4@agribid.demo",
    location: "Malmesbury, ZA",
    bio: "Wheat and canola farmer in the Swartland selling surplus machinery.",
    createdDaysAgo: 90,
    sellerType: "private_farmer",
    vatRegistered: false,
  },
] satisfies {
  userId: string;
  name: string;
  email: string;
  location: string;
  bio: string;
  createdDaysAgo: number;
  sellerType: SellerType;
  vatRegistered: boolean;
}[];

/**
 * Seller type and VAT status for the Clerk-synced mock seller (a VAT-registered
 * farming business). Applied only while the real profile has none, so an
 * admin- or seller-set value is never overwritten.
 */
const MOCK_PRIMARY_SELLER_VAT: {
  sellerType: SellerType;
  vatRegistered: boolean;
} = { sellerType: "farming_business", vatRegistered: true };

/** Response times cycled across seeded sellers so every copy variant shows. */
const MOCK_SELLER_RESPONSE_TIMES: readonly SellerResponseTime[] =
  SELLER_RESPONSE_TIMES;

/**
 * Enforces that destructive operations are permitted only for admin callers,
 * when a valid SEED_SECRET is provided, or in local development with an explicit opt-in.
 *
 * IMPORTANT: Preview deployments (VERCEL_ENV=preview) are NOT trusted. Admin auth or
 * SEED_SECRET is required in every environment except local dev with ALLOW_DEV_SEED=true.
 *
 * @param ctx - Mutation context used to determine the caller's role for access validation.
 * @returns The access path used ("admin" | "secret" | "dev") for audit logging.
 * @throws Error if the caller is not authorized and no valid secret or dev opt-in is present.
 */
async function checkDestructiveAccess(
  ctx: MutationCtx
): Promise<DestructiveAccessPath> {
  const nodeEnv = process.env.NODE_ENV;
  const role = await getCallerRole(ctx);
  const isAdmin = role === "admin";

  if (isAdmin) {
    return "admin";
  }

  const allowDevSeed = process.env.ALLOW_DEV_SEED === "true";
  const isDev = nodeEnv === "development";

  if (isDev && allowDevSeed) {
    return "dev";
  }

  throw new Error(
    "Unauthorized: Destructive seed operations require admin authentication, " +
      "a valid SEED_SECRET, or local development with ALLOW_DEV_SEED=true. " +
      `Current environment: NODE_ENV=${nodeEnv ?? "undefined"}, ` +
      `ALLOW_DEV_SEED=${allowDevSeed ? "true" : "false"}.`
  );
}

/**
 * Batch-deletes every row from a table using the shared batched pattern.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @param tableName - Table to clear.
 * @returns The number of rows deleted.
 */
async function clearTable(
  ctx: MutationCtx,
  tableName: SeedTableNames
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query(tableName).take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(batch.map((item) => ctx.db.delete(tableName, item._id)));
    deletedCount += batch.length;
    batch = await ctx.db.query(tableName).take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Deletes a profile's KYC document blobs from storage, then deletes the
 * profile row itself.
 *
 * @param ctx - Mutation context used for the storage and row deletes.
 * @param profile - The profile to delete.
 */
async function deleteProfileWithKYCStorage(
  ctx: MutationCtx,
  profile: Doc<"profiles">
): Promise<void> {
  for (const documentId of profile.kycDocuments ?? []) {
    await safeDelete(ctx, documentId, "kyc document");
  }
  await ctx.db.delete("profiles", profile._id);
}

/**
 * Batch-deletes every lot, removing the storage blobs it references
 * (images and condition report) first so no orphaned files are left behind.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of lots deleted.
 */
async function clearLotsTableWithStorage(ctx: MutationCtx): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("lots").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (lot) => {
        await deleteAuctionImages(ctx, lot.images);
        if (lot.conditionReportUrl) {
          await safeDelete(ctx, lot.conditionReportUrl, "condition report");
        }
        if (lot.coldStartVideo) {
          await safeDelete(ctx, lot.coldStartVideo, "cold start video");
        }
        await ctx.db.delete("lots", lot._id);
      })
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("lots").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Batch-deletes every auction container, removing its referenced banner-image
 * blob first so no orphaned files are left behind.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of auctions deleted.
 */
async function clearAuctionsTableWithStorage(
  ctx: MutationCtx
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("auctions").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (auction) => {
        if (auction.bannerImage) {
          await safeDelete(ctx, auction.bannerImage, "auction banner image");
        }
        await ctx.db.delete("auctions", auction._id);
      })
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("auctions").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Batch-deletes every profile, removing referenced KYC document blobs first
 * so no orphaned files are left behind. Admin profiles are NOT preserved —
 * use {@link deleteNonAdminProfiles} when they must be.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of profiles deleted.
 */
async function clearProfilesTableWithStorage(
  ctx: MutationCtx
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("profiles").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (profile) => deleteProfileWithKYCStorage(ctx, profile))
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("profiles").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Ensures a profile exists for the mock seller email so `performSeed`'s
 * Clerk-dependent lookup can resolve it.
 *
 * `runSeed` still requires the profile to have been created by a real Clerk
 * sign-in (see the pr254 review fix), but the weekly cron reset deletes all
 * non-admin profiles — including the mock seller's. This recreates a
 * synthetic, display-only stand-in so consecutive resets keep working.
 *
 * @param ctx - Mutation context.
 */
async function ensureMockSellerProfile(ctx: MutationCtx): Promise<void> {
  const existing = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_SELLER_EMAIL))
    .first();
  if (existing) return;

  const now = Date.now();
  await ctx.db.insert("profiles", {
    userId: MOCK_SELLER_FALLBACK_USER_ID,
    name: "Mock Seller",
    email: MOCK_SELLER_EMAIL,
    role: "seller",
    isVerified: true,
    kycStatus: "verified",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Inserts the default VAT rate when none has been set.
 *
 * Deliberately seeds nothing under `business.*`: those keys feed the public
 * footer and SEO data, and `weeklyReset` also runs against production, so a
 * seed must never invent a registration, VAT, phone or address. Admins enter
 * real company details on `/admin/business-info`.
 *
 * Never overwrites an existing value.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedPublicSettings(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "vat_rate_pct"))
    .unique();
  if (!existing) {
    await ctx.db.insert("settings", {
      key: "vat_rate_pct",
      value: 15,
      description: "VAT rate (percent) shown in buyer fee estimates (0-100)",
      updatedAt: now,
    });
  }
}

/**
 * Inserts one setting row when its key is absent. Never overwrites.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 * @param key - Setting key.
 * @param value - Value to store when absent.
 * @param description - Row description.
 */
async function insertSettingIfAbsent(
  ctx: MutationCtx,
  now: number,
  key: string,
  value: string | number | boolean,
  description: string
): Promise<void> {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing) {
    await ctx.db.insert("settings", {
      key,
      value,
      description,
      updatedAt: now,
    });
  }
}

/**
 * Seeds the platform settings owned by `convex/admin/platformSettings.ts`
 * (buyer premium, registration deposit, seller costs, minimum photos) with
 * their built-in defaults, so the admin screen shows real rows. These equal
 * the values the app already falls back to, so seeding them changes no
 * behaviour. Insert-if-absent only: admin-set values are never overwritten.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedPlatformSettingDefaults(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  const rows: [string, string | number | boolean, string][] = [
    [
      "buyer_premium_pct",
      DEFAULT_BUYER_PREMIUM_PCT,
      "Default buyer's premium (percent, 0-100) for auctions without their own",
    ],
    [
      "deposit_enabled",
      DEFAULT_DEPOSIT_ENABLED,
      "Whether a registration deposit is required",
    ],
    [
      "deposit_amount",
      DEFAULT_DEPOSIT_AMOUNT,
      "Registration deposit in rand (0-1,000,000)",
    ],
    [
      "deposit_refund_days",
      DEFAULT_DEPOSIT_REFUND_DAYS,
      "Days to refund a registration deposit (1-30)",
    ],
    [
      "seller_commission_pct",
      DEFAULT_SELLER_COMMISSION_PCT,
      "Seller commission (percent, display only)",
    ],
    [
      "seller_listing_fee",
      DEFAULT_SELLER_LISTING_FEE,
      "Seller listing fee in rand",
    ],
    [
      "seller_payout_days",
      DEFAULT_SELLER_PAYOUT_DAYS,
      "Days until seller payout (1-60)",
    ],
    [
      "min_photos_per_lot",
      DEFAULT_MIN_PHOTOS_PER_LOT,
      "Minimum photos required per lot (1-30)",
    ],
  ];
  for (const [key, value, description] of rows) {
    await insertSettingIfAbsent(ctx, now, key, value, description);
  }
}

/**
 * DEMO finance contact (name, company, phone). These are invented showcase
 * values copied from the design mockups; they are NOT real company details and
 * every row is labelled "DEMO" in its description so an admin can spot and
 * replace it on the admin settings screen.
 */
const DEMO_FINANCE_CONTACT: [string, string][] = [
  ["finance_contact_name", "Lee-Anne Vermeulen"],
  ["finance_contact_company", "com-fin"],
  ["finance_contact_phone", "083 277 0178"],
];

/**
 * Seeds the DEMO finance contact, insert-if-absent. Only the demo seed
 * (`runSeed`) calls this. `weeklyReset` runs against the production showcase
 * and must never invent company or contact details, so it skips it.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedDemoFinanceContact(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  for (const [key, value] of DEMO_FINANCE_CONTACT) {
    await insertSettingIfAbsent(
      ctx,
      now,
      key,
      value,
      "DEMO value for the showcase, not a real contact. Replace in admin settings."
    );
  }
}

/**
 * Populates the database with the full showcase dataset: categories, equipment
 * metadata, mock users, auction events, lots, and every related record (bids,
 * proxy bids, reviews, lot fees, watchlist, conversations, notifications,
 * support tickets, user activity and moderation flags), followed by FAQ and
 * counters.
 *
 * Idempotent: rows with a natural unique key (categories, metadata, profiles,
 * lots, bids, reviews, watchlist, conversations, proxy bids, lot fees)
 * are only inserted when absent. Records without one (notifications, support
 * tickets, user activity, flags) are only seeded while their table is empty.
 * Auction event containers are looked up by a manual `seedId` scan (the
 * `auctions` table has no `by_seedId` index; this only runs during seeding,
 * over a handful of rows, so a `.collect()` + `.find()` is fine).
 *
 * @param ctx - Mutation context.
 * @param options - Seed options.
 * @param options.demoFinanceContact - Seed the DEMO finance contact settings.
 * True only for the explicit demo seed (`runSeed`); `weeklyReset` passes false
 * because it also runs on the production showcase, where nothing may be
 * invented about the company or its contacts.
 */
async function performSeed(
  ctx: MutationCtx,
  options: { demoFinanceContact: boolean }
): Promise<void> {
  const now = Date.now();

  await seedPublicSettings(ctx, now);
  await seedPlatformSettingDefaults(ctx, now);
  if (options.demoFinanceContact) {
    await seedDemoFinanceContact(ctx, now);
  }

  // 0. Seed Categories
  const categories = [
    "Tractor",
    "Combine",
    "Sprayer",
    "Planter/Seeder",
    "Tillage Equipment",
    "Hay & Forage",
    "Utility Vehicle",
    "Telehandler",
    "Loader",
    "Construction",
    "Other",
  ];

  const categoryIds = new Map<string, Id<"equipmentCategories">>();

  for (const catName of categories) {
    const existing = await ctx.db
      .query("equipmentCategories")
      .withIndex("by_name", (q) => q.eq("name", catName))
      .first();

    if (!existing) {
      const id = await ctx.db.insert("equipmentCategories", {
        name: catName,
        isActive: true,
      });
      categoryIds.set(catName, id);
    } else {
      categoryIds.set(catName, existing._id);
    }
  }

  /**
   * Helper to get a category ID by name, throwing if not found.
   * @param name - The category name.
   * @returns The category ID.
   */
  const getCategoryId = (name: string): Id<"equipmentCategories"> => {
    const id = categoryIds.get(name);
    if (!id) {
      throw new Error(`Missing category "${name}" during seeding`);
    }
    return id;
  };

  // 1. Seed Equipment Metadata (Extensive list for Southern Africa)
  const metadataItems = [
    // Tractors
    {
      make: "John Deere",
      category: "Tractor",
      models: [
        "5075E",
        "6120M",
        "6155M",
        "6155R",
        "7R 330",
        "8R 410",
        "9R 640",
      ],
    },
    {
      make: "Case IH",
      category: "Tractor",
      models: ["JX95", "Farmall 110", "Puma 155", "Magnum 340", "Steiger 620"],
    },
    {
      make: "Massey Ferguson",
      category: "Tractor",
      models: ["MF 375", "MF 4708", "MF 6713", "MF 7720 S", "MF 8S.265"],
    },
    {
      make: "New Holland",
      category: "Tractor",
      models: ["TD5.90", "T6.140", "T7.270", "T8.435"],
    },
    {
      make: "Landini",
      category: "Tractor",
      models: ["Super 8860", "Landforce 125", "7-230"],
    },
    {
      make: "McCormick",
      category: "Tractor",
      models: ["B-Max 105", "G-Max 135", "X7.660"],
    },
    {
      make: "Kubota",
      category: "Tractor",
      models: ["L45", "M7172", "M108S"],
    },
    {
      make: "Valtra",
      category: "Tractor",
      models: ["A95", "T194", "S394"],
    },
    {
      make: "Fendt",
      category: "Tractor",
      models: ["724 Vario", "1050 Vario"],
    },
    {
      make: "Deutz-Fahr",
      category: "Tractor",
      models: ["Agrolux 90", "Agrotron 6165", "9340 TTV"],
    },
    {
      make: "Ford",
      category: "Tractor",
      models: ["4100", "6610", "TW-35"],
    },

    // Combines
    {
      make: "John Deere",
      category: "Combine",
      models: ["S770", "S780", "S790"],
    },
    {
      make: "Case IH",
      category: "Combine",
      models: ["Axial-Flow 7250", "Axial-Flow 8250", "Axial-Flow 9250"],
    },
    {
      make: "Claas",
      category: "Combine",
      models: ["Lexion 760", "Lexion 8800", "Tucano 580"],
    },
    {
      make: "New Holland",
      category: "Combine",
      models: ["CR7.90", "CR10.90"],
    },

    // Sprayers
    {
      make: "John Deere",
      category: "Sprayer",
      models: ["R4030", "R4038", "R4045"],
    },
    {
      make: "Case IH",
      category: "Sprayer",
      models: ["Patriot 3230", "Patriot 4430"],
    },
    {
      make: "Apache",
      category: "Sprayer",
      models: ["AS1020", "AS1220"],
    },
    {
      make: "Jacto",
      category: "Sprayer",
      models: ["Uniport 2530", "Uniport 3030"],
    },

    // Planters
    {
      make: "Equalizer",
      category: "Planter/Seeder",
      models: ["12000 Series", "24000 Series", "C-Series"],
    },
    {
      make: "John Deere",
      category: "Planter/Seeder",
      models: ["1755", "1775NT", "DB60"],
    },
    {
      make: "Case IH",
      category: "Planter/Seeder",
      models: ["Early Riser 1255", "Early Riser 2150"],
    },

    // Telehandlers / Loaders
    {
      make: "JCB",
      category: "Telehandler",
      models: ["531-70", "541-70", "560-80"],
    },
    {
      make: "Manitou",
      category: "Telehandler",
      models: ["MLT 737", "MLT 840"],
    },
    {
      make: "Bell",
      category: "Loader",
      models: ["220G Logger", "L1206E Loader"],
    },
  ];

  for (const item of metadataItems) {
    const categoryId = getCategoryId(item.category);

    // Try to find by make AND categoryId first
    let existing = await ctx.db
      .query("equipmentMetadata")
      .withIndex("by_make", (q) => q.eq("make", item.make))
      .filter((q) => q.eq(q.field("categoryId"), categoryId))
      .first();

    // If not found, try to find by make alone (legacy cleanup)
    if (!existing) {
      const byMake = await ctx.db
        .query("equipmentMetadata")
        .withIndex("by_make", (q) => q.eq("make", item.make))
        .collect();
      existing = byMake.find((m) => !m.categoryId) ?? null;
    }

    const metadataData = {
      make: item.make,
      models: item.models,
      categoryId,
      isActive: true,
      updatedAt: now,
    };

    if (!existing) {
      await ctx.db.insert("equipmentMetadata", metadataData);
    } else {
      await ctx.db.patch("equipmentMetadata", existing._id, {
        categoryId, // Ensure it's linked to the new category
        isActive: true, // Ensure it's active
        models: Array.from(new Set([...existing.models, ...item.models])),
        updatedAt: now,
      });
    }
  }

  // 2. Resolve the Mock Seller Profile (Clerk-dependent)
  // Note: with Clerk, a profile only exists once its owner has signed in at
  // least once (syncUser creates it on first login) — this seed step only
  // promotes an already-synced profile matching the mock email, it cannot
  // provision a brand-new Clerk identity. The weekly cron reset recreates a
  // synthetic stand-in (see ensureMockSellerProfile) so this lookup keeps
  // succeeding there.
  const sellerProfile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_SELLER_EMAIL))
    .first();

  if (!sellerProfile) {
    throw new Error(
      `Mock seller profile not found. Sign in as ${MOCK_SELLER_EMAIL} via Clerk first, then re-run the seed.`
    );
  }

  const sellerId: string = sellerProfile.userId;

  if (sellerProfile.role !== "seller") {
    await ctx.db.patch("profiles", sellerProfile._id, {
      role: "seller",
      isVerified: true,
      updatedAt: now,
    });
  }

  // The mock seller is a VAT-registered farming business. Applied only while
  // the profile has no seller type, so a value set by the seller or an admin
  // is never overwritten.
  if (
    sellerProfile.sellerType === undefined ||
    sellerProfile.vatRegistered === undefined
  ) {
    await ctx.db.patch("profiles", sellerProfile._id, {
      ...(sellerProfile.sellerType === undefined && {
        sellerType: MOCK_PRIMARY_SELLER_VAT.sellerType,
      }),
      ...(sellerProfile.vatRegistered === undefined && {
        vatRegistered: MOCK_PRIMARY_SELLER_VAT.vatRegistered,
      }),
      updatedAt: now,
    });
  }

  // 2.5. Promote Mock Admin User Profile (Idempotent)
  const adminProfile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_ADMIN_EMAIL))
    .first();

  if (adminProfile && adminProfile.role !== "admin") {
    await ctx.db.patch("profiles", adminProfile._id, {
      role: "admin",
      isVerified: true,
      updatedAt: now,
    });
  }

  // 2.75. Insert Synthetic Mock Users (display-only, bypassing Clerk sign-in)
  for (const buyer of MOCK_BUYER_PROFILES) {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", buyer.userId))
      .unique();
    if (existing) continue;

    await ctx.db.insert("profiles", {
      userId: buyer.userId,
      name: buyer.name,
      email: buyer.email,
      role: "buyer",
      isVerified: true,
      kycStatus: "verified",
      createdAt: now - buyer.createdDaysAgo * MS_PER_DAY,
      updatedAt: now,
    });
  }

  for (const seller of MOCK_EXTRA_SELLER_PROFILES) {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", seller.userId))
      .unique();
    if (existing) {
      // Synthetic profile from an earlier seed: backfill the VAT fields only.
      if (
        existing.sellerType === undefined ||
        existing.vatRegistered === undefined
      ) {
        await ctx.db.patch("profiles", existing._id, {
          ...(existing.sellerType === undefined && {
            sellerType: seller.sellerType,
          }),
          ...(existing.vatRegistered === undefined && {
            vatRegistered: seller.vatRegistered,
          }),
        });
      }
      continue;
    }

    await ctx.db.insert("profiles", {
      userId: seller.userId,
      name: seller.name,
      email: seller.email,
      role: "seller",
      isVerified: true,
      kycStatus: "verified",
      location: seller.location,
      bio: seller.bio,
      sellerType: seller.sellerType,
      vatRegistered: seller.vatRegistered,
      createdAt: now - seller.createdDaysAgo * MS_PER_DAY,
      updatedAt: now,
    });
  }

  // 2.8. Seed Platform Fees (only when the table is empty)
  const existingFee = await ctx.db.query("platformFees").first();
  if (!existingFee) {
    // Inserted INACTIVE on purpose. Seeded lots carry an auction-sourced 5%
    // commission snapshot, which is the one seller commission; an active seller
    // % row would be ignored for them anyway (and charging both would double
    // charge). Keeping it inactive documents the rule and lets an admin switch
    // the platform to fee-row commissions deliberately.
    await ctx.db.insert("platformFees", {
      name: "Seller Commission",
      description: "Percentage fee charged to sellers on successful sales.",
      feeType: "percentage",
      // Percentage fee values are fractions (0.05 = 5%).
      value: 0.05,
      appliesTo: "seller",
      isActive: false,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    // Inserted INACTIVE on purpose. Seeded lots carry an auction-sourced 12%
    // snapshot, which is the one buyer premium; an active buyer % row would be
    // ignored for them anyway. Keeping it inactive documents the rule (one
    // premium, never both) and lets an admin switch the platform to fee-row
    // premiums deliberately. The seeded lotFees ledger still references it.
    await ctx.db.insert("platformFees", {
      name: "Buyer's Premium",
      description:
        "Percentage premium added to the winning bid, paid by the buyer.",
      feeType: "percentage",
      value: DEFAULT_BUYER_PREMIUM_PCT / 100,
      appliesTo: "buyer",
      isActive: false,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3.2b. Admin-set seller response times (cycled so every variant shows)
  const responseTimeSellerIds = [
    sellerId,
    ...MOCK_EXTRA_SELLER_PROFILES.map((seller) => seller.userId),
  ];
  for (const [index, userId] of responseTimeSellerIds.entries()) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) continue;
    await ctx.db.patch("profiles", profile._id, {
      sellerResponseTime:
        MOCK_SELLER_RESPONSE_TIMES[index % MOCK_SELLER_RESPONSE_TIMES.length],
    });
  }

  // 3.11. Seed the welcome notification (only while the table is empty)
  const existingNotification = await ctx.db.query("notifications").first();
  if (!existingNotification) {
    await ctx.db.insert("notifications", {
      recipientId: "all",
      type: "info",
      title: "Welcome to the AgriBid showcase",
      message:
        "This deployment runs on demo data for demonstration purposes. Sales are re-timed weekly so one is always live.",
      isRead: false,
      createdAt: now - 2 * MS_PER_DAY,
    });
  }

  // 3.13. Seed the per-user activity feeds (only while the table is empty)
  const existingActivity = await ctx.db.query("userActivity").first();
  if (!existingActivity) {
    const mockUsers: { userId: string; createdDaysAgo: number }[] = [
      ...MOCK_BUYER_PROFILES.map((buyer) => ({
        userId: buyer.userId,
        createdDaysAgo: buyer.createdDaysAgo,
      })),
      ...MOCK_EXTRA_SELLER_PROFILES.map((seller) => ({
        userId: seller.userId,
        createdDaysAgo: seller.createdDaysAgo,
      })),
      { userId: sellerId, createdDaysAgo: 180 }, // Clerk-synced mock seller
    ];

    for (const user of mockUsers) {
      const createdAt = now - user.createdDaysAgo * MS_PER_DAY;
      await ctx.db.insert("userActivity", {
        userId: user.userId,
        type: "account_created",
        description: "Joined AgriBid",
        createdAt,
      });
      await ctx.db.insert("userActivity", {
        userId: user.userId,
        type: "verification_approved",
        description: "Verification approved",
        createdAt: createdAt + 2 * MS_PER_DAY,
      });
    }
  }

  // 3.15. Seed one profile flag (only while the table is empty)
  const existingProfileFlag = await ctx.db.query("profileFlags").first();
  if (!existingProfileFlag) {
    await ctx.db.insert("profileFlags", {
      reportedUserId: "mock-seller-3",
      reporterId: "mock-buyer-5",
      reason: "fraudulent_listings",
      details:
        "Listed a telehandler with photos taken from another dealer's website.",
      status: "pending",
      createdAt: now - 8 * MS_PER_HOUR,
    });
  }

  // 4. Seed Default FAQ Items
  const defaultFaqItems = [
    {
      question: "How do I register to bid on AgriBid?",
      answer:
        "Create a free account, then complete KYC (Know Your Customer) verification under your profile. Once approved, you can bid on any live auction.",
    },
    {
      question: "How does the bidding process work?",
      answer:
        "Each lot lists a starting price and minimum bid increment. Place your bid before the auction's countdown timer reaches zero. The highest bid when the timer expires wins — if the reserve price has been met.",
    },
    {
      question: "What is a reserve price?",
      answer:
        "A reserve price is the minimum amount the seller is willing to accept. If bidding does not reach the reserve, the lot closes as 'Unsold' and no sale is concluded.",
    },
    {
      question: "How do I list equipment for auction?",
      answer:
        "Navigate to the Sell page, complete the listing form with equipment details, photos, and pricing, then submit for admin review. Approved listings are assigned to an upcoming sale by an admin.",
    },
    {
      question: "What payment methods are accepted?",
      answer:
        "Payment terms are agreed directly between buyer and seller after a successful auction. AgriBid facilitates the auction process; payment and collection logistics are handled between the two parties.",
    },
    {
      question: "How long does KYC verification take?",
      answer:
        "KYC verification is typically completed within one business day. You will receive a notification once your identity has been confirmed.",
    },
  ];

  const existingFaq = await ctx.db.query("faqItems").first();
  if (!existingFaq) {
    await Promise.all(
      defaultFaqItems.map((item, index) =>
        ctx.db.insert("faqItems", {
          ...item,
          order: index,
          isPublished: true,
        })
      )
    );
    console.log(
      `Seeded ${defaultFaqItems.length.toString()} default FAQ items.`
    );
  }

  // 4.5. Seed the legal page drafts. Idempotent: existing rows (body, title and
  // publish state) are never touched, and new rows are always unpublished, so
  // `weeklyReset` on production cannot overwrite or publish legal text.
  const createdLegalPages = await ensureLegalPageDraftRows(ctx);
  if (createdLegalPages.length > 0) {
    console.log(
      `Seeded unpublished legal page drafts: ${createdLegalPages.join(", ")}.`
    );
  }

  // 5. Update Metrics (Counters)
  await recalculateCounters(ctx);

  console.log("Seeding and metric calculation completed successfully.");
}

/**
 * Shared seeding logic for both local development and Vercel Previews.
 * This is idempotent: it checks for existing records before inserting.
 *
 * SECURITY: This mutation is protected by admin authentication, a valid
 * SEED_SECRET, or local development with ALLOW_DEV_SEED=true opt-in.
 */
export const runSeed = mutation({
  args: {
    providedSeed: v.optional(v.string()),
    clear: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seedSecret = process.env.SEED_SECRET;
    const isSecretMatch = !!seedSecret && args.providedSeed === seedSecret;

    let accessPath: DestructiveAccessPath;

    if (isSecretMatch) {
      accessPath = "secret";
    } else {
      accessPath = await checkDestructiveAccess(ctx);
    }

    console.warn(
      `[seed] Destructive operation invoked via ${accessPath} access path`
    );

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "run_seed",
          targetType: "database",
          details: JSON.stringify({ clear: args.clear ?? false }),
        });
      }
    }

    if (args.clear) {
      const tablesToClear: SeedTableNames[] = [
        "bids",
        "proxy_bids",
        "watchlist",
        "reviews",
        "conversations",
        "messages",
        "notifications",
        "supportTickets",
        "userActivity",
        "lotFlags",
        "profileFlags",
        "lotFees",
        "counters",
        "lotViewers",
        "engagementScores",
        "equipmentMetadata",
        "equipmentCategories",
      ];

      const auctionsCount = await clearAuctionsTableWithStorage(ctx);
      const lotsCount = await clearLotsTableWithStorage(ctx);
      console.log(
        `Cleared ${auctionsCount.toString()} records from auctions with storage.`
      );
      console.log(
        `Cleared ${lotsCount.toString()} records from lots with storage.`
      );

      for (const tableName of tablesToClear) {
        const deletedCount = await clearTable(ctx, tableName);
        console.log(
          `Cleared ${deletedCount.toString()} records from ${tableName}.`
        );
      }
    }

    await performSeed(ctx, { demoFinanceContact: true });
    await scheduleRetime(ctx, Date.now());

    return null;
  },
});

export const clearAuctions = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const accessPath = await checkDestructiveAccess(ctx);

    console.warn(`[seed] clearAuctions invoked via ${accessPath} access path`);

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "clear_auctions",
          targetType: "database",
        });
      }
    }

    const totalBidsDeleted = await clearTable(ctx, "bids");
    const lotsCount = await clearLotsTableWithStorage(ctx);
    // Watch rows and per-lot / per-sale counters belong to the lots just deleted.
    await clearTable(ctx, "watchlist");
    await clearTable(ctx, "lotViewers");
    await clearTable(ctx, "engagementScores");
    await clearLotScopedCounters(ctx);
    const auctionsCount = await clearAuctionsTableWithStorage(ctx);
    const lotFeesCount = await clearTable(ctx, "lotFees");

    await resetLotFeeCounters(ctx);

    console.log(
      `Cleared ${auctionsCount.toString()} auction events, ${lotsCount.toString()} lots, ${totalBidsDeleted.toString()} bids and ${lotFeesCount.toString()} lot fees.`
    );
    return auctionsCount + lotsCount;
  },
});

/**
 * Wipe all user and application data.
 * USE WITH CAUTION.
 */
export const clearAllData = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const accessPath = await checkDestructiveAccess(ctx);

    console.warn(`[seed] clearAllData invoked via ${accessPath} access path`);

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "clear_all_data",
          targetType: "database",
        });
      }
    }

    const appTables: SeedTableNames[] = [
      "bids",
      "watchlist",
      "counters",
      "lotViewers",
      "engagementScores",
      "equipmentMetadata",
      "lotFees",
    ];

    let totalDeleted = 0;

    totalDeleted += await clearAuctionsTableWithStorage(ctx);
    totalDeleted += await clearLotsTableWithStorage(ctx);

    for (const tableName of appTables) {
      totalDeleted += await clearTable(ctx, tableName);
    }

    totalDeleted += await clearProfilesTableWithStorage(ctx);

    await resetLotFeeCounters(ctx);

    return totalDeleted;
  },
});

/**
 * Weekly showcase reset: keeps the demo deployment fresh WITHOUT deleting
 * anything. It
 *
 * 1. re-applies the static reference seed (settings defaults, categories,
 *    equipment metadata, mock users, FAQ, legal drafts; all insert-if-absent,
 *    never overwriting an admin-set value),
 * 2. re-times every imported webuytractors.shop sale relative to now (one live
 *    sale, one upcoming, the rest closed in the past), resets bidding on the
 *    live and upcoming sales (only the synthetic `mock-*` bids and watches are
 *    removed) and re-adds a few demo bids so engagement counters stay sane.
 *
 * It never deletes lots, auctions, photos, profiles or real users' data, and
 * never invents company details (the demo finance contact is not seeded).
 * Run `scripts/import-wbt.ts` once to load the catalogue it re-times; with no
 * imported sales this only runs the reference seed.
 *
 * Deliberately does NOT call `checkDestructiveAccess`: this is an internal
 * mutation, unreachable from the public API or client, and the cron scheduler
 * invokes it with no caller identity.
 */
export const weeklyReset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.warn(
      "[seed] weeklyReset invoked via system cron (internal mutation)"
    );

    await logAudit(ctx, {
      action: "weekly_reset",
      targetType: "database",
      system: true,
    });

    await ensureMockSellerProfile(ctx);

    // Production-safe: no demo finance contact (see performSeed).
    await performSeed(ctx, { demoFinanceContact: false });

    const scheduled = await scheduleRetime(ctx, Date.now());
    console.log(
      `Scheduled a re-time of ${scheduled.toString()} imported sales.`
    );

    return null;
  },
});
