// app/convex/seed.ts
import { v } from "convex/values";

import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { getCallerRole } from "./lib/auth";
import { updateCounter } from "./admin_utils";

type SeedTableNames =
  | "auctions"
  | "bids"
  | "profiles"
  | "watchlist"
  | "equipmentMetadata"
  | "equipmentCategories"
  | "counters";

interface DeleteManyResult {
  count: number;
  isDone: boolean;
  continueCursor?: string | null;
}

const BATCH_SIZE = 500;

/**
 * Enforces that destructive operations are permitted only for admin callers or when running in a safe environment.
 *
 * @param ctx - Mutation context used to determine the caller's role for access validation.
 * @throws Error if the caller is not an admin and both NODE_ENV and VERCEL_ENV are undefined.
 * @throws Error if the caller is not an admin and the current environment is neither "development" nor Vercel "preview".
 */
async function checkDestructiveAccess(ctx: MutationCtx) {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const role = await getCallerRole(ctx);
  const isAdmin = role === "admin";

  // Admin bypass: Admins are always allowed to perform destructive operations
  if (isAdmin) return;

  // SECURITY: Explicitly validate environment variables to prevent silent degradation.
  // These variables must be set in the Convex dashboard or via CLI (e.g., bunx convex env set NODE_ENV development).
  if (nodeEnv === undefined && vercelEnv === undefined) {
    throw new Error(
      "Unauthorized: Deployment environment is indeterminate (NODE_ENV and VERCEL_ENV are undefined). " +
        "Destructive operations are blocked for non-admins to prevent accidental data loss in production."
    );
  }

  const isDev = nodeEnv === "development";
  const isPreview = vercelEnv === "preview";

  if (!isDev && !isPreview) {
    throw new Error(
      `Unauthorized: Destructive operations are only allowed in development or preview environments. ` +
        `Current environment: ${nodeEnv || vercelEnv}.`
    );
  }
}

/**
 * Shared seeding logic for both local development and Vercel Previews.
 * This is idempotent: it checks for existing records before inserting.
 *
 * SECURITY: This mutation is protected by environment checks, admin status,
 * or a valid providedSeed matching process.env.SEED_SECRET.
 */
export const runSeed = mutation({
  args: {
    providedSeed: v.optional(v.string()),
    clear: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // --- SECURITY GUARD ---
    const seedSecret = process.env.SEED_SECRET;
    const isSecretMatch = seedSecret && args.providedSeed === seedSecret;

    if (!isSecretMatch) {
      await checkDestructiveAccess(ctx);
    }
    // -----------------------

    if (args.clear) {
      const tablesToClear: SeedTableNames[] = [
        "auctions",
        "bids",
        "watchlist",
        "equipmentMetadata",
        "equipmentCategories",
        "counters",
      ];
      for (const tableName of tablesToClear) {
        let deletedCount = 0;
        while (true) {
          const batch = await ctx.db.query(tableName).take(BATCH_SIZE);
          if (batch.length === 0) break;
          await Promise.all(batch.map((item) => ctx.db.delete(item._id)));
          deletedCount += batch.length;
        }
        console.log(`Cleared ${deletedCount} records from ${tableName}.`);
      }

      /* 
      // DISABLED: Do not wipe auth tables as we cannot seed passwords correctly via mutations.
      // Clear Auth Component tables
      const authModels = [
        "user",
        "account",
        "session",
        "verification",
      ] as const;
      for (const model of authModels) {
        let isDone = false;
        let cursor: string | null = null;
        while (!isDone) {
          const result = (await ctx.runMutation(
            components.auth.adapter.deleteMany,
            {
              input: {
                model,
                where: [], // Clear all
              },
              paginationOpts: { cursor, numItems: BATCH_SIZE },
            }
          )) as DeleteManyResult;

          // Runtime guard for unexpected result shapes
          if (
            typeof result?.isDone !== "boolean" ||
            (result.continueCursor !== null &&
              result.continueCursor !== undefined &&
              typeof result.continueCursor !== "string")
          ) {
            console.error(
              `Unexpected response from deleteMany for ${model}:`,
              result
            );
            isDone = true;
            break;
          }

          isDone = result.isDone;
          cursor = result.continueCursor ?? null;

          // Safety: If no cursor is returned and it's not marked done, assume done
          if (!cursor) isDone = true;
        }
        console.log(`Requested wipe of auth model: ${model}`);
      }
      */
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

    const categoryIds: Record<string, Id<"equipmentCategories">> = {};

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
        categoryIds[catName] = id;
      } else {
        categoryIds[catName] = existing._id;
      }
    }

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
        models: [
          "JX95",
          "Farmall 110",
          "Puma 155",
          "Magnum 340",
          "Steiger 620",
        ],
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
      const categoryId = categoryIds[item.category];

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
        updatedAt: Date.now(),
      };

      if (!existing) {
        await ctx.db.insert("equipmentMetadata", metadataData);
      } else {
        await ctx.db.patch(existing._id, {
          categoryId, // Ensure it's linked to the new category
          isActive: true, // Ensure it's active
          models: Array.from(new Set([...existing.models, ...item.models])),
          updatedAt: Date.now(),
        });
      }
    }

    // 2. Create Mock Seller User Profile (Idempotent)
    const mockSellerEmail = "mock-seller@farm.com";
    const mockSellerId = "mock-seller";

    const seller = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: mockSellerEmail }],
    });

    if (seller) {
      const existingSellerProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) =>
          q.eq("userId", seller.userId || seller._id)
        )
        .first();

      if (!existingSellerProfile) {
        await ctx.db.insert("profiles", {
          userId: seller.userId || seller._id,
          role: "seller",
          isVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // 2.5. Create Mock Admin User Profile (Idempotent)
    const mockAdminEmail = "admin@agribid.com";

    const admin = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: mockAdminEmail }],
    });

    if (admin) {
      const existingAdminProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) =>
          q.eq("userId", admin.userId || admin._id)
        )
        .first();

      if (!existingAdminProfile) {
        await ctx.db.insert("profiles", {
          userId: admin.userId || admin._id,
          role: "admin",
          isVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // 3. Seed Mock Auctions
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const mockAuctions = [
      {
        seedId: "jd-8r-410",
        title: "John Deere 8R 410 — Row Crop Titan",
        categoryId: categoryIds["Tractor"],
        make: "John Deere",
        model: "8R 410",
        year: 2023,
        operatingHours: 450,
        location: "Moline, IL",
        description:
          "This 2023 John Deere 8R 410 is in excellent condition with low hours. Features the Row Crop Titan package, premium cab, and advanced telemetry. Full service history available. Perfect for large-scale production.",
        reservePrice: 385000,
        startingPrice: 250000,
        currentPrice: 275000,
        minIncrement: 5000,
        startTime: now - oneDay,
        endTime: now + 3 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front:
            "https://www.deere.com/assets/images/region-4/products/tractors/row-crop-tractors/8r-8rt-row-crop-tractors/8r-410/8r_410_r4f063847_large_660c917945cea0af3aeb242ddf4c52b9540ef7cc.jpg",
          engine:
            "https://photos.machinefinder.com/06/10805006/70729678_large.jpg",
          cabin:
            "https://www.deere.asia/assets/images/region-2/products/tractors/large/8r-series/2_8r410_joskin_slurrytank_dsc2539_large_large_7a4506d66221ef20112cf11f13bf7ffc898ffec6.jpg",
          additional: [],
        },
      },
      {
        seedId: "case-magnum-380",
        title: "Case IH Magnum 380 — Prairie Powerhouse",
        categoryId: categoryIds["Tractor"],
        make: "Case IH",
        model: "Magnum 380",
        year: 2022,
        operatingHours: 820,
        location: "Racine, WI",
        description:
          "A 2022 Case IH Magnum 380, the ultimate Prairie Powerhouse. Features the CVXDrive transmission, luxury AFS Connect cab, and dual wheels for maximum traction. Exceptionally well-maintained unit.",
        reservePrice: 320000,
        startingPrice: 200000,
        currentPrice: 215000,
        minIncrement: 2500,
        startTime: now - 2 * oneDay,
        endTime: now + 4 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front:
            "https://titanmachinery.bg/media/stenik_article/article/cache/2/image/9df78eab33525d08d6e5fb8d27136e95/1/4/14228766973.jpg",
          engine:
            "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/a74b2445b23f440bacd99ab8eaf177cc?v=abc51e43",
          cabin:
            "https://www.lectura-specs.com/models/renamed/orig/4wd-tractors-magnum-380-cvxdrive-case-ih.jpg",
          additional: [],
        },
      },
      {
        seedId: "nh-t7-315",
        title: "New Holland T7.315 — Blue Diamond",
        categoryId: categoryIds["Tractor"],
        make: "New Holland",
        model: "T7.315",
        year: 2023,
        operatingHours: 210,
        location: "Basildon, UK",
        description:
          "The 2023 New Holland T7.315 Blue Diamond edition. Low operating hours, heavy-duty rear hitch, and PLM Intelligence. Versatile machine for both tillage and transport work.",
        reservePrice: 245000,
        startingPrice: 150000,
        currentPrice: 165000,
        minIncrement: 2000,
        startTime: now - oneDay,
        endTime: now + 5 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front:
            "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/8938fcb66b3a4f48abced368ef3e49ae?v=8416d11a&t=size1100",
          engine:
            "https://rollinsmachinery.com/wp-content/uploads/2024/02/Right-Side-T7.315.jpg",
          cabin:
            "https://www.worldtractors.co.uk/wp-content/uploads/2025/03/IMG_0131-scaled.jpeg",
          additional: [],
        },
      },
      {
        seedId: "mf-8s-305",
        title: "Massey Ferguson 8S.305 — Crimson Legend",
        categoryId: categoryIds["Tractor"],
        make: "Massey Ferguson",
        model: "8S.305",
        year: 2024,
        operatingHours: 15,
        location: "Beauvais, FR",
        description:
          "Virtually new 2024 Massey Ferguson 8S.305. The Crimson Legend features the innovative Protect-U design, Dyna-VT transmission, and exceptional visibility. Demonstration unit with only 15 delivery hours.",
        reservePrice: 210000,
        startingPrice: 140000,
        currentPrice: 142000,
        minIncrement: 1500,
        startTime: now - 3 * oneDay,
        endTime: now + 2 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://www.scotagri.com/media/bz5dn5hz/image001-33.jpg",
          engine:
            "https://ik.imagekit.io/efarm/images/f1e19830-278d-4d3c-894b-18101ec963ec.jpg?tr=w-600%2Cl-image%2Ci-%40%40website-machine-images-watermarks%40%40watermark_DZDDMXPYs_M9F2mQxfH.png%2Clx-6%2Cly-6%2Cw-90%2Cl-end",
          cabin:
            "https://heavyequipmentspecs.s3.amazonaws.com/tractors/massey-ferguson-8s.305/massey-ferguson-8s.305_1.jpg",
          additional: [],
        },
      },
      {
        seedId: "fendt-1050",
        title: "Fendt 1050 Vario — German Precision",
        categoryId: categoryIds["Tractor"],
        make: "Fendt",
        model: "1050 Vario",
        year: 2023,
        operatingHours: 580,
        location: "Marktoberdorf, DE",
        description:
          "2023 Fendt 1050 Vario, the peak of German Precision engineering. Fendt iD low engine speed concept, VarioDrive, and LifeCab. A powerhouse for the most demanding agricultural tasks.",
        reservePrice: 450000,
        startingPrice: 300000,
        currentPrice: 325000,
        minIncrement: 10000,
        startTime: now - oneDay,
        endTime: now + 6 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front:
            "https://www.fendt.com/int/images/60cc414b69b3411a3a4b5114_1623998796_web_en.png",
          engine:
            "https://cdn.gebrauchtmaschinen.de/data/listing/img/vga/ms/97/53/16247668-01.jpg?v=1717573999",
          cabin:
            "https://media.sandhills.com/img.axd?id=9026328987&wid=4326185391&rwl=False&p=&ext=&w=350&h=220&t=&lp=&c=True&wt=False&sz=Cover&rt=0&checksum=42ysNVTRQ48SZVTD4%2BotMVL9yMULXnb1mnh8ao7tBzk%3D",
          additional: [],
        },
      },
    ];

    for (const auction of mockAuctions) {
      const existing = await ctx.db
        .query("auctions")
        .withIndex("by_seedId", (q) => q.eq("seedId", auction.seedId))
        .first();

      const auctionData = {
        ...auction,
        description: auction.description || "No description provided.",
      };

      if (!existing) {
        await ctx.db.insert("auctions", auctionData);
      } else {
        await ctx.db.patch(existing._id, auctionData);
      }
    }

    // 4. Update Metrics (Counters)
    // Recalculate everything to ensure consistency after seeding

    // Auctions
    const allAuctions = await ctx.db.query("auctions").collect();
    await updateCounter(ctx, "auctions", "total", allAuctions.length, true);
    await updateCounter(
      ctx,
      "auctions",
      "active",
      allAuctions.filter((a) => a.status === "active").length,
      true
    );
    await updateCounter(
      ctx,
      "auctions",
      "draft",
      allAuctions.filter((a) => a.status === "draft").length,
      true
    );

    // Bids
    const allBids = await ctx.db.query("bids").collect();
    await updateCounter(ctx, "bids", "total", allBids.length, true);

    const salesVolume = allAuctions
      .filter((a) => a.status === "sold" && a.currentPrice)
      .reduce((sum, a) => sum + (a.currentPrice || 0), 0);
    const soldCount = allAuctions.filter((a) => a.status === "sold").length;

    await updateCounter(ctx, "bids", "salesVolume", salesVolume, true);
    await updateCounter(ctx, "bids", "soldCount", soldCount, true);

    // Profiles
    const allProfiles = await ctx.db.query("profiles").collect();
    await updateCounter(ctx, "profiles", "total", allProfiles.length, true);
    await updateCounter(
      ctx,
      "profiles",
      "verified",
      allProfiles.filter((p) => p.isVerified).length,
      true
    );
    await updateCounter(
      ctx,
      "profiles",
      "pending",
      allProfiles.filter((p) => p.kycStatus === "pending").length,
      true
    );

    // Support
    const allTickets = await ctx.db.query("supportTickets").collect();
    await updateCounter(ctx, "support", "total", allTickets.length, true);
    await updateCounter(
      ctx,
      "support",
      "open",
      allTickets.filter((t) => t.status === "open").length,
      true
    );
    await updateCounter(
      ctx,
      "support",
      "resolved",
      allTickets.filter((t) => t.status === "resolved").length,
      true
    );

    // Audit Logs
    const allAuditLogs = await ctx.db.query("auditLogs").collect();
    await updateCounter(ctx, "auditLogs", "total", allAuditLogs.length, true);

    console.log("Seeding and metric calculation completed successfully.");
    return null;
  },
});

export const clearAuctions = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await checkDestructiveAccess(ctx);

    let totalBidsDeleted = 0;
    let auctionsCount = 0;

    // 1. Sweep and delete all bids first to avoid nested loops/long mutations
    while (true) {
      const bidsBatch = await ctx.db.query("bids").take(BATCH_SIZE);
      if (bidsBatch.length === 0) break;
      await Promise.all(bidsBatch.map((b) => ctx.db.delete(b._id)));
      totalBidsDeleted += bidsBatch.length;
    }

    // 2. Delete auctions in batches
    while (true) {
      const auctionsBatch = await ctx.db.query("auctions").take(BATCH_SIZE);
      if (auctionsBatch.length === 0) break;
      await Promise.all(auctionsBatch.map((a) => ctx.db.delete(a._id)));
      auctionsCount += auctionsBatch.length;
    }

    console.log(
      `Cleared ${auctionsCount} auctions and ${totalBidsDeleted} bids.`
    );
    return auctionsCount;
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
    await checkDestructiveAccess(ctx);

    const appTables: SeedTableNames[] = [
      "auctions",
      "bids",
      "profiles",
      "watchlist",
      "equipmentMetadata",
    ];

    const authModels = ["user", "session", "account", "verification"] as const;

    let totalDeleted = 0;

    // Clear App Tables
    for (const tableName of appTables) {
      let deletedCount = 0;
      while (true) {
        const batch = await ctx.db.query(tableName).take(BATCH_SIZE);
        if (batch.length === 0) break;
        await Promise.all(batch.map((r) => ctx.db.delete(r._id)));
        deletedCount += batch.length;
      }
      totalDeleted += deletedCount;
    }

    // Clear Auth Tables via component adapter
    for (const model of authModels) {
      let isDone = false;
      let cursor: string | null = null;
      while (!isDone) {
        const result = (await ctx.runMutation(
          components.auth.adapter.deleteMany,
          {
            input: {
              model,
              where: [],
            },
            paginationOpts: { cursor, numItems: BATCH_SIZE },
          }
        )) as DeleteManyResult;

        // Runtime guard for unexpected result shapes
        if (
          typeof result?.isDone !== "boolean" ||
          (result.continueCursor !== null &&
            result.continueCursor !== undefined &&
            typeof result.continueCursor !== "string")
        ) {
          console.error(
            `Unexpected response from deleteMany for ${model}:`,
            result
          );
          isDone = true;
          break;
        }

        const count = Number(result.count ?? 0);
        totalDeleted += count;
        isDone = result.isDone;
        cursor = result.continueCursor ?? null;

        if (!cursor) isDone = true;
        console.log(`Wiped batch of auth model: ${model} (${count} deleted)`);
      }
    }

    return totalDeleted;
  },
});
